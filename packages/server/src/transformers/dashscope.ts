import type { Transformer, InternalRequest, ProviderRequest, TransformContext } from './base.js'

/**
 * DashScope (通义千问/Qwen) transformer.
 * DashScope supports OpenAI-compatible endpoint at /compatible-mode/v1/chat/completions.
 */
export class DashScopeTransformer implements Transformer {
  name = 'dashscope'
  endPoint = '/compatible-mode/v1/chat/completions'

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
