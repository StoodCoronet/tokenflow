from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from pydantic import BaseModel

from app.models.request_log import ContextPattern


class Suggestion(BaseModel):
    type: str
    severity: str  # "low", "medium", "high"
    title: str
    description: str
    current_value: Optional[Any] = None
    suggested_value: Optional[Any] = None
    estimated_savings_percent: Optional[float] = None
    code_example: Optional[str] = None


class AnalysisResult(BaseModel):
    pattern: ContextPattern
    confidence: float  # 0-1
    efficiency_score: float  # 0-100
    warnings: List[str] = []
    suggestions: List[Suggestion] = []
    metrics: Dict[str, Any] = {}


class ContextPatternDetector(ABC):
    """Base class for context pattern detectors"""
    
    @property
    @abstractmethod
    def detector_id(self) -> str:
        """Unique identifier for this detector"""
        pass
    
    @property
    @abstractmethod
    def detector_name(self) -> str:
        """Human-readable name"""
        pass
    
    @abstractmethod
    async def analyze(self, session_data: Dict, request_data: Dict, response_data: Optional[Dict]) -> AnalysisResult:
        """
        Analyze a request and return detection results.
        
        Args:
            session_data: Aggregated session information
            request_data: Current request details
            response_data: Response details (if available)
        
        Returns:
            AnalysisResult with pattern detection and suggestions
        """
        pass
    
    def calculate_token_efficiency(self, messages: List[Dict]) -> Dict[str, Any]:
        """
        Calculate basic token efficiency metrics.
        Placeholder for more sophisticated analysis.
        """
        import tiktoken
        
        try:
            encoder = tiktoken.get_encoding("cl100k_base")
        except:
            # Fallback for unknown models
            return {
                "total_tokens": 0,
                "message_count": len(messages),
                "avg_tokens_per_message": 0,
            }
        
        total_tokens = 0
        system_tokens = 0
        user_tokens = 0
        assistant_tokens = 0
        
        for msg in messages:
            content = msg.get("content", "")
            if isinstance(content, str):
                tokens = len(encoder.encode(content))
            else:
                tokens = 0
            
            total_tokens += tokens
            role = msg.get("role", "")
            if role == "system":
                system_tokens += tokens
            elif role == "user":
                user_tokens += tokens
            elif role == "assistant":
                assistant_tokens += tokens
        
        return {
            "total_tokens": total_tokens,
            "message_count": len(messages),
            "system_tokens": system_tokens,
            "user_tokens": user_tokens,
            "assistant_tokens": assistant_tokens,
            "avg_tokens_per_message": total_tokens / max(len(messages), 1),
        }
