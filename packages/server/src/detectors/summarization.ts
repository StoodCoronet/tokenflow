import { BaseDetector, type DetectorInput, type DetectorOutput } from './base.js'

/**
 * Summarization detector — identifies when conversation summarization is used
 * to compress older context into a compact form.
 */
export class SummarizationDetector extends BaseDetector {
  readonly id = 'summarization'
  readonly name = 'Summarization'

  detect(input: DetectorInput): DetectorOutput {
    const { messages, usage, sessionHistory } = input
    const warnings: string[] = []
    const suggestions: string[] = []
    let confidence = 0

    if (messages.length === 0) {
      return { detected: false, confidence: 0, pattern: 'summarization', warnings, suggestions }
    }

    const firstMsg = messages[0]

    // Signal 1: First message is a long system prompt that looks like a summary
    if (firstMsg.role === 'system' && firstMsg.content.length > 300) {
      const content = firstMsg.content.toLowerCase()
      const summaryKeywords = [
        'summary', 'summarized', 'previous conversation',
        '摘要', '总结', '之前的对话', '上文',
        'conversation so far', 'previous context', 'context summary',
      ]
      const matchCount = summaryKeywords.filter(kw => content.includes(kw)).length
      if (matchCount > 0) {
        confidence += 0.3 + matchCount * 0.1
      }
    }

    // Signal 2: First message is disproportionately long compared to others
    if (messages.length > 3) {
      const firstLen = firstMsg.content.length
      const avgLen = messages.slice(1).reduce((sum, m) => sum + m.content.length, 0) / (messages.length - 1)
      if (firstLen > avgLen * 3 && firstLen > 200) {
        confidence += 0.25
      }
    }

    // Signal 3: Bimodal length distribution — one long block + many short exchanges
    if (messages.length > 4) {
      const lengths = messages.map(m => m.content.length)
      const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length
      const longOnes = lengths.filter(l => l > avgLen * 2).length
      const shortOnes = lengths.filter(l => l < avgLen * 0.5).length
      if (longOnes <= 2 && shortOnes >= messages.length * 0.5) {
        confidence += 0.2
      }
    }

    // Signal 4: Stable token usage with long session (implies compression)
    if (sessionHistory && sessionHistory.message_count > 5) {
      const avgPrompt = sessionHistory.total_prompt_tokens / sessionHistory.message_count
      const variance = Math.abs(usage.prompt_tokens - avgPrompt) / avgPrompt
      if (variance < 0.3) {
        confidence += 0.15
      }
    }

    const detected = confidence >= 0.3

    if (detected) {
      // Evaluate summarization quality
      if (firstMsg.role === 'system') {
        const summaryLen = firstMsg.content.length

        // Check if summary is too long (inefficient compression)
        if (summaryLen > 2000) {
          warnings.push(this.warn(`Summary is ${summaryLen} chars — may not be compressed enough`))
          suggestions.push('Consider more aggressive summarization to reduce token usage')
        }

        // Check if summary is too short (may lose important info)
        if (summaryLen < 100 && (sessionHistory?.message_count ?? 0) > 5) {
          warnings.push(this.warn('Summary is very short — may be losing important context'))
          suggestions.push('Consider keeping slightly more detail in summaries')
        }
      }

      if (suggestions.length === 0) {
        suggestions.push('Summarization pattern looks well-tuned')
      }
    }

    return {
      detected,
      confidence: Math.min(confidence, 1),
      pattern: 'summarization',
      warnings,
      suggestions,
    }
  }
}
