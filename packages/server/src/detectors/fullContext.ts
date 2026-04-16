import { BaseDetector, type DetectorInput, type DetectorOutput } from './base.js'

/**
 * Full Context detector — identifies when all conversation history is kept
 * in every request, causing token usage to grow unboundedly.
 */
export class FullContextDetector extends BaseDetector {
  readonly id = 'full_context'
  readonly name = 'Full Context'

  detect(input: DetectorInput): DetectorOutput {
    const { messages, usage, sessionHistory } = input
    const warnings: string[] = []
    const suggestions: string[] = []
    let confidence = 0

    // Signal 1: Message count exceeds threshold
    const msgCount = messages.length
    if (msgCount > 30) {
      confidence += 0.4
      warnings.push(this.warn(`${msgCount} messages in context — very large context window`))
    } else if (msgCount > 20) {
      confidence += 0.25
      warnings.push(this.warn(`${msgCount} messages in context — consider reducing`))
    }

    // Signal 2: Token growth rate across session
    if (sessionHistory) {
      const avgPromptTokens = sessionHistory.total_prompt_tokens / sessionHistory.message_count
      if (avgPromptTokens > 5000 && sessionHistory.message_count > 5) {
        confidence += 0.3
        warnings.push(this.warn(`Average prompt tokens growing: ${Math.round(avgPromptTokens)}/request`))
      }
    }

    // Signal 3: Large prompt tokens for current request
    if (usage.prompt_tokens > 30000) {
      confidence += 0.2
      suggestions.push(this.warn('Consider implementing sliding window or summarization'))
    }

    // Signal 4: Repeated system prompts across messages
    const systemMsgs = messages.filter(m => m.role === 'system')
    const uniqueSystem = new Set(systemMsgs.map(m => m.content))
    if (systemMsgs.length > 1 && uniqueSystem.size < systemMsgs.length) {
      confidence += 0.15
      warnings.push(this.warn('Duplicate system prompts detected'))
    }

    // Signal 5: User asking similar questions repeatedly
    const userMsgs = messages.filter(m => m.role === 'user')
    const userContents = userMsgs.map(m => m.content.toLowerCase())
    let similarCount = 0
    for (let i = 0; i < userContents.length; i++) {
      for (let j = i + 1; j < userContents.length; j++) {
        if (userContents[i] === userContents[j]) {
          similarCount++
        }
      }
    }
    if (similarCount > 3) {
      confidence += 0.15
      suggestions.push(this.warn(`${similarCount} repeated user queries — consider caching responses`))
    }

    const detected = confidence >= 0.3

    if (detected) {
      suggestions.push(
        'Implement a sliding window (keep last N messages)',
        'Or use summarization to compress older conversation',
      )
    }

    return {
      detected,
      confidence: Math.min(confidence, 1),
      pattern: 'full_context',
      warnings,
      suggestions,
    }
  }
}
