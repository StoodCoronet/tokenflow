from typing import Dict, Any, Optional
from app.detectors.base import ContextPatternDetector, AnalysisResult, Suggestion
from app.models.request_log import ContextPattern


class SlidingWindowDetector(ContextPatternDetector):
    """
    Detects Sliding Window pattern usage and evaluates its efficiency.
    """
    
    @property
    def detector_id(self) -> str:
        return "det-sliding-window"
    
    @property
    def detector_name(self) -> str:
        return "Sliding Window Pattern Detector"
    
    async def analyze(self, session_data: Dict, request_data: Dict, response_data: Optional[Dict]) -> AnalysisResult:
        messages = request_data.get("messages", [])
        metrics = self.calculate_token_efficiency(messages)
        
        warnings = []
        suggestions = []
        confidence = 0.0
        
        message_count = len(messages)
        
        # Detect if sliding window is being used
        # Signal: Message count stays relatively stable across requests
        history = session_data.get("request_history", [])
        if len(history) >= 2:
            counts = [h.get("message_count", 0) for h in history[-5:]]
            if max(counts) - min(counts) <= 2 and message_count <= 20:
                confidence = 0.7  # Likely using sliding window
        
        # Check if window size is appropriate
        if message_count <= 5:
            warnings.append("窗口大小可能过小，可能导致上下文丢失")
            confidence = max(confidence, 0.5)
        elif message_count > 20:
            warnings.append("窗口大小较大，滑动窗口的优势不明显")
        
        # Analyze message importance distribution (placeholder)
        user_msgs = [m for m in messages if m.get("role") == "user"]
        assistant_msgs = [m for m in messages if m.get("role") == "assistant"]
        
        # Detect potential low-value messages
        short_msgs = [m for m in messages if len(str(m.get("content", ""))) < 20]
        if len(short_msgs) > len(messages) * 0.3:
            warnings.append(f"窗口内有 {len(short_msgs)} 条短消息，可能包含低价值内容")
            suggestions.append(Suggestion(
                type="window_optimization",
                severity="medium",
                title="优化窗口内消息质量",
                description="检测到较多简短消息，建议调整窗口大小或过滤低价值内容",
                current_value=message_count,
                suggested_value=max(5, message_count - len(short_msgs) // 2),
                estimated_savings_percent=len(short_msgs) / len(messages) * 20
            ))
        
        # Calculate efficiency
        efficiency = 70  # Base score for using sliding window
        if message_count <= 10:
            efficiency += 20
        if len(warnings) == 0:
            efficiency += 10
        efficiency = min(100, efficiency)
        
        return AnalysisResult(
            pattern=ContextPattern.SLIDING_WINDOW,
            confidence=confidence,
            efficiency_score=efficiency,
            warnings=warnings,
            suggestions=suggestions,
            metrics={
                **metrics,
                "window_size": message_count,
                "user_messages": len(user_msgs),
                "assistant_messages": len(assistant_msgs),
                "short_messages": len(short_msgs)
            }
        )
