import type { Transformer, InternalRequest, ProviderRequest, InternalResponse, ProviderConfig } from './base.js'
import { OpenAITransformer } from './openai.js'
import { AnthropicTransformer } from './anthropic.js'

const transformers: Transformer[] = [
  new OpenAITransformer(),
  new AnthropicTransformer(),
]

/** Find a transformer that can handle the given request body */
export function detectTransformer(body: unknown): Transformer | null {
  // Try Anthropic first (more specific detection)
  for (const t of transformers) {
    if (t.detect(body)) return t
  }
  return null
}

/** Get transformer by provider name */
export function getTransformer(providerName: string): Transformer | null {
  return transformers.find(t => t.providerName === providerName) ?? null
}

export { OpenAITransformer, AnthropicTransformer }
export type { Transformer, InternalRequest, ProviderRequest, InternalResponse, ProviderConfig }
