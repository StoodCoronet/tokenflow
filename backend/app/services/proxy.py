import httpx
import uuid
import json
from typing import Dict, Any, Optional, AsyncGenerator
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.api_key import ApiKey
from app.models.request_log import RequestLog, ContextPattern
from app.services.analyzer import AnalysisService


class ProxyService:
    """
    Service for proxying requests to upstream LLM providers.
    Captures traffic for analysis.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.analysis_service = AnalysisService(db)
    
    async def get_api_key(self, key_id: str) -> Optional[ApiKey]:
        """Get API key configuration"""
        from sqlalchemy import select
        result = await self.db.execute(select(ApiKey).where(ApiKey.id == key_id))
        return result.scalar_one_or_none()
    
    async def proxy_request(
        self,
        api_key: ApiKey,
        path: str,
        method: str,
        headers: Dict[str, str],
        body: Dict[str, Any],
        stream: bool = False
    ) -> AsyncGenerator[bytes, None]:
        """
        Proxy request to upstream provider.
        Yields response chunks for streaming.
        """
        # Prepare upstream request
        upstream_headers = {
            "Authorization": f"Bearer {api_key.upstream_key}",
            "Content-Type": "application/json",
        }
        
        # Remove hop-by-hop headers
        headers_to_remove = ["host", "connection", "keep-alive", "transfer-encoding"]
        for h in headers_to_remove:
            headers.pop(h, None)
            headers.pop(h.title(), None)
        
        upstream_headers.update(headers)
        
        # Build upstream URL
        upstream_url = f"{api_key.base_url.rstrip('/')}/{path.lstrip('/')}"
        
        # Generate request ID
        request_id = str(uuid.uuid4())
        
        # Extract session ID from request if present
        session_id = body.get("session_id") or body.get("conversation_id")
        
        # Log request
        await self._log_request(
            request_id=request_id,
            api_key_id=api_key.id,
            session_id=session_id,
            model=body.get("model", "unknown"),
            messages=body.get("messages", []),
            tools=body.get("tools"),
            parameters={k: v for k, v in body.items() if k not in ["messages", "tools"]},
        )
        
        # Make upstream request
        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                if stream:
                    async with client.stream(
                        method=method,
                        url=upstream_url,
                        headers=upstream_headers,
                        json=body,
                    ) as response:
                        if response.status_code >= 400:
                            content = await response.aread()
                            await self._update_request_error(request_id, response.status_code, content.decode())
                            raise HTTPException(status_code=response.status_code, detail=content.decode())
                        
                        # Collect streaming response for analysis
                        chunks = []
                        async for chunk in response.aiter_bytes():
                            chunks.append(chunk)
                            yield chunk
                        
                        # Parse and log response
                        full_response = b"".join(chunks)
                        await self._process_streaming_response(request_id, full_response)
                else:
                    response = await client.request(
                        method=method,
                        url=upstream_url,
                        headers=upstream_headers,
                        json=body,
                    )
                    
                    if response.status_code >= 400:
                        await self._update_request_error(request_id, response.status_code, response.text)
                        raise HTTPException(status_code=response.status_code, detail=response.text)
                    
                    # Log successful response
                    await self._update_request_success(request_id, response.json())
                    
                    yield response.content
                    
            except httpx.RequestError as e:
                await self._update_request_error(request_id, 503, str(e))
                raise HTTPException(status_code=503, detail=f"Upstream error: {str(e)}")
    
    async def _log_request(
        self,
        request_id: str,
        api_key_id: str,
        session_id: Optional[str],
        model: str,
        messages: list,
        tools: Optional[list],
        parameters: dict
    ):
        """Log incoming request"""
        log = RequestLog(
            id=request_id,
            api_key_id=api_key_id,
            session_id=session_id,
            model=model,
            messages=messages,
            tools=tools,
            parameters=parameters,
        )
        self.db.add(log)
        await self.db.commit()
    
    async def _update_request_success(self, request_id: str, response_data: Dict):
        """Update log with successful response"""
        from sqlalchemy import select
        result = await self.db.execute(select(RequestLog).where(RequestLog.id == request_id))
        log = result.scalar_one_or_none()
        
        if log:
            # Extract usage info
            usage = response_data.get("usage", {})
            log.response_timestamp = __import__("datetime").datetime.utcnow()
            log.status = "success"
            log.prompt_tokens = usage.get("prompt_tokens", 0)
            log.completion_tokens = usage.get("completion_tokens", 0)
            log.total_tokens = usage.get("total_tokens", 0)
            
            # Store response content (optional, might be large)
            choices = response_data.get("choices", [])
            if choices:
                content = choices[0].get("message", {}).get("content", "")
                log.response_content = content[:10000]  # Limit size
            
            await self.db.commit()
            
            # Trigger async analysis
            await self.analysis_service.analyze_request(request_id)
    
    async def _update_request_error(self, request_id: str, status_code: int, error: str):
        """Update log with error"""
        from sqlalchemy import select
        result = await self.db.execute(select(RequestLog).where(RequestLog.id == request_id))
        log = result.scalar_one_or_none()
        
        if log:
            log.response_timestamp = __import__("datetime").datetime.utcnow()
            log.status = "error"
            log.error_message = error[:1000]
            await self.db.commit()
    
    async def _process_streaming_response(self, request_id: str, response_bytes: bytes):
        """Process and log streaming response"""
        try:
            # Parse SSE format
            text = response_bytes.decode("utf-8")
            lines = text.split("\n")
            
            content_parts = []
            total_completion_tokens = 0
            
            for line in lines:
                if line.startswith("data: "):
                    data = line[6:]
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                        choices = chunk.get("choices", [])
                        if choices:
                            delta = choices[0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                content_parts.append(content)
                        # Check for usage in final chunk
                        usage = chunk.get("usage")
                        if usage:
                            total_completion_tokens = usage.get("completion_tokens", 0)
                    except json.JSONDecodeError:
                        continue
            
            full_content = "".join(content_parts)
            
            # Update log (token count might be incomplete for streaming)
            from sqlalchemy import select
            result = await self.db.execute(select(RequestLog).where(RequestLog.id == request_id))
            log = result.scalar_one_or_none()
            
            if log:
                log.response_timestamp = __import__("datetime").datetime.utcnow()
                log.status = "success"
                log.response_content = full_content[:10000]
                # Estimate completion tokens
                if total_completion_tokens == 0:
                    import tiktoken
                    try:
                        encoder = tiktoken.get_encoding("cl100k_base")
                        total_completion_tokens = len(encoder.encode(full_content))
                    except:
                        total_completion_tokens = len(full_content) // 4
                log.completion_tokens = total_completion_tokens
                log.total_tokens = log.prompt_tokens + total_completion_tokens
                await self.db.commit()
                
                # Trigger analysis
                await self.analysis_service.analyze_request(request_id)
        except Exception as e:
            # Don't fail the request if logging fails
            print(f"Error processing streaming response: {e}")
