import type { Transformer, InternalRequest, ProviderRequest, TransformContext } from './base.js'

/**
 * MiniMax transformer.
 * MiniMax supports OpenAI-compatible endpoint at /v1/text/chatcompletion_v2.
 */
export class MiniMaxTransformer implements Transformer {
  name = 'minimax'
  endPoint = '/v1/text/chatcompletion_v2'

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
