from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models.request_log import ContextPattern


class RequestLogResponse(BaseModel):
    id: str
    api_key_id: str
    session_id: Optional[str]
    
    request_timestamp: datetime
    model: str
    
    response_timestamp: Optional[datetime]
    status: Optional[str]
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    
    detected_pattern: ContextPattern
    efficiency_score: Optional[float]
    warnings: List[str]
    suggestions: List[Dict[str, Any]]
    
    class Config:
        from_attributes = True


class RequestLogList(BaseModel):
    items: List[RequestLogResponse]
    total: int
    page: int
    page_size: int
