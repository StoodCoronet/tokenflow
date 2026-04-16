from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.request_log import RequestLog, ContextPattern
from app.models.session import SessionSummary
from app.detectors import get_detectors


class AnalysisService:
    """
    Service for analyzing requests and detecting patterns.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.detectors = get_detectors()
    
    async def analyze_request(self, request_id: str):
        """
        Analyze a request using all registered detectors.
        Updates the request log with analysis results.
        """
        # Get request log
        result = await self.db.execute(select(RequestLog).where(RequestLog.id == request_id))
        log = result.scalar_one_or_none()
        
        if not log:
            return
        
        # Get session data
        session_data = await self._get_session_data(log.session_id, log.api_key_id)
        
        # Prepare data for detectors
        request_data = {
            "model": log.model,
            "messages": log.messages,
            "tools": log.tools,
            "parameters": log.parameters,
        }
        
        response_data = None
        if log.status == "success":
            response_data = {
                "content": log.response_content,
                "tokens": log.completion_tokens,
            }
        
        # Run all detectors
        best_result = None
        best_confidence = 0
        all_warnings = []
        all_suggestions = []
        
        for detector in self.detectors:
            try:
                result = await detector.analyze(session_data, request_data, response_data)
                
                # Merge results
                all_warnings.extend(result.warnings)
                all_suggestions.extend(result.suggestions)
                
                # Pick the most confident detection
                if result.confidence > best_confidence:
                    best_confidence = result.confidence
                    best_result = result
                    
            except Exception as e:
                print(f"Detector {detector.detector_id} failed: {e}")
                continue
        
        # Update log with best result
        if best_result:
            log.detected_pattern = best_result.pattern
            log.efficiency_score = best_result.efficiency_score
            log.warnings = all_warnings[:10]  # Limit
            log.suggestions = [s.dict() for s in all_suggestions[:5]]  # Limit
            log.raw_metadata = {
                "best_detector": best_result.pattern.value,
                "confidence": best_confidence,
                "detector_metrics": best_result.metrics,
            }
            await self.db.commit()
        
        # Update session summary
        await self._update_session_summary(log)
    
    async def _get_session_data(self, session_id: Optional[str], api_key_id: str) -> Dict[str, Any]:
        """Get aggregated session data"""
        if not session_id:
            return {}
        
        # Get recent requests in this session
        result = await self.db.execute(
            select(RequestLog)
            .where(RequestLog.session_id == session_id)
            .where(RequestLog.api_key_id == api_key_id)
            .order_by(RequestLog.request_timestamp.desc())
            .limit(10)
        )
        recent_logs = result.scalars().all()
        
        if not recent_logs:
            return {}
        
        return {
            "session_id": session_id,
            "request_count": len(recent_logs),
            "last_request_tokens": recent_logs[0].total_tokens if recent_logs else 0,
            "request_history": [
                {
                    "timestamp": log.request_timestamp.isoformat() if log.request_timestamp else None,
                    "message_count": len(log.messages) if log.messages else 0,
                    "total_tokens": log.total_tokens,
                }
                for log in recent_logs
            ],
        }
    
    async def _update_session_summary(self, log: RequestLog):
        """Update or create session summary"""
        if not log.session_id:
            return
        
        # Get or create summary
        result = await self.db.execute(
            select(SessionSummary).where(SessionSummary.session_id == log.session_id)
        )
        summary = result.scalar_one_or_none()
        
        if not summary:
            summary = SessionSummary(
                session_id=log.session_id,
                api_key_id=log.api_key_id,
            )
            self.db.add(summary)
        
        # Update stats
        summary.message_count += len(log.messages) if log.messages else 0
        summary.total_prompt_tokens += log.prompt_tokens
        summary.total_completion_tokens += log.completion_tokens
        
        # Update pattern
        if log.detected_pattern:
            summary.current_pattern = log.detected_pattern.value
            summary.pattern_history.append({
                "timestamp": log.request_timestamp.isoformat() if log.request_timestamp else None,
                "pattern": log.detected_pattern.value,
            })
        
        # Update efficiency
        if log.efficiency_score:
            summary.current_efficiency_score = log.efficiency_score
            summary.efficiency_scores.append({
                "timestamp": log.request_timestamp.isoformat() if log.request_timestamp else None,
                "score": log.efficiency_score,
            })
        
        # Calculate optimization potential (placeholder)
        total_tokens = summary.total_prompt_tokens + summary.total_completion_tokens
        if total_tokens > 10000:
            summary.optimization_potential = 0.25  # 25% potential savings
            summary.estimated_savings_tokens = int(total_tokens * 0.25)
            summary.estimated_savings_cost = summary.estimated_savings_tokens * 0.00001  # Rough estimate
        
        await self.db.commit()
