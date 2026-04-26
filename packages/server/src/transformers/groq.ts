import { generateId } from '@tokenflow/shared'
import type { ProviderTransformer, UnifiedChatRequest, ProviderRequest, TransformContext } from './base.js'

/**
 * Groq provider transformer.
 * OpenAI-compatible with cache_control / $schema stripping and stream error handling.
 */
export class GroqProviderTransformer implements ProviderTransformer {
  name = 'groq'

  async transformRequestIn(request: UnifiedChatRequest, context: TransformContext): Promise<ProviderRequest> {
    const messages = request.messages.map((msg) => {
      if (Array.isArray(msg.content)) {
        return {
          ...msg,
          content: msg.content.map((item: any) => {
            const clone = { ...item }
            delete clone.cache_control
            return clone
          }),
        }
      }
      const clone = { ...msg }
      delete (clone as any).cache_control
      return clone
    })

    const tools = request.tools?.map((tool) => {
      const clone = JSON.parse(JSON.stringify(tool))
      if (clone.function?.parameters?.$schema) {
        delete clone.function.parameters.$schema
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

    if (tools) body.tools = tools
    if (request.tool_choice) body.tool_choice = request.tool_choice

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

                  if (data.error) {
                    throw new Error(JSON.stringify(data.error))
                  }

                  if (data.choices?.[0]?.delta?.content && !hasTextContent) {
                    hasTextContent = true
                  }

                  if (data.choices?.[0]?.delta?.tool_calls?.length) {
                    data.choices[0].delta.tool_calls.forEach((tool: any) => {
                      if (!Number.isNaN(parseInt(tool.id, 10))) {
                        tool.id = `call_${generateId()}`
                      }
                    })
                  }

                  if (data.choices?.[0]?.delta?.tool_calls?.length && hasTextContent) {
                    if (typeof data.choices[0].index === 'number') {
                      data.choices[0].index += 1
                    } else {
                      data.choices[0].index = 1
                    }
                  }

                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
                } catch (e) {
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
