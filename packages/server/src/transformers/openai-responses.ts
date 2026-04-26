import type { ProviderTransformer, UnifiedChatRequest, ProviderRequest, TransformContext } from './base.js'

/**
 * OpenAI Responses API provider transformer.
 * Converts between IR (OpenAI chat.completion) and OpenAI Responses API format.
 */
export class OpenAIResponsesProviderTransformer implements ProviderTransformer {
  name = 'openai-responses'

  async transformRequestIn(request: UnifiedChatRequest, context: TransformContext): Promise<ProviderRequest> {
    const body: any = {
      model: request.model,
      stream: request.stream,
    }

    if (request.reasoning) {
      body.reasoning = {
        effort: request.reasoning.effort,
        summary: 'detailed',
      }
    }

    const input: any[] = []

    const systemMessages = request.messages.filter((msg) => msg.role === 'system')
    if (systemMessages.length > 0) {
      const firstSystem = systemMessages[0]
      if (Array.isArray(firstSystem.content)) {
        firstSystem.content.forEach((item: any) => {
          const text = typeof item === 'string' ? item : item?.text || ''
          input.push({ role: 'system', content: text })
        })
      } else if (typeof firstSystem.content === 'string') {
        body.instructions = firstSystem.content
      }
    }

    for (const message of request.messages) {
      if (message.role === 'system') continue

      if (Array.isArray(message.content)) {
        const converted = message.content
          .map((content) => this.normalizeRequestContent(content, message.role))
          .filter((c): c is Record<string, unknown> => c !== null)
        if (converted.length > 0) {
          ;(message as any).content = converted
        } else {
          delete (message as any).content
        }
      }

      if (message.role === 'tool') {
        input.push({
          type: 'function_call_output',
          call_id: message.tool_call_id,
          output: message.content,
        })
        continue
      }

      if (message.role === 'assistant' && message.tool_calls?.length) {
        for (const tool of message.tool_calls) {
          input.push({
            type: 'function_call',
            arguments: tool.function.arguments,
            name: tool.function.name,
            call_id: tool.id,
          })
        }
        continue
      }

      input.push(message)
    }

    body.input = input

    if (request.tools?.length) {
      const webSearch = request.tools.find((tool) => tool.function.name === 'web_search')
      body.tools = request.tools
        .filter((tool) => tool.function.name !== 'web_search')
        .map((tool) => ({
          type: tool.type,
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters,
          strict: true,
        }))
      if (webSearch) {
        body.tools.push({ type: 'web_search' })
      }
    }

    body.parallel_tool_calls = false

    const base = context.provider.api_base_url.replace(/\/$/, '')
    const url = base.endsWith('/v1') ? `${base}/responses` : `${base}/v1/responses`

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
      const json = await response.json()
      if (json.object === 'response' && json.output) {
        const chatResponse = this.convertResponseToChat(json)
        return new Response(JSON.stringify(chatResponse), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        })
      }
      return response
    }

    if (contentType.includes('stream') && response.body) {
      const decoder = new TextDecoder()
      const encoder = new TextEncoder()
      let buffer = ''
      let isStreamEnded = false
      let currentIndex = -1
      let lastEventType = ''

      const getCurrentIndex = (eventType: string) => {
        if (eventType !== lastEventType) {
          currentIndex++
          lastEventType = eventType
        }
        return currentIndex
      }

      const stream = new ReadableStream({
        async start(controller) {
          const reader = response.body!.getReader()

          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) {
                if (!isStreamEnded) {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                }
                break
              }

              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split(/\r?\n/)
              buffer = lines.pop() || ''

              for (const line of lines) {
                if (!line.trim()) continue
                if (line.startsWith('event: ')) continue
                if (!line.startsWith('data: ')) {
                  controller.enqueue(encoder.encode(line + '\n'))
                  continue
                }

                const dataStr = line.slice(6).trim()
                if (dataStr === '[DONE]') {
                  isStreamEnded = true
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                  continue
                }

                try {
                  const data = JSON.parse(dataStr)

                  if (data.type === 'response.output_text.delta') {
                    const chatChunk = {
                      id: data.item_id || `chatcmpl-${Date.now()}`,
                      object: 'chat.completion.chunk',
                      created: Math.floor(Date.now() / 1000),
                      model: data.response?.model,
                      choices: [{
                        index: getCurrentIndex(data.type),
                        delta: { content: data.delta || '' },
                        finish_reason: null,
                      }],
                    }
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(chatChunk)}\n\n`))
                  } else if (data.type === 'response.output_item.added' && data.item?.type === 'function_call') {
                    const functionCallChunk = {
                      id: data.item.call_id || data.item.id || `chatcmpl-${Date.now()}`,
                      object: 'chat.completion.chunk',
                      created: Math.floor(Date.now() / 1000),
                      model: data.response?.model || '',
                      choices: [{
                        index: getCurrentIndex(data.type),
                        delta: {
                          role: 'assistant',
                          tool_calls: [{
                            index: 0,
                            id: data.item.call_id || data.item.id,
                            function: { name: data.item.name || '', arguments: '' },
                            type: 'function',
                          }],
                        },
                        finish_reason: null,
                      }],
                    }
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(functionCallChunk)}\n\n`))
                  } else if (data.type === 'response.function_call_arguments.delta') {
                    const functionCallChunk = {
                      id: data.item_id || `chatcmpl-${Date.now()}`,
                      object: 'chat.completion.chunk',
                      created: Math.floor(Date.now() / 1000),
                      model: data.response?.model || '',
                      choices: [{
                        index: getCurrentIndex(data.type),
                        delta: {
                          tool_calls: [{
                            index: 0,
                            function: { arguments: data.delta || '' },
                          }],
                        },
                        finish_reason: null,
                      }],
                    }
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(functionCallChunk)}\n\n`))
                  } else if (data.type === 'response.completed') {
                    const hasFunctionCall = data.response?.output?.some((item: any) => item.type === 'function_call')
                    const endChunk = {
                      id: data.response?.id || `chatcmpl-${Date.now()}`,
                      object: 'chat.completion.chunk',
                      created: Math.floor(Date.now() / 1000),
                      model: data.response?.model || '',
                      choices: [{
                        index: 0,
                        delta: {},
                        finish_reason: hasFunctionCall ? 'tool_calls' : 'stop',
                      }],
                    }
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(endChunk)}\n\n`))
                    isStreamEnded = true
                  } else if (data.type === 'response.reasoning_summary_text.delta') {
                    const thinkingChunk = {
                      id: data.item_id || `chatcmpl-${Date.now()}`,
                      object: 'chat.completion.chunk',
                      created: Math.floor(Date.now() / 1000),
                      model: data.response?.model,
                      choices: [{
                        index: getCurrentIndex(data.type),
                        delta: {
                          thinking: { content: data.delta || '' },
                        },
                        finish_reason: null,
                      }],
                    }
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(thinkingChunk)}\n\n`))
                  } else if (data.type === 'response.reasoning_summary_part.done' && data.part) {
                    const thinkingChunk = {
                      id: data.item_id || `chatcmpl-${Date.now()}`,
                      object: 'chat.completion.chunk',
                      created: Math.floor(Date.now() / 1000),
                      model: data.response?.model,
                      choices: [{
                        index: currentIndex,
                        delta: {
                          thinking: { signature: data.item_id },
                        },
                        finish_reason: null,
                      }],
                    }
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(thinkingChunk)}\n\n`))
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

  private normalizeRequestContent(content: any, role: string | undefined): Record<string, unknown> | null {
    const clone = { ...content }
    delete clone.cache_control

    if (content.type === 'text') {
      return { type: role === 'assistant' ? 'output_text' : 'input_text', text: content.text }
    }

    if (content.type === 'image_url') {
      const payload: Record<string, unknown> = { type: role === 'assistant' ? 'output_image' : 'input_image' }
      if (typeof content.image_url?.url === 'string') {
        payload.image_url = content.image_url.url
      }
      return payload
    }

    return null
  }

  private convertResponseToChat(responseData: any): any {
    const messageOutput = responseData.output?.find((item: any) => item.type === 'message')
    const functionCallOutput = responseData.output?.find((item: any) => item.type === 'function_call')

    let messageContent: string | any[] | null = null
    let toolCalls = null
    let thinking = null

    if (messageOutput?.reasoning) {
      thinking = { content: messageOutput.reasoning }
    }

    if (messageOutput?.content) {
      const textParts: string[] = []
      for (const item of messageOutput.content) {
        if (item.type === 'output_text') {
          textParts.push(item.text || '')
        }
      }
      messageContent = textParts.join('')
    }

    if (functionCallOutput) {
      toolCalls = [{
        id: functionCallOutput.call_id || functionCallOutput.id,
        function: {
          name: functionCallOutput.name,
          arguments: functionCallOutput.arguments,
        },
        type: 'function',
      }]
    }

    return {
      id: responseData.id || `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: responseData.created_at || Math.floor(Date.now() / 1000),
      model: responseData.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: messageContent || null,
          tool_calls: toolCalls,
          thinking,
        },
        finish_reason: toolCalls ? 'tool_calls' : 'stop',
      }],
      usage: responseData.usage ? {
        prompt_tokens: responseData.usage.input_tokens || 0,
        completion_tokens: responseData.usage.output_tokens || 0,
        total_tokens: responseData.usage.total_tokens || 0,
      } : null,
    }
  }
}
