import type { MainTransformer, ProviderTransformer, UnifiedChatRequest, ProviderRequest, TransformContext } from './base.js'

/** OpenAI main transformer — passthrough since IR IS OpenAI format. */
export class OpenAIMainTransformer implements MainTransformer {
  name = 'openai'
  endPoint = '/v1/chat/completions'

  async transformRequestOut(body: unknown): Promise<UnifiedChatRequest> {
    return body as UnifiedChatRequest
  }

  async transformResponseIn(response: Response): Promise<Response> {
    return response
  }
}

/** OpenAI provider transformer — passthrough with endpoint/headers construction. */
export class OpenAIProviderTransformer implements ProviderTransformer {
  name = 'openai'

  async transformRequestIn(request: UnifiedChatRequest, context: TransformContext): Promise<ProviderRequest> {
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

    const base = context.provider.api_base_url.replace(/\/$/, '')
    const url = base.endsWith('/v1') ? `${base}/chat/completions` : `${base}/v1/chat/completions`

    return {
      url,
      headers,
      body,
    }
  }

  async transformResponseOut(response: Response): Promise<Response> {
    return response
  }
}
