import type { Transformer, InternalRequest, ProviderRequest, InternalResponse, ProviderConfig } from './base.js'

/**
 * Anthropic API format transformer.
 * Converts between OpenAI-style internal format and Anthropic's API format.
 */
export class AnthropicTransformer implements Transformer {
  providerName = 'anthropic'

  detect(body: unknown): boolean {
    const b = body as any
    return (
      b?.anthropic_version !== undefined ||
      (Array.isArray(b?.messages) &&
        typeof b?.model === 'string' &&
        b.model.startsWith('claude'))
    )
  }

  transformRequest(body: unknown): InternalRequest {
    const b = body as any
    // Anthropic separates system from messages
    const messages = (b.messages || []).filter((m: any) => m.role !== 'system')
    const systemContent = b.system
      || (b.messages || []).filter((m: any) => m.role === 'system').map((m: any) => m.content).join('\n')
      || ''

    return {
      model: b.model,
      messages,
      stream: b.stream,
      temperature: b.temperature,
      max_tokens: b.max_tokens,
      tools: b.tools,
      _anthropic_system: systemContent,
      _anthropic_version: b.anthropic_version,
    }
  }

  formatRequest(request: InternalRequest, config: ProviderConfig): ProviderRequest {
    const body: any = {
      model: request.model,
      messages: request.messages,
      stream: request.stream,
      temperature: request.temperature,
      max_tokens: request.max_tokens || 4096,
      tools: request.tools,
      anthropic_version: (request as any)._anthropic_version || '2023-06-01',
    }

    // Anthropic uses top-level `system` field
    const system = (request as any)._anthropic_system
    if (system) {
      body.system = system
    }

    return {
      url: `${config.api_base_url}/v1/messages`,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.api_key,
        'anthropic-version': body.anthropic_version,
      },
      body,
    }
  }

  parseResponse(response: unknown): InternalResponse {
    const r = response as any
    const content = Array.isArray(r.content)
      ? r.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
      : ''

    return {
      id: r.id || '',
      model: r.model || '',
      content,
      usage: {
        prompt_tokens: r.usage?.input_tokens || 0,
        completion_tokens: r.usage?.output_tokens || 0,
        total_tokens: (r.usage?.input_tokens || 0) + (r.usage?.output_tokens || 0),
      },
      finish_reason: r.stop_reason || '',
      raw: response,
    }
  }
}
