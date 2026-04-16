from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class SessionSummaryResponse(BaseModel):
    session_id: str
    api_key_id: str
    
    start_time: datetime
    last_activity: Optional[datetime]
    
    message_count: int
    total_prompt_tokens: int
    total_completion_tokens: int
    
    current_pattern: Optional[str]
    current_efficiency_score: Optional[float]
    
    optimization_potential: Optional[float]
    estimated_savings_tokens: int
    estimated_savings_cost: float
    
    class Config:
        from_attributes = True


class SessionList(BaseModel):
    items: List[SessionSummaryResponse]
    total: int
