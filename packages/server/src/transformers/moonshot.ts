import type { Transformer, InternalRequest, ProviderRequest, TransformContext } from './base.js'

/**
 * 月之暗面 Kimi (Moonshot AI) transformer.
 * Moonshot uses OpenAI-compatible endpoint at /v1/chat/completions.
 */
export class MoonshotTransformer implements Transformer {
  name = 'moonshot'
  endPoint = '/v1/chat/completions'

  async transformRequestOut(request: InternalRequest, context: TransformContext): Promise<ProviderRequest> {
    return {
      url: `${context.provider.api_base_url}${this.endPoint}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${context.provider.api_key}`,
      },
      body: {
        model: request.model,
        messages: request.messages,
        stream: request.stream,
        temperature: request.temperature,
        max_tokens: request.max_tokens,
        ...(request.tools?.length ? { tools: request.tools } : {}),
      },
    }
  }
}
