from typing import Dict, Any, Optional
from app.detectors.base import ContextPatternDetector, AnalysisResult, Suggestion
from app.models.request_log import ContextPattern


class SummarizationDetector(ContextPatternDetector):
    """
    Detects Summarization pattern usage.
    Placeholder implementation - can be enhanced with AI analysis.
    """
    
    @property
    def detector_id(self) -> str:
        return "det-summarization"
    
    @property
    def detector_name(self) -> str:
        return "Summarization Pattern Detector"
    
    async def analyze(self, session_data: Dict, request_data: Dict, response_data: Optional[Dict]) -> AnalysisResult:
        messages = request_data.get("messages", [])
        metrics = self.calculate_token_efficiency(messages)
        
        warnings = []
        suggestions = []
        confidence = 0.0
        
        # Detection heuristics for summarization
        # Signal 1: Messages look like summary (short, at the beginning)
        if len(messages) >= 2:
            first_msg = messages[0]
            if first_msg.get("role") == "system" or first_msg.get("role") == "user":
                content = str(first_msg.get("content", ""))
                # Check if it looks like a summary
                summary_keywords = ["summary", "summarize", "previous", "earlier", "conversation"]
                if any(kw in content.lower() for kw in summary_keywords):
                    confidence += 0.4
            
            # Signal 2: First message is long (summary), rest are short (recent context)
            if len(messages) > 2:
                first_length = len(str(messages[0].get("content", "")))
                avg_rest = sum(len(str(m.get("content", ""))) for m in messages[1:]) / (len(messages) - 1)
                if first_length > avg_rest * 3:
                    confidence += 0.4
        
        # Check summarization quality (placeholder)
        if confidence > 0.5:
            # If using summarization, check if it's working well
            if len(messages) > 15:
                warnings.append("即使使用了总结，消息数仍然较多，建议检查总结频率")
            
            suggestions.append(Suggestion(
                type="summarization_frequency",
                severity="low",
                title="优化总结频率",
                description="建议每5-10轮对话进行一次总结",
                estimated_savings_percent=25
            ))
        else:
            # Not detected, suggest if appropriate
            total_tokens = metrics["total_tokens"]
            if total_tokens > 6000 and len(messages) > 15:
                suggestions.append(Suggestion(
                    type="summarization",
                    severity="medium",
                    title="考虑使用对话总结",
                    description=f"当前上下文有 {len(messages)} 轮对话，使用总结可显著减少token",
                    estimated_savings_percent=40,
                    code_example='''from langchain.memory import ConversationSummaryMemory

memory = ConversationSummaryMemory(llm=llm)
memory.save_context({"input": user_input}, {"output": response})'''
                ))
        
        efficiency = 80 if confidence > 0.5 else 50
        efficiency = min(100, efficiency)
        
        return AnalysisResult(
            pattern=ContextPattern.SUMMARIZATION,
            confidence=min(confidence, 1.0),
            efficiency_score=efficiency,
            warnings=warnings,
            suggestions=suggestions,
            metrics=metrics
        )
