from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models.request_log import ContextPattern


class Suggestion(BaseModel):
    type: str  # e.g., "window_size", "summarization", "rag"
    severity: str  # "low", "medium", "high"
    title: str
    description: str
    current_value: Optional[Any]
    suggested_value: Optional[Any]
    estimated_savings_percent: Optional[float]
    code_example: Optional[str]


class AnalysisResult(BaseModel):
    pattern: ContextPattern
    confidence: float  # 0-1
    efficiency_score: float  # 0-100
    warnings: List[str]
    suggestions: List[Suggestion]
    metrics: Dict[str, Any]


class EfficiencyReport(BaseModel):
    api_key_id: str
    period_start: datetime
    period_end: datetime
    
    # Token usage
    total_prompt_tokens: int
    total_completion_tokens: int
    total_tokens: int
    
    # Cost estimation (USD)
    estimated_cost: float
    
    # Savings
    saved_vs_full_context: Optional[float]  # percentage
    potential_savings: Optional[float]  # percentage vs optimal
    
    # Breakdown by pattern
    pattern_distribution: Dict[str, int]
    
    # Efficiency trend
    efficiency_trend: List[Dict[str, Any]]  # [{date, score}]
    
    # Top suggestions
    top_suggestions: List[Suggestion]
