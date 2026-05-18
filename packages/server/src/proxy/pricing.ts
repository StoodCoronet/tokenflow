import { loadConfig } from '../configLoader.js'

export function resolvePricing(
  model: string,
  explicitTable?: Record<string, { prompt: number; completion: number }>
): { prompt: number; completion: number } | undefined {
  const table = explicitTable ?? loadConfig().Pricing ?? {}
  if (table[model]) return table[model]
  const slashIdx = model.lastIndexOf('/')
  if (slashIdx >= 0) {
    const bare = model.slice(slashIdx + 1)
    if (table[bare]) return table[bare]
  }
  return undefined
}

export function computeCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
  explicitTable?: Record<string, { prompt: number; completion: number }>
): number {
  const pricing = resolvePricing(model, explicitTable)
  if (!pricing) return 0
  return (promptTokens * pricing.prompt + completionTokens * pricing.completion) / 1_000_000
}
