from typing import Dict, Any, Optional
from app.detectors.base import ContextPatternDetector, AnalysisResult, Suggestion
from app.models.request_log import ContextPattern


class FullContextDetector(ContextPatternDetector):
    """
    Detects Full Context pattern (keeping all history).
    Identifies inefficient usage patterns.
    """
    
    @property
    def detector_id(self) -> str:
        return "det-full-context"
    
    @property
    def detector_name(self) -> str:
        return "Full Context Pattern Detector"
    
    async def analyze(self, session_data: Dict, request_data: Dict, response_data: Optional[Dict]) -> AnalysisResult:
        messages = request_data.get("messages", [])
        metrics = self.calculate_token_efficiency(messages)
        
        warnings = []
        suggestions = []
        confidence = 0.0
        
        # Detection signals
        message_count = len(messages)
        total_tokens = metrics["total_tokens"]
        
        # Signal 1: High message count
        if message_count > 20:
            confidence += 0.3
            warnings.append(f"会话消息数过多 ({message_count} 轮)，可能导致token成本激增")
        
        # Signal 2: High token count
        if total_tokens > 8000:
            confidence += 0.3
            warnings.append(f"上下文token数 ({total_tokens}) 接近模型上限")
        
        # Signal 3: Rapid token growth
        prev_tokens = session_data.get("last_request_tokens", 0)
        if prev_tokens > 0 and total_tokens > prev_tokens * 1.5:
            confidence += 0.2
            warnings.append("上下文token快速增长，建议优化")
        
        # Signal 4: Check for repeated system prompts (inefficient)
        system_messages = [m for m in messages if m.get("role") == "system"]
        if len(system_messages) > 1:
            confidence += 0.2
            warnings.append(f"检测到 {len(system_messages)} 条系统提示，可能存在重复")
        
        # Calculate efficiency score
        efficiency = max(0, 100 - (message_count * 2) - (total_tokens / 500))
        efficiency = max(0, min(100, efficiency))
        
        # Generate suggestions
        if message_count > 10:
            suggestions.append(Suggestion(
                type="sliding_window",
                severity="high" if message_count > 30 else "medium",
                title="建议使用滑动窗口模式",
                description=f"当前会话有 {message_count} 轮对话，建议只保留最近 10-20 轮",
                current_value=message_count,
                suggested_value=10,
                estimated_savings_percent=((message_count - 10) / message_count * 50) if message_count > 10 else 0,
                code_example='''messages = messages[-10:]  # 只保留最近10轮'''
            ))
        
        if total_tokens > 4000:
            suggestions.append(Suggestion(
                type="summarization",
                severity="high" if total_tokens > 8000 else "medium",
                title="建议使用对话总结",
                description="将早期对话内容总结为摘要，减少token消耗",
                estimated_savings_percent=30,
                code_example='''summary = generate_summary(early_messages)
messages = [summary] + recent_messages'''
            ))
        
        return AnalysisResult(
            pattern=ContextPattern.FULL_CONTEXT,
            confidence=min(confidence, 1.0),
            efficiency_score=efficiency,
            warnings=warnings,
            suggestions=suggestions,
            metrics=metrics
        )
