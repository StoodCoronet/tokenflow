from typing import Optional, List
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models.request_log import RequestLog, ContextPattern
from app.models.api_key import ApiKey
from app.models.session import SessionSummary
from app.schemas.analysis import EfficiencyReport, Suggestion


# Pricing per 1K tokens (approximate)
PRICING = {
    "gpt-4": {"prompt": 0.03, "completion": 0.06},
    "gpt-4-turbo": {"prompt": 0.01, "completion": 0.03},
    "gpt-3.5-turbo": {"prompt": 0.0015, "completion": 0.002},
    "claude-3-opus": {"prompt": 0.015, "completion": 0.075},
    "claude-3-sonnet": {"prompt": 0.003, "completion": 0.015},
    "default": {"prompt": 0.01, "completion": 0.03},
}


class ReportService:
    """
    Service for generating efficiency reports.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def generate_report(
        self,
        api_key_id: Optional[str] = None,
        days: int = 7
    ) -> EfficiencyReport:
        """
        Generate efficiency report for given period.
        """
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Build query
        query = select(RequestLog).where(
            and_(
                RequestLog.request_timestamp >= start_date,
                RequestLog.status == "success"
            )
        )
        
        if api_key_id:
            query = query.where(RequestLog.api_key_id == api_key_id)
        
        result = await self.db.execute(query)
        logs = result.scalars().all()
        
        # Calculate metrics
        total_prompt = sum(log.prompt_tokens for log in logs)
        total_completion = sum(log.completion_tokens for log in logs)
        total_tokens = total_prompt + total_completion
        
        # Calculate cost
        estimated_cost = self._estimate_cost(logs)
        
        # Pattern distribution
        patterns = {}
        for log in logs:
            pattern = log.detected_pattern.value if log.detected_pattern else "unknown"
            patterns[pattern] = patterns.get(pattern, 0) + 1
        
        # Efficiency trend (daily)
        trend = await self._get_efficiency_trend(api_key_id, start_date, end_date)
        
        # Top suggestions
        suggestions = await self._get_top_suggestions(api_key_id, start_date, end_date)
        
        # Calculate savings
        saved_vs_full = self._calculate_savings_vs_full_context(logs)
        potential_savings = self._calculate_potential_savings(logs)
        
        return EfficiencyReport(
            api_key_id=api_key_id or "all",
            period_start=start_date,
            period_end=end_date,
            total_prompt_tokens=total_prompt,
            total_completion_tokens=total_completion,
            total_tokens=total_tokens,
            estimated_cost=estimated_cost,
            saved_vs_full_context=saved_vs_full,
            potential_savings=potential_savings,
            pattern_distribution=patterns,
            efficiency_trend=trend,
            top_suggestions=suggestions,
        )
    
    def _estimate_cost(self, logs: List[RequestLog]) -> float:
        """Estimate cost based on token usage and model pricing"""
        total_cost = 0.0
        
        for log in logs:
            model = log.model or "default"
            # Find matching pricing
            pricing = PRICING.get("default")
            for key in PRICING:
                if key in model.lower():
                    pricing = PRICING[key]
                    break
            
            prompt_cost = (log.prompt_tokens / 1000) * pricing["prompt"]
            completion_cost = (log.completion_tokens / 1000) * pricing["completion"]
            total_cost += prompt_cost + completion_cost
        
        return round(total_cost, 4)
    
    def _calculate_savings_vs_full_context(self, logs: List[RequestLog]) -> Optional[float]:
        """
        Calculate savings compared to full context pattern.
        This is a rough estimate based on pattern detection.
        """
        if not logs:
            return None
        
        # Count by pattern
        full_context_count = sum(
            1 for log in logs
            if log.detected_pattern == ContextPattern.FULL_CONTEXT
        )
        optimized_count = len(logs) - full_context_count
        
        if len(logs) == 0:
            return 0.0
        
        # Rough estimate: non-full-context saves ~30% on average
        savings = (optimized_count / len(logs)) * 30
        return round(savings, 1)
    
    def _calculate_potential_savings(self, logs: List[RequestLog]) -> Optional[float]:
        """
        Calculate potential savings vs theoretical optimal.
        """
        if not logs:
            return None
        
        # Calculate average efficiency score
        scores = [log.efficiency_score for log in logs if log.efficiency_score]
        if not scores:
            return None
        
        avg_efficiency = sum(scores) / len(scores)
        # Potential to reach 95% efficiency
        potential = max(0, 95 - avg_efficiency)
        
        return round(potential, 1)
    
    async def _get_efficiency_trend(
        self,
        api_key_id: Optional[str],
        start_date: datetime,
        end_date: datetime
    ) -> List[dict]:
        """Get daily efficiency trend"""
        # Group by day
        query = select(
            func.date(RequestLog.request_timestamp).label("date"),
            func.avg(RequestLog.efficiency_score).label("avg_score"),
            func.count(RequestLog.id).label("count")
        ).where(
            and_(
                RequestLog.request_timestamp >= start_date,
                RequestLog.request_timestamp <= end_date,
                RequestLog.efficiency_score.isnot(None)
            )
        )
        
        if api_key_id:
            query = query.where(RequestLog.api_key_id == api_key_id)
        
        query = query.group_by(func.date(RequestLog.request_timestamp))
        
        result = await self.db.execute(query)
        rows = result.all()
        
        return [
            {
                "date": str(row.date),
                "score": round(row.avg_score, 1) if row.avg_score else None,
                "count": row.count,
            }
            for row in rows
        ]
    
    async def _get_top_suggestions(
        self,
        api_key_id: Optional[str],
        start_date: datetime,
        end_date: datetime
    ) -> List[Suggestion]:
        """Get top suggestions based on recent logs"""
        query = select(RequestLog).where(
            and_(
                RequestLog.request_timestamp >= start_date,
                RequestLog.efficiency_score < 70  # Only inefficient ones
            )
        )
        
        if api_key_id:
            query = query.where(RequestLog.api_key_id == api_key_id)
        
        query = query.order_by(RequestLog.efficiency_score.asc()).limit(20)
        
        result = await self.db.execute(query)
        logs = result.scalars().all()
        
        # Collect all suggestions
        all_suggestions = []
        for log in logs:
            if log.suggestions:
                for s in log.suggestions:
                    all_suggestions.append(Suggestion(**s))
        
        # Deduplicate by type and take top 5
        seen_types = set()
        unique_suggestions = []
        for s in all_suggestions:
            if s.type not in seen_types:
                seen_types.add(s.type)
                unique_suggestions.append(s)
                if len(unique_suggestions) >= 5:
                    break
        
        return unique_suggestions
    
    async def get_dashboard_stats(self) -> dict:
        """Get stats for dashboard overview"""
        # Total requests today
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        
        result = await self.db.execute(
            select(func.count(RequestLog.id)).where(
                RequestLog.request_timestamp >= today
            )
        )
        today_requests = result.scalar() or 0
        
        # Total tokens today
        result = await self.db.execute(
            select(func.sum(RequestLog.total_tokens)).where(
                RequestLog.request_timestamp >= today
            )
        )
        today_tokens = result.scalar() or 0
        
        # Active API keys
        result = await self.db.execute(select(func.count(ApiKey.id)))
        total_keys = result.scalar() or 0
        
        # Average efficiency
        result = await self.db.execute(
            select(func.avg(RequestLog.efficiency_score)).where(
                RequestLog.efficiency_score.isnot(None)
            )
        )
        avg_efficiency = result.scalar() or 0
        
        return {
            "today_requests": today_requests,
            "today_tokens": today_tokens,
            "total_api_keys": total_keys,
            "average_efficiency": round(avg_efficiency, 1),
        }
