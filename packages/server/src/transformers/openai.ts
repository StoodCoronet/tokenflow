import type { Transformer, InternalRequest, ProviderRequest, InternalResponse, ProviderConfig } from './base.js'

/**
 * OpenAI API format transformer.
 * This is also the "default" internal format since most LLM APIs follow it.
 */
export class OpenAITransformer implements Transformer {
  providerName = 'openai'

  detect(body: unknown): boolean {
    const b = body as any
    return !!b?.model && Array.isArray(b?.messages)
  }

  transformRequest(body: unknown): InternalRequest {
    return body as InternalRequest
  }

  formatRequest(request: InternalRequest, config: ProviderConfig): ProviderRequest {
    return {
      url: `${config.api_base_url}/v1/chat/completions`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api_key}`,
      },
      body: {
        model: request.model,
        messages: request.messages,
        stream: request.stream,
        temperature: request.temperature,
        max_tokens: request.max_tokens,
        tools: request.tools,
        ...(request.session_id ? { session_id: request.session_id } : {}),
      },
    }
  }

  parseResponse(response: unknown): InternalResponse {
    const r = response as any
    const choice = r.choices?.[0]
    return {
      id: r.id || '',
      model: r.model || '',
      content: choice?.message?.content || '',
      usage: r.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      finish_reason: choice?.finish_reason || '',
      raw: response,
    }
  }
}
