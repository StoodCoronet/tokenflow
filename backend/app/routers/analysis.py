from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.report import ReportService

router = APIRouter()


@router.get("/report")
async def get_analysis_report(
    api_key_id: Optional[str] = None,
    days: int = Query(default=7, ge=1, le=30),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate efficiency analysis report.
    
    Args:
        api_key_id: Filter by specific API key (optional)
        days: Number of days to include in report (1-30)
    """
    service = ReportService(db)
    report = await service.generate_report(api_key_id, days)
    return report


@router.get("/sessions")
async def get_sessions(
    api_key_id: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get session summaries"""
    from sqlalchemy import select, desc
    from app.models.session import SessionSummary
    from app.schemas.session import SessionSummaryResponse
    
    query = select(SessionSummary).order_by(desc(SessionSummary.last_activity))
    
    if api_key_id:
        query = query.where(SessionSummary.api_key_id == api_key_id)
    
    result = await db.execute(query.limit(limit))
    sessions = result.scalars().all()
    
    return [SessionSummaryResponse.model_validate(s) for s in sessions]


@router.get("/patterns")
async def get_pattern_distribution(
    days: int = Query(default=7, ge=1, le=30),
    db: AsyncSession = Depends(get_db)
):
    """Get distribution of context patterns"""
    from datetime import datetime, timedelta
    from sqlalchemy import select, func, and_
    from app.models.request_log import RequestLog, ContextPattern
    
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    result = await db.execute(
        select(
            RequestLog.detected_pattern,
            func.count(RequestLog.id).label("count"),
            func.avg(RequestLog.efficiency_score).label("avg_efficiency"),
            func.sum(RequestLog.total_tokens).label("total_tokens")
        )
        .where(
            and_(
                RequestLog.request_timestamp >= start_date,
                RequestLog.detected_pattern.isnot(None)
            )
        )
        .group_by(RequestLog.detected_pattern)
    )
    
    rows = result.all()
    
    return [
        {
            "pattern": row.detected_pattern.value if row.detected_pattern else "unknown",
            "count": row.count,
            "avg_efficiency": round(row.avg_efficiency, 1) if row.avg_efficiency else None,
            "total_tokens": row.total_tokens or 0,
        }
        for row in rows
    ]


@router.get("/savings")
async def get_savings_summary(
    api_key_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get savings summary"""
    from sqlalchemy import select, func
    from app.models.request_log import RequestLog
    from app.models.api_key import ApiKey
    
    # Get all API keys or specific one
    if api_key_id:
        key_result = await db.execute(select(ApiKey).where(ApiKey.id == api_key_id))
        keys = [key_result.scalar_one_or_none()]
    else:
        key_result = await db.execute(select(ApiKey))
        keys = key_result.scalars().all()
    
    summary = {
        "total_keys": len([k for k in keys if k]),
        "keys": []
    }
    
    for key in keys:
        if not key:
            continue
            
        # Get stats for this key
        result = await db.execute(
            select(
                func.count(RequestLog.id).label("count"),
                func.sum(RequestLog.total_tokens).label("tokens"),
                func.avg(RequestLog.efficiency_score).label("efficiency"),
            )
            .where(RequestLog.api_key_id == key.id)
        )
        row = result.first()
        
        # Calculate estimated costs
        total_tokens = row.tokens or 0
        estimated_cost = total_tokens / 1000 * 0.01  # Rough estimate
        
        # Calculate potential savings
        efficiency = row.efficiency or 70
        potential_savings_pct = max(0, 95 - efficiency)
        potential_savings_cost = estimated_cost * (potential_savings_pct / 100)
        
        summary["keys"].append({
            "api_key_id": key.id,
            "name": key.name,
            "scenario": key.scenario,
            "total_requests": row.count or 0,
            "total_tokens": total_tokens,
            "estimated_cost": round(estimated_cost, 2),
            "current_efficiency": round(efficiency, 1),
            "potential_savings_percent": round(potential_savings_pct, 1),
            "potential_savings_cost": round(potential_savings_cost, 2),
        })
    
    # Calculate totals
    summary["total_tokens"] = sum(k["total_tokens"] for k in summary["keys"])
    summary["total_estimated_cost"] = sum(k["estimated_cost"] for k in summary["keys"])
    summary["total_potential_savings"] = sum(k["potential_savings_cost"] for k in summary["keys"])
    
    return summary
