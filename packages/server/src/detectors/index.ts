import { getDb } from '../db/schema.js'
import type { AnalysisResult, ContextPattern } from '@tokenflow/shared'
import { calculateGrade } from '@tokenflow/shared'

// Simplified detector runner for V1
export function runDetectors(
  requestBody: { model: string; messages: Array<{ role: string; content: string }> },
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
): AnalysisResult {
  const messages = requestBody.messages || []
  const warnings: string[] = []
  const suggestions: string[] = []
  let detectedPattern: ContextPattern | null = null

  // Full Context detection
  if (messages.length > 20) {
    detectedPattern = 'full_context'
    warnings.push(`${messages.length} messages in context — consider using sliding window or summarization`)
    suggestions.push('Implement a sliding window to keep only the last N messages')
  }

  // Sliding Window detection
  if (!detectedPattern && messages.length >= 5 && messages.length <= 20) {
    const userMsgCount = messages.filter(m => m.role === 'user').length
    if (userMsgCount > 3 && messages[0]?.role === 'system') {
      detectedPattern = 'sliding_window'
    }
  }

  // Summarization detection
  if (!detectedPattern && messages.length > 3) {
    const firstMsg = messages[0]?.content || ''
    if (firstMsg.length > 500 && (firstMsg.includes('summary') || firstMsg.includes('摘要'))) {
      detectedPattern = 'summarization'
    }
  }

  // Simple efficiency score
  const msgCount = messages.length
  let score = 100
  if (msgCount > 20) score -= 30
  else if (msgCount > 10) score -= 15

  if (usage.prompt_tokens > 50000) score -= 20
  else if (usage.prompt_tokens > 20000) score -= 10

  // Check for repeated content
  const contents = messages.map(m => m.content)
  const uniqueContents = new Set(contents)
  const repetitionRatio = 1 - (uniqueContents.size / contents.length)
  score -= Math.round(repetitionRatio * 20)

  score = Math.max(0, Math.min(100, score))

  return {
    detected_pattern: detectedPattern,
    efficiency_score: score,
    warnings,
    suggestions,
  }
}
