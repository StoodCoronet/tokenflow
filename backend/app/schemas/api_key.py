from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.api_key import ProviderType


class ApiKeyCreate(BaseModel):
    name: str = Field(..., description="Display name for this API key")
    provider: ProviderType = Field(default=ProviderType.OPENAI)
    upstream_key: str = Field(..., description="The actual API key from provider")
    base_url: str = Field(default="https://api.openai.com/v1")
    scenario: Optional[str] = Field(None, description="Business scenario tag")


class ApiKeyUpdate(BaseModel):
    name: Optional[str] = None
    upstream_key: Optional[str] = None
    base_url: Optional[str] = None
    scenario: Optional[str] = None


class ApiKeyResponse(BaseModel):
    id: str
    name: str
    provider: ProviderType
    base_url: str
    scenario: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    
    # Statistics (computed)
    total_requests: int = 0
    total_tokens: int = 0
    efficiency_score: Optional[float] = None
    
    class Config:
        from_attributes = True
