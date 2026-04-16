from fastapi import APIRouter, Request, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
import json

from app.core.database import get_db
from app.services.proxy import ProxyService

router = APIRouter()


@router.api_route(
    "/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    response_class=StreamingResponse
)
async def proxy_endpoint(
    request: Request,
    path: str,
    x_api_key: str = Header(..., alias="X-API-Key"),
    db: AsyncSession = Depends(get_db)
):
    """
    Proxy endpoint that forwards requests to upstream LLM providers.
    
    Header:
        X-API-Key: Your Token Flow API Key ID (not the upstream key)
    
    All other headers and body are forwarded to the upstream provider.
    """
    proxy_service = ProxyService(db)
    
    # Get API key configuration
    api_key = await proxy_service.get_api_key(x_api_key)
    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    # Read request body
    try:
        body = await request.json()
    except:
        body = {}
    
    # Check if streaming is requested
    stream = body.get("stream", False)
    
    # Get headers
    headers = dict(request.headers)
    
    # Make proxy request
    async def generate():
        async for chunk in await proxy_service.proxy_request(
            api_key=api_key,
            path=path,
            method=request.method,
            headers=headers,
            body=body,
            stream=stream
        ):
            yield chunk
    
    if stream:
        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )
    else:
        # Collect all chunks for non-streaming
        chunks = []
        async for chunk in generate():
            chunks.append(chunk)
        
        content = b"".join(chunks)
        
        # Try to parse as JSON
        try:
            data = json.loads(content)
            return data
        except:
            return content
