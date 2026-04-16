import { BaseDetector, type DetectorInput, type DetectorOutput } from './base.js'

/**
 * Sliding Window detector — identifies when a sliding window pattern is used
 * and evaluates if the window size is appropriate.
 */
export class SlidingWindowDetector extends BaseDetector {
  readonly id = 'sliding_window'
  readonly name = 'Sliding Window'

  detect(input: DetectorInput): DetectorOutput {
    const { messages, usage, sessionHistory } = input
    const warnings: string[] = []
    const suggestions: string[] = []
    let confidence = 0

    // Signal 1: Stable message count across session
    if (sessionHistory && sessionHistory.message_count > 3) {
      const msgCount = messages.length
      // If session has many requests but current message count is bounded
      if (sessionHistory.message_count > msgCount * 2 && msgCount >= 4 && msgCount <= 20) {
        confidence += 0.5
      }
    }

    // Signal 2: Has system prompt + bounded context
    const hasSystem = messages.length > 0 && messages[0]?.role === 'system'
    const userMsgs = messages.filter(m => m.role === 'user')
    const assistantMsgs = messages.filter(m => m.role === 'assistant')

    if (hasSystem && userMsgs.length >= 2 && assistantMsgs.length >= 2) {
      const ratio = userMsgs.length / (userMsgs.length + assistantMsgs.length)
      // Balanced conversation within a window
      if (ratio > 0.3 && ratio < 0.7) {
        confidence += 0.2
      }
    }

    // Signal 3: Token usage is stable (not growing rapidly)
    if (sessionHistory && sessionHistory.message_count > 3) {
      const avgTokens = sessionHistory.total_prompt_tokens / sessionHistory.message_count
      const currentRatio = usage.prompt_tokens / avgTokens
      if (currentRatio > 0.8 && currentRatio < 1.5) {
        confidence += 0.2
      }
    }

    // Evaluate window efficiency
    const windowSize = messages.length
    const detected = confidence >= 0.3

    if (detected) {
      // Check if window is too small (losing important context)
      if (windowSize < 6 && usage.completion_tokens > 500) {
        warnings.push(this.warn(`Window size ${windowSize} may be too small — responses may lack context`))
        suggestions.push('Consider increasing window size to 8-12 messages')
      }

      // Check if window is too large (not efficient)
      if (windowSize > 16) {
        warnings.push(this.warn(`Window size ${windowSize} is large — may be wasting tokens`))
        suggestions.push('Consider reducing to 8-12 messages with summarization')
      }

      // Estimate truncation loss
      if (sessionHistory && windowSize < sessionHistory.message_count) {
        const truncatedMsgs = sessionHistory.message_count - windowSize
        warnings.push(this.warn(`~${truncatedMsgs} older messages truncated from context`))
      }

      if (suggestions.length === 0) {
        suggestions.push(`Current window size (${windowSize}) looks reasonable`)
      }
    }

    return {
      detected,
      confidence: Math.min(confidence, 1),
      pattern: 'sliding_window',
      warnings,
      suggestions,
    }
  }
}
