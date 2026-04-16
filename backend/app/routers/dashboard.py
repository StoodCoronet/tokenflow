from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.report import ReportService

router = APIRouter()


@router.get("/stats")
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    """Get dashboard overview statistics"""
    service = ReportService(db)
    return await service.get_dashboard_stats()


@router.get("/recent-requests")
async def get_recent_requests(
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get recent requests for dashboard"""
    from sqlalchemy import select, desc
    from app.models.request_log import RequestLog
    from app.schemas.request_log import RequestLogResponse
    
    result = await db.execute(
        select(RequestLog)
        .order_by(desc(RequestLog.request_timestamp))
        .limit(limit)
    )
    logs = result.scalars().all()
    
    return [RequestLogResponse.model_validate(log) for log in logs]


@router.get("/top-issues")
async def get_top_issues(
    limit: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """Get top optimization opportunities"""
    from sqlalchemy import select, desc
    from app.models.request_log import RequestLog
    
    result = await db.execute(
        select(RequestLog)
        .where(RequestLog.efficiency_score < 70)
        .order_by(RequestLog.efficiency_score.asc())
        .limit(limit)
    )
    logs = result.scalars().all()
    
    issues = []
    for log in logs:
        if log.suggestions:
            for suggestion in log.suggestions[:2]:  # Top 2 per log
                issues.append({
                    "request_id": log.id,
                    "api_key_id": log.api_key_id,
                    "model": log.model,
                    "efficiency_score": log.efficiency_score,
                    "suggestion": suggestion,
                })
    
    return issues[:limit]


@router.get("/efficiency-trend")
async def get_efficiency_trend(
    days: int = 7,
    db: AsyncSession = Depends(get_db)
):
    """Get efficiency trend over time"""
    from datetime import datetime, timedelta
    from sqlalchemy import select, func, and_
    from app.models.request_log import RequestLog
    
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    result = await db.execute(
        select(
            func.date(RequestLog.request_timestamp).label("date"),
            func.avg(RequestLog.efficiency_score).label("avg_score"),
            func.sum(RequestLog.total_tokens).label("total_tokens"),
            func.count(RequestLog.id).label("count")
        )
        .where(
            and_(
                RequestLog.request_timestamp >= start_date,
                RequestLog.request_timestamp <= end_date,
                RequestLog.efficiency_score.isnot(None)
            )
        )
        .group_by(func.date(RequestLog.request_timestamp))
    )
    
    rows = result.all()
    
    return [
        {
            "date": str(row.date),
            "avg_score": round(row.avg_score, 1) if row.avg_score else None,
            "total_tokens": row.total_tokens or 0,
            "request_count": row.count,
        }
        for row in rows
    ]
