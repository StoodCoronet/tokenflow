from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.core.database import get_db
from app.models.api_key import ApiKey
from app.schemas.api_key import ApiKeyCreate, ApiKeyResponse, ApiKeyUpdate

router = APIRouter()


@router.post("", response_model=ApiKeyResponse)
async def create_api_key(data: ApiKeyCreate, db: AsyncSession = Depends(get_db)):
    """Create a new API key configuration"""
    api_key = ApiKey(
        id=str(uuid.uuid4()),
        name=data.name,
        provider=data.provider,
        upstream_key=data.upstream_key,
        base_url=data.base_url,
        scenario=data.scenario,
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)
    return api_key


@router.get("", response_model=List[ApiKeyResponse])
async def list_api_keys(db: AsyncSession = Depends(get_db)):
    """List all API key configurations"""
    result = await db.execute(select(ApiKey))
    keys = result.scalars().all()
    
    # Enhance with stats (this could be optimized)
    response_keys = []
    for key in keys:
        # Get stats
        from sqlalchemy import func
        from app.models.request_log import RequestLog
        
        stats_result = await db.execute(
            select(
                func.count(RequestLog.id),
                func.sum(RequestLog.total_tokens),
                func.avg(RequestLog.efficiency_score)
            ).where(RequestLog.api_key_id == key.id)
        )
        count, tokens, efficiency = stats_result.first()
        
        key_dict = {
            "id": key.id,
            "name": key.name,
            "provider": key.provider,
            "base_url": key.base_url,
            "scenario": key.scenario,
            "created_at": key.created_at,
            "updated_at": key.updated_at,
            "total_requests": count or 0,
            "total_tokens": tokens or 0,
            "efficiency_score": round(efficiency, 1) if efficiency else None,
        }
        response_keys.append(ApiKeyResponse(**key_dict))
    
    return response_keys


@router.get("/{key_id}", response_model=ApiKeyResponse)
async def get_api_key(key_id: str, db: AsyncSession = Depends(get_db)):
    """Get API key details"""
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id))
    key = result.scalar_one_or_none()
    
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    return key


@router.put("/{key_id}", response_model=ApiKeyResponse)
async def update_api_key(
    key_id: str,
    data: ApiKeyUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update API key configuration"""
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id))
    key = result.scalar_one_or_none()
    
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    if data.name:
        key.name = data.name
    if data.upstream_key:
        key.upstream_key = data.upstream_key
    if data.base_url:
        key.base_url = data.base_url
    if data.scenario:
        key.scenario = data.scenario
    
    await db.commit()
    await db.refresh(key)
    return key


@router.delete("/{key_id}")
async def delete_api_key(key_id: str, db: AsyncSession = Depends(get_db)):
    """Delete API key configuration"""
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id))
    key = result.scalar_one_or_none()
    
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    await db.delete(key)
    await db.commit()
    return {"message": "API key deleted"}
