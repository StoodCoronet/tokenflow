import type { Transformer, InternalRequest, ProviderRequest, TransformContext } from './base.js'

/**
 * 智谱 GLM (ChatGLM/Zhipu AI) transformer.
 * GLM supports OpenAI-compatible endpoint at /v4/chat/completions.
 */
export class ZhipuTransformer implements Transformer {
  name = 'zhipu'
  endPoint = '/v4/chat/completions'

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
