import type { ProviderTransformer, UnifiedChatRequest, ProviderRequest, TransformContext } from './base.js'

/**
 * Cerebras provider transformer.
 * OpenAI-compatible with reasoning field handling.
 */
export class CerebrasProviderTransformer implements ProviderTransformer {
  name = 'cerebras'

  async transformRequestIn(request: UnifiedChatRequest, context: TransformContext): Promise<ProviderRequest> {
    const body: any = {
      model: request.model,
      messages: request.messages,
      stream: request.stream,
      temperature: request.temperature,
      max_tokens: request.max_tokens,
    }

    if (request.tools) body.tools = request.tools
    if (request.tool_choice) body.tool_choice = request.tool_choice

    if (request.reasoning) {
      delete body.reasoning
    } else {
      body.disable_reasoning = false
    }

    const base = context.provider.api_base_url.replace(/\/$/, '')
    const url = base.endsWith('/v1') ? `${base}/chat/completions` : `${base}/v1/chat/completions`

    return {
      url,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${context.provider.api_key}`,
      },
      body,
    }
  }

  async transformResponseOut(response: Response): Promise<Response> {
    return response
  }
}
