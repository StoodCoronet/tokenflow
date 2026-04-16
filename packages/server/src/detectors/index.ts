import { BaseDetector, runAllDetectors, type DetectorInput } from './base.js'
import { FullContextDetector } from './fullContext.js'
import { SlidingWindowDetector } from './slidingWindow.js'
import { SummarizationDetector } from './summarization.js'
import type { AnalysisResult } from '@tokenflow/shared'

const detectors: BaseDetector[] = [
  new FullContextDetector(),
  new SlidingWindowDetector(),
  new SummarizationDetector(),
]

export function runDetectors(
  requestBody: { model: string; messages: Array<{ role: string; content: string }> },
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number },
  sessionHistory?: { message_count: number; total_prompt_tokens: number; total_completion_tokens: number }
): AnalysisResult {
  const input: DetectorInput = {
    messages: requestBody.messages || [],
    usage,
    sessionHistory,
  }
  return runAllDetectors(input, detectors)
}

export { BaseDetector, FullContextDetector, SlidingWindowDetector, SummarizationDetector }
