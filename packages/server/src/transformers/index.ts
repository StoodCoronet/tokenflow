import type { MainTransformer, ProviderTransformer } from './base.js'
import { OpenAIMainTransformer, OpenAIProviderTransformer } from './openai.js'
import { AnthropicMainTransformer, AnthropicProviderTransformer } from './anthropic.js'

// ── Dual Registry ──

const mainTransformers = new Map<string, MainTransformer>()
const providerTransformers = new Map<string, ProviderTransformer>()

function registerMain(t: MainTransformer) {
  mainTransformers.set(t.endPoint, t)
}

function registerProvider(t: ProviderTransformer) {
  providerTransformers.set(t.name, t)
}

// Register built-in transformers
registerMain(new OpenAIMainTransformer())
registerMain(new AnthropicMainTransformer())

registerProvider(new OpenAIProviderTransformer())
registerProvider(new AnthropicProviderTransformer())

// ── Public API ──

/** Get main transformer by endpoint path (e.g. '/v1/messages') */
export function getMainTransformer(url: string): MainTransformer {
  // Match by endpoint prefix — handle /v1/messages, /v1/chat/completions, etc.
  for (const [endPoint, transformer] of mainTransformers) {
    if (url.startsWith(endPoint)) return transformer
  }
  // Default to OpenAI for unknown endpoints under /v1/
  return mainTransformers.get('/v1/chat/completions')!
}

/** Get provider transformer by provider name */
export function getProviderTransformer(name: string): ProviderTransformer | null {
  return providerTransformers.get(name) ?? providerTransformers.get('openai') ?? null
}

/** Register a custom main transformer at runtime */
export function registerMainTransformer(t: MainTransformer): void {
  registerMain(t)
}

/** Register a custom provider transformer at runtime */
export function registerProviderTransformer(t: ProviderTransformer): void {
  registerProvider(t)
}

// ── Exports ──

export { OpenAIMainTransformer, OpenAIProviderTransformer, AnthropicMainTransformer, AnthropicProviderTransformer }
export type {
  MainTransformer, ProviderTransformer,
  UnifiedChatRequest, UnifiedMessage, UnifiedTool, UnifiedContent,
  ProviderConfig, ProviderRequest, TransformContext,
} from './base.js'
