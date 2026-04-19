import type { Transformer } from './base.js'
import { OpenAITransformer } from './openai.js'
import { AnthropicTransformer } from './anthropic.js'
import { DashScopeTransformer } from './dashscope.js'
import { MiniMaxTransformer } from './minimax.js'
import { ZhipuTransformer } from './zhipu.js'
import { MoonshotTransformer } from './moonshot.js'

const registry = new Map<string, Transformer>()

function register(t: Transformer) {
  registry.set(t.name, t)
}

// Register built-in transformers
register(new OpenAITransformer())
register(new AnthropicTransformer())
register(new DashScopeTransformer())
register(new MiniMaxTransformer())
register(new ZhipuTransformer())
register(new MoonshotTransformer())

/** Get transformer by provider name */
export function getTransformer(name: string): Transformer | null {
  return registry.get(name) ?? null
}

/** Register a custom transformer at runtime */
export function registerTransformer(t: Transformer): void {
  register(t)
}

/** Get all registered transformers */
export function getAllTransformers(): Map<string, Transformer> {
  return new Map(registry)
}

export { OpenAITransformer, AnthropicTransformer, DashScopeTransformer, MiniMaxTransformer, ZhipuTransformer, MoonshotTransformer }
export type { Transformer, InternalRequest, ProviderRequest, InternalResponse, ProviderConfig, TransformContext } from './base.js'
