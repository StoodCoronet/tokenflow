import type { Transformer, InternalRequest, ProviderRequest, ProviderConfig, TransformContext } from './base.js'

/**
 * Anthropic API format transformer.
 * Converts between OpenAI internal format and Anthropic's API format.
 */
export class AnthropicTransformer implements Transformer {
  name = 'anthropic'
  endPoint = '/v1/messages'

  async transformRequestOut(request: InternalRequest, context: TransformContext): Promise<ProviderRequest> {
    const messages: any[] = []
    let systemContent = ''

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        systemContent += (typeof msg.content === 'string' ? msg.content : '') + '\n'
        continue
      }
      if (msg.role === 'tool') {
        messages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: msg.tool_call_id,
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          }],
        })
        continue
      }
      if (msg.role === 'assistant' && msg.tool_calls?.length) {
        const content: any[] = []
        const text = typeof msg.content === 'string' ? msg.content : ''
        if (text) content.push({ type: 'text', text })
        for (const tc of msg.tool_calls as any[]) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function?.name,
            input: JSON.parse(tc.function?.arguments || '{}'),
          })
        }
        messages.push({ role: 'assistant', content })
        continue
      }
      messages.push({ role: msg.role, content: msg.content })
    }

    const body: any = {
      model: request.model,
      messages,
      max_tokens: request.max_tokens || 4096,
      stream: request.stream,
      temperature: request.temperature,
      anthropic_version: '2023-06-01',
    }
    if (systemContent.trim()) body.system = systemContent.trim()
    if (request.tools?.length) {
      body.tools = (request.tools as any[]).map((t: any) => ({
        name: t.function?.name,
        description: t.function?.description,
        input_schema: t.function?.parameters,
      }))
    }
    if (request.tool_choice) {
      if (typeof request.tool_choice === 'string') {
        body.tool_choice = { type: request.choice }
      } else if ((request.tool_choice as any)?.function) {
        body.tool_choice = { type: 'tool', name: (request.tool_choice as any).function.name }
      }
    }

    return {
      url: `${context.provider.api_base_url}${this.endPoint}`,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': context.provider.api_key,
        'anthropic-version': '2023-06-01',
      },
      body,
    }
  }

  async transformResponseIn(response: Response, context: TransformContext): Promise<Response> {
    const isStream = response.headers.get('Content-Type')?.includes('text/event-stream')
    if (isStream) return response // Stream passthrough for now

    const data = await response.json() as any
    const converted = this.convertResponse(data)
    return new Response(JSON.stringify(converted), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  private convertResponse(r: any): any {
    const content = Array.isArray(r.content)
      ? r.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
      : ''

    const toolCalls = Array.isArray(r.content)
      ? r.content.filter((c: any) => c.type === 'tool_use').map((tc: any) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.input) },
        }))
      : undefined

    return {
      id: r.id,
      object: 'chat.completion',
      model: r.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content,
          ...(toolCalls?.length ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: r.stop_reason === 'tool_use' ? 'tool_calls'
          : r.stop_reason === 'max_tokens' ? 'length'
          : 'stop',
      }],
      usage: {
        prompt_tokens: r.usage?.input_tokens || 0,
        completion_tokens: r.usage?.output_tokens || 0,
        total_tokens: (r.usage?.input_tokens || 0) + (r.usage?.output_tokens || 0),
      },
    }
  }
}
