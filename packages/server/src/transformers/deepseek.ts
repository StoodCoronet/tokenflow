import type { ProviderTransformer, UnifiedChatRequest, ProviderRequest, TransformContext } from './base.js'

/**
 * DeepSeek provider transformer.
 * OpenAI-compatible with max_tokens clamping and reasoning_content stream handling.
 */
export class DeepseekProviderTransformer implements ProviderTransformer {
  name = 'deepseek'

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

    if (body.max_tokens && body.max_tokens > 8192) {
      body.max_tokens = 8192
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

  async transformResponseOut(response: Response, _context: TransformContext): Promise<Response> {
    const contentType = response.headers.get('Content-Type') || ''

    if (contentType.includes('application/json')) {
      return response
    }

    if (contentType.includes('stream') && response.body) {
      const decoder = new TextDecoder()
      const encoder = new TextEncoder()
      let reasoningContent = ''
      let isReasoningComplete = false
      let buffer = ''

      const stream = new ReadableStream({
        async start(controller) {
          const reader = response.body!.getReader()

          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) {
                if (buffer.trim()) {
                  const lines = buffer.split('\n')
                  for (const line of lines) {
                    if (line.trim()) controller.enqueue(encoder.encode(line + '\n'))
                  }
                }
                break
              }

              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''

              for (const line of lines) {
                if (!line.trim()) continue
                if (!line.startsWith('data: ') || line.trim() === 'data: [DONE]') {
                  controller.enqueue(encoder.encode(line + '\n'))
                  continue
                }

                try {
                  const data = JSON.parse(line.slice(6))
                  const delta = data.choices?.[0]?.delta

                  if (delta?.reasoning_content) {
                    reasoningContent += delta.reasoning_content
                    const thinkingChunk = {
                      ...data,
                      choices: [{
                        ...data.choices[0],
                        delta: {
                          ...delta,
                          thinking: { content: delta.reasoning_content },
                        },
                      }],
                    }
                    delete thinkingChunk.choices[0].delta.reasoning_content
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(thinkingChunk)}\n\n`))
                    continue
                  }

                  if (delta?.content && reasoningContent && !isReasoningComplete) {
                    isReasoningComplete = true
                    const signature = Date.now().toString()
                    const thinkingChunk = {
                      ...data,
                      choices: [{
                        ...data.choices[0],
                        delta: {
                          ...delta,
                          content: null,
                          thinking: { content: reasoningContent, signature },
                        },
                      }],
                    }
                    delete thinkingChunk.choices[0].delta.reasoning_content
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(thinkingChunk)}\n\n`))
                  }

                  if (delta?.reasoning_content) {
                    delete delta.reasoning_content
                  }

                  if (delta && Object.keys(delta).length > 0) {
                    if (isReasoningComplete) {
                      data.choices[0].index++
                    }
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
                  }
                } catch {
                  controller.enqueue(encoder.encode(line + '\n'))
                }
              }
            }
          } catch (error) {
            controller.error(error)
          } finally {
            try { reader.releaseLock() } catch {}
            controller.close()
          }
        },
      })

      return new Response(stream, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    return response
  }
}
