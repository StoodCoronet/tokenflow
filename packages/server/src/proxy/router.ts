import type { AppConfig, RouterConfig } from '@tokenflow/shared'
import type { InternalRequest } from '../transformers/base.js'

export interface RouteResult {
  providerName: string
  model: string
  scenario: string
}

/**
 * Smart router — selects the best provider+model based on request content.
 * Only active when Router.enabled is true.
 */
export function resolveRoute(request: InternalRequest, config: AppConfig): RouteResult | null {
  if (!config.Router.enabled) return null

  const router = config.Router

  // Parse default route
  if (!router.default) return null
  const [defaultProvider, defaultModel] = router.default.split(',')

  // Start with default
  let result: RouteResult = {
    providerName: defaultProvider,
    model: defaultModel,
    scenario: 'default',
  }

  // Check long context
  if (router.longContext) {
    const tokenEstimate = estimateTokens(request.messages)
    if (tokenEstimate > router.longContext.threshold) {
      result = {
        providerName: router.longContext.provider,
        model: router.longContext.model,
        scenario: 'longContext',
      }
    }
  }

  // Check if model is explicitly specified and available
  if (request.model) {
    // Find which provider has this model
    for (const provider of config.Providers) {
      if (provider.models.includes(request.model)) {
        // Use explicit model, but apply routing scenario
        return {
          ...result,
          model: request.model,
          providerName: result.providerName,
        }
      }
    }
  }

  return result
}

/**
 * Rough token estimation from messages.
 * ~4 chars per token for English, ~2 chars per token for CJK.
 */
function estimateTokens(messages: Array<{ role: string; content: string }>): number {
  let chars = 0
  for (const msg of messages) {
    chars += msg.content.length
  }
  // Rough estimate: ~3.5 chars per token mixed content
  return Math.round(chars / 3.5)
}
