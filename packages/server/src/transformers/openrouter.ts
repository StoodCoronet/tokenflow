import { generateId } from '@tokenflow/shared'
import type { ProviderTransformer, UnifiedChatRequest, ProviderRequest, TransformContext } from './base.js'

/**
 * OpenRouter provider transformer.
 * OpenAI-compatible with cache_control stripping (non-Claude),
 * image normalization, and reasoning stream handling.
 */
export class OpenrouterProviderTransformer implements ProviderTransformer {
  name = 'openrouter'

  async transformRequestIn(request: UnifiedChatRequest, context: TransformContext): Promise<ProviderRequest> {
    const isClaude = request.model.includes('claude')

    const messages = request.messages.map((msg) => {
      if (Array.isArray(msg.content)) {
        return {
          ...msg,
          content: msg.content.map((item: any) => {
            const clone = { ...item }

            if (!isClaude) {
              delete clone.cache_control
            }

            if (clone.type === 'image_url') {
              if (!clone.image_url?.url?.startsWith('http')) {
                if (isClaude) {
                  clone.image_url.url = `data:${clone.media_type};base64,${clone.image_url.url}`
                }
              }
              delete clone.media_type
            }

            return clone
          }),
        }
      }

      const clone = { ...msg }
      if (!isClaude) {
        delete (clone as any).cache_control
      }
      return clone
    })

    const body: any = {
      model: request.model,
      messages,
      stream: request.stream,
      temperature: request.temperature,
      max_tokens: request.max_tokens,
    }

    if (request.tools) body.tools = request.tools
    if (request.tool_choice) body.tool_choice = request.tool_choice

    if (context.provider.options) {
      Object.assign(body, context.provider.options)
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
    const contentType = response.headers.get('Content-Type') || ''

    if (contentType.includes('application/json')) {
      return response
    }

    if (contentType.includes('stream') && response.body) {
      const decoder = new TextDecoder()
      const encoder = new TextEncoder()
      let hasTextContent = false
      let reasoningContent = ''
      let isReasoningComplete = false
      let hasToolCall = false
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

                  if (data.usage) {
                    data.choices[0].finish_reason = hasToolCall ? 'tool_calls' : 'stop'
                  }

                  if (data.choices?.[0]?.finish_reason === 'error') {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: data.choices[0].error })}\n\n`))
                    continue
                  }

                  if (data.choices?.[0]?.delta?.content && !hasTextContent) {
                    hasTextContent = true
                  }

                  if (data.choices?.[0]?.delta?.reasoning) {
                    reasoningContent += data.choices[0].delta.reasoning
                    const thinkingChunk = {
                      ...data,
                      choices: [{
                        ...data.choices[0],
                        delta: {
                          ...data.choices[0].delta,
                          thinking: { content: data.choices[0].delta.reasoning },
                        },
                      }],
                    }
                    delete thinkingChunk.choices[0].delta.reasoning
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(thinkingChunk)}\n\n`))
                    continue
                  }

                  if (data.choices?.[0]?.delta?.content && reasoningContent && !isReasoningComplete) {
                    isReasoningComplete = true
                    const signature = Date.now().toString()
                    const thinkingChunk = {
                      ...data,
                      choices: [{
                        ...data.choices[0],
                        delta: {
                          ...data.choices[0].delta,
                          content: null,
                          thinking: { content: reasoningContent, signature },
                        },
                      }],
                    }
                    delete thinkingChunk.choices[0].delta.reasoning
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(thinkingChunk)}\n\n`))
                  }

                  if (data.choices?.[0]?.delta?.reasoning) {
                    delete data.choices[0].delta.reasoning
                  }

                  if (data.choices?.[0]?.delta?.tool_calls?.length) {
                    const firstTool = data.choices[0].delta.tool_calls[0]
                    if (!Number.isNaN(parseInt(firstTool.id, 10))) {
                      data.choices[0].delta.tool_calls.forEach((tool: any) => {
                        tool.id = `call_${generateId()}`
                      })
                    }
                  }

                  if (data.choices?.[0]?.delta?.tool_calls?.length && !hasToolCall) {
                    hasToolCall = true
                  }

                  if (data.choices?.[0]?.delta?.tool_calls?.length && hasTextContent) {
                    if (typeof data.choices[0].index === 'number') {
                      data.choices[0].index += 1
                    } else {
                      data.choices[0].index = 1
                    }
                  }

                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
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
