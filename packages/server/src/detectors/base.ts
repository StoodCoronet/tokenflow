import type { ChatMessage, AnalysisResult, ContextPattern } from '@tokenflow/shared'
import { calculateGrade } from '@tokenflow/shared'

export interface DetectorInput {
  messages: ChatMessage[]
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  sessionHistory?: {
    message_count: number
    total_prompt_tokens: number
    total_completion_tokens: number
  }
}

export interface DetectorOutput {
  detected: boolean
  confidence: number // 0-1
  pattern: ContextPattern
  warnings: string[]
  suggestions: string[]
}

export abstract class BaseDetector {
  abstract readonly id: string
  abstract readonly name: string

  abstract detect(input: DetectorInput): DetectorOutput

  protected warn(msg: string): string {
    return `[${this.name}] ${msg}`
  }
}

// Weighted scoring across all detectors
export function runAllDetectors(
  input: DetectorInput,
  detectors: BaseDetector[]
): AnalysisResult {
  const results = detectors.map(d => d.detect(input))

  // Pick the highest confidence pattern
  let best: DetectorOutput | null = null
  for (const r of results) {
    if (r.detected && (!best || r.confidence > best.confidence)) {
      best = r
    }
  }

  // Calculate efficiency score
  let score = 100
  const allWarnings: string[] = []
  const allSuggestions: string[] = []

  for (const r of results) {
    allWarnings.push(...r.warnings)
    allSuggestions.push(...r.suggestions)
  }

  // Deductions based on patterns and usage
  if (input.messages.length > 20) score -= 25
  else if (input.messages.length > 10) score -= 10

  if (input.usage.prompt_tokens > 50000) score -= 20
  else if (input.usage.prompt_tokens > 20000) score -= 10

  // Repetition penalty
  const contents = input.messages.map(m => m.content)
  const unique = new Set(contents)
  const repetition = 1 - unique.size / contents.length
  score -= Math.round(repetition * 15)

  // System prompt duplication
  const systemMsgs = input.messages.filter(m => m.role === 'system')
  if (new Set(systemMsgs.map(m => m.content)).size < systemMsgs.length) {
    score -= 10
  }

  score = Math.max(0, Math.min(100, score))

  return {
    detected_pattern: best?.pattern ?? null,
    efficiency_score: score,
    warnings: allWarnings,
    suggestions: allSuggestions,
  }
}
