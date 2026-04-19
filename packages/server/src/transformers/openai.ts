import type { Transformer, InternalRequest, ProviderRequest, ProviderConfig, TransformContext } from './base.js'

/**
 * OpenAI transformer — pass-through since OpenAI format IS the internal format.
 */
export class OpenAITransformer implements Transformer {
  name = 'openai'
  endPoint = '/v1/chat/completions'

  async transformRequestIn(body: unknown): Promise<InternalRequest> {
    return body as InternalRequest
  }

  async transformRequestOut(request: InternalRequest, context: TransformContext): Promise<ProviderRequest> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${context.provider.api_key}`,
    }

    const body: any = {
      model: request.model,
      messages: request.messages,
      stream: request.stream,
      temperature: request.temperature,
      max_tokens: request.max_tokens,
    }
    if (request.tools) body.tools = request.tools
    if (request.tool_choice) body.tool_choice = request.tool_choice

    return {
      url: `${context.provider.api_base_url}${this.endPoint}`,
      headers,
      body,
    }
  }
}
