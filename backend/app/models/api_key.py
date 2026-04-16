from sqlalchemy import Column, String, DateTime, Enum, Text
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class ProviderType(str, enum.Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    CUSTOM = "custom"


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    provider = Column(Enum(ProviderType), default=ProviderType.OPENAI)
    upstream_key = Column(String, nullable=False)  # Encrypted
    base_url = Column(String, nullable=False)
    scenario = Column(String, nullable=True)  # business scenario tag
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
