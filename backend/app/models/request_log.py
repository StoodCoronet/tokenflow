from sqlalchemy import Column, String, DateTime, Integer, Float, JSON, ForeignKey, Text, Enum
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class ContextPattern(str, enum.Enum):
    FULL_CONTEXT = "full_context"
    SLIDING_WINDOW = "sliding_window"
    SUMMARIZATION = "summarization"
    RAG = "rag"
    HIERARCHICAL = "hierarchical"
    SELECTIVE = "selective"
    UNKNOWN = "unknown"


class RequestLog(Base):
    __tablename__ = "request_logs"

    id = Column(String, primary_key=True)
    api_key_id = Column(String, ForeignKey("api_keys.id"), nullable=False)
    session_id = Column(String, nullable=True)
    
    # Request info
    request_timestamp = Column(DateTime(timezone=True), server_default=func.now())
    model = Column(String, nullable=False)
    messages = Column(JSON, nullable=False)
    tools = Column(JSON, nullable=True)
    parameters = Column(JSON, nullable=True)
    
    # Response info
    response_timestamp = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, nullable=True)  # success, error
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    response_content = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Analysis
    detected_pattern = Column(Enum(ContextPattern), default=ContextPattern.UNKNOWN)
    efficiency_score = Column(Float, nullable=True)  # 0-100
    warnings = Column(JSON, default=list)
    suggestions = Column(JSON, default=list)
    
    # Raw metadata for extensibility
    raw_metadata = Column(JSON, default=dict)
