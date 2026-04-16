from sqlalchemy import Column, String, DateTime, Integer, Float, JSON, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class SessionSummary(Base):
    __tablename__ = "session_summaries"

    session_id = Column(String, primary_key=True)
    api_key_id = Column(String, ForeignKey("api_keys.id"), nullable=False)
    
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    last_activity = Column(DateTime(timezone=True), onupdate=func.now())
    
    message_count = Column(Integer, default=0)
    total_prompt_tokens = Column(Integer, default=0)
    total_completion_tokens = Column(Integer, default=0)
    
    # Pattern detection history
    pattern_history = Column(JSON, default=list)
    current_pattern = Column(String, nullable=True)
    
    # Efficiency tracking
    efficiency_scores = Column(JSON, default=list)  # List of {timestamp, score}
    current_efficiency_score = Column(Float, nullable=True)
    
    # Optimization potential
    optimization_potential = Column(Float, nullable=True)  # Percentage
    estimated_savings_tokens = Column(Integer, default=0)
    estimated_savings_cost = Column(Float, default=0.0)
