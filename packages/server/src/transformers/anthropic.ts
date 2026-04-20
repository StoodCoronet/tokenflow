import type { MainTransformer, UnifiedChatRequest, UnifiedMessage, UnifiedTool, TransformContext } from './base.js'

/**
 * Anthropic main transformer.
 * Converts between Anthropic API format (client) and UnifiedChatRequest (IR).
 * Reference: CCR anthropic.transformer.ts
 */
export class AnthropicMainTransformer implements MainTransformer {
  name = 'anthropic'
  endPoint = '/v1/messages'

  // ── Anthropic request → IR ──

  async transformRequestOut(body: unknown): Promise<UnifiedChatRequest> {
    const request = body as any
    const messages: UnifiedMessage[] = []

    // system field → system message
    if (request.system) {
      if (typeof request.system === 'string') {
        messages.push({ role: 'system', content: request.system })
      } else if (Array.isArray(request.system) && request.system.length) {
        const textParts = request.system
          .filter((item: any) => item.type === 'text' && item.text)
          .map((item: any) => ({ type: 'text' as const, text: item.text, cache_control: item.cache_control }))
        messages.push({ role: 'system', content: textParts })
      }
    }

    // process messages
    for (const msg of request.messages || []) {
      if (typeof msg.content === 'string') {
        messages.push({ role: msg.role, content: msg.content })
        continue
      }

      if (Array.isArray(msg.content)) {
        if (msg.role === 'user') {
          // tool_result → tool message
          const toolParts = msg.content.filter((c: any) => c.type === 'tool_result' && c.tool_use_id)
          for (const tool of toolParts) {
            messages.push({
              role: 'tool',
              content: typeof tool.content === 'string' ? tool.content : JSON.stringify(tool.content),
              tool_call_id: tool.tool_use_id,
            })
          }

          // text + image parts
          const textAndMedia = msg.content.filter(
            (c: any) => (c.type === 'text' && c.text) || (c.type === 'image' && c.source),
          )
          if (textAndMedia.length) {
            messages.push({
              role: 'user',
              content: textAndMedia.map((part: any) => {
                if (part.type === 'image') {
                  const url = part.source?.type === 'base64'
                    ? `data:${part.source.media_type};base64,${part.source.data}`
                    : part.source.url
                  return { type: 'image_url' as const, image_url: { url }, media_type: part.source.media_type }
                }
                return part
              }),
            })
          }
        } else if (msg.role === 'assistant') {
          const assistantMsg: UnifiedMessage = { role: 'assistant', content: '' }

          const textParts = msg.content.filter((c: any) => c.type === 'text' && c.text)
          if (textParts.length) {
            assistantMsg.content = textParts.map((t: any) => t.text).join('\n')
          }

          const toolUseParts = msg.content.filter((c: any) => c.type === 'tool_use' && c.id)
          if (toolUseParts.length) {
            assistantMsg.tool_calls = toolUseParts.map((tool: any) => ({
              id: tool.id,
              type: 'function' as const,
              function: { name: tool.name, arguments: JSON.stringify(tool.input || {}) },
            }))
          }

          const thinkingPart = msg.content.find((c: any) => c.type === 'thinking' && c.signature)
          if (thinkingPart) {
            assistantMsg.thinking = { content: thinkingPart.thinking, signature: thinkingPart.signature }
          }

          messages.push(assistantMsg)
        }
        continue
      }

      messages.push({ role: msg.role, content: msg.content })
    }

    const result: UnifiedChatRequest = {
      messages,
      model: request.model,
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      stream: request.stream,
      tools: request.tools?.length ? this.convertToolsToUnified(request.tools) : undefined,
      tool_choice: undefined,
    }

    if (request.tool_choice) {
      if (request.tool_choice.type === 'tool') {
        result.tool_choice = { type: 'function', function: { name: request.tool_choice.name } }
      } else {
        result.tool_choice = request.tool_choice.type
      }
    }

    return result
  }

  // ── IR response → Anthropic response ──

  async transformResponseIn(response: Response, context: TransformContext): Promise<Response> {
    const isStream = response.headers.get('Content-Type')?.includes('text/event-stream')

    if (isStream && response.body) {
      const convertedStream = this.convertOpenAIStreamToAnthropic(response.body)
      return new Response(convertedStream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
      })
    }

    const data = await response.json() as any
    const converted = this.convertResponseToAnthropic(data)
    return new Response(JSON.stringify(converted), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── Private helpers ──

  private convertToolsToUnified(tools: any[]): UnifiedTool[] {
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description || '',
        parameters: tool.input_schema,
      },
    }))
  }

  private convertResponseToAnthropic(openai: any): any {
    const choice = openai.choices?.[0]
    if (!choice) throw new Error('No choices in OpenAI response')

    const content: any[] = []

    if (choice.message?.content) {
      content.push({ type: 'text', text: choice.message.content })
    }

    if (choice.message?.tool_calls?.length) {
      for (const tc of choice.message.tool_calls) {
        let parsedInput = {}
        try {
          parsedInput = typeof tc.function.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : tc.function.arguments || {}
        } catch {
          parsedInput = { text: tc.function.arguments || '' }
        }
        content.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input: parsedInput })
      }
    }

    if (choice.message?.thinking?.content) {
      content.push({
        type: 'thinking',
        thinking: choice.message.thinking.content,
        signature: choice.message.thinking.signature,
      })
    }

    const stopReasonMap: Record<string, string> = {
      stop: 'end_turn',
      length: 'max_tokens',
      tool_calls: 'tool_use',
      content_filter: 'stop_sequence',
    }

    return {
      id: openai.id || `msg_${Date.now()}`,
      type: 'message',
      role: 'assistant',
      model: openai.model,
      content,
      stop_reason: stopReasonMap[choice.finish_reason] || 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: (openai.usage?.prompt_tokens || 0) - (openai.usage?.prompt_tokens_details?.cached_tokens || 0),
        output_tokens: openai.usage?.completion_tokens || 0,
        cache_read_input_tokens: openai.usage?.prompt_tokens_details?.cached_tokens || 0,
      },
    }
  }

  private convertOpenAIStreamToAnthropic(openaiStream: ReadableStream): ReadableStream {
    const encoder = new TextEncoder()
    const messageId = `msg_${Date.now()}`
    let model = 'unknown'
    let hasStarted = false
    let hasTextContentStarted = false
    let isThinkingStarted = false
    let contentIndex = 0
    let currentContentBlockIndex = -1
    let isClosed = false
    let stopReasonDelta: Record<string, any> | null = null
    const toolCalls = new Map<number, { id: string; name: string; arguments: string; blockIndex: number }>()
    const toolCallIndexMap = new Map<number, number>()

    const assignIndex = (): number => contentIndex++

    const enqueue = (data: string) => {
      if (!isClosed) chunks.push(encoder.encode(data))
    }

    const chunks: Uint8Array[] = []

    return new ReadableStream({
      async start(controller) {
        const reader = openaiStream.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (isClosed) break
              if (!line.startsWith('data:')) continue
              const data = line.slice(5).trim()
              if (data === '[DONE]') continue

              let chunk: any
              try { chunk = JSON.parse(data) } catch { continue }

              model = chunk.model || model

              // message_start
              if (!hasStarted) {
                hasStarted = true
                enqueue(`event: message_start\ndata: ${JSON.stringify({
                  type: 'message_start',
                  message: {
                    id: messageId, type: 'message', role: 'assistant', content: [],
                    model, stop_reason: null, stop_sequence: null,
                    usage: { input_tokens: 0, output_tokens: 0 },
                  },
                })}\n\n`)
              }

              // usage from chunk
              if (chunk.usage) {
                stopReasonDelta = {
                  type: 'message_delta',
                  delta: { stop_reason: 'end_turn', stop_sequence: null },
                  usage: {
                    input_tokens: (chunk.usage.prompt_tokens || 0) - (chunk.usage.prompt_tokens_details?.cached_tokens || 0),
                    output_tokens: chunk.usage.completion_tokens || 0,
                    cache_read_input_tokens: chunk.usage.prompt_tokens_details?.cached_tokens || 0,
                  },
                }
              }

              const choice = chunk.choices?.[0]
              if (!choice) continue

              // thinking
              if (choice.delta?.thinking) {
                if (!isThinkingStarted) {
                  const idx = assignIndex()
                  enqueue(`event: content_block_start\ndata: ${JSON.stringify({
                    type: 'content_block_start', index: idx,
                    content_block: { type: 'thinking', thinking: '' },
                  })}\n\n`)
                  currentContentBlockIndex = idx
                  isThinkingStarted = true
                }
                if (choice.delta.thinking.signature) {
                  enqueue(`event: content_block_delta\ndata: ${JSON.stringify({
                    type: 'content_block_delta', index: currentContentBlockIndex,
                    delta: { type: 'signature_delta', signature: choice.delta.thinking.signature },
                  })}\n\n`)
                  enqueue(`event: content_block_stop\ndata: ${JSON.stringify({ type: 'content_block_stop', index: currentContentBlockIndex })}\n\n`)
                  currentContentBlockIndex = -1
                } else if (choice.delta.thinking.content) {
                  enqueue(`event: content_block_delta\ndata: ${JSON.stringify({
                    type: 'content_block_delta', index: currentContentBlockIndex,
                    delta: { type: 'thinking_delta', thinking: choice.delta.thinking.content },
                  })}\n\n`)
                }
              }

              // text content
              if (choice.delta?.content) {
                if (currentContentBlockIndex >= 0 && !hasTextContentStarted) {
                  enqueue(`event: content_block_stop\ndata: ${JSON.stringify({ type: 'content_block_stop', index: currentContentBlockIndex })}\n\n`)
                  currentContentBlockIndex = -1
                }
                if (!hasTextContentStarted) {
                  hasTextContentStarted = true
                  const idx = assignIndex()
                  enqueue(`event: content_block_start\ndata: ${JSON.stringify({
                    type: 'content_block_start', index: idx,
                    content_block: { type: 'text', text: '' },
                  })}\n\n`)
                  currentContentBlockIndex = idx
                }
                enqueue(`event: content_block_delta\ndata: ${JSON.stringify({
                  type: 'content_block_delta', index: currentContentBlockIndex,
                  delta: { type: 'text_delta', text: choice.delta.content },
                })}\n\n`)
              }

              // tool calls
              if (choice.delta?.tool_calls) {
                for (const tc of choice.delta.tool_calls) {
                  const tcIndex = tc.index ?? 0
                  if (!toolCallIndexMap.has(tcIndex)) {
                    if (currentContentBlockIndex >= 0) {
                      enqueue(`event: content_block_stop\ndata: ${JSON.stringify({ type: 'content_block_stop', index: currentContentBlockIndex })}\n\n`)
                      currentContentBlockIndex = -1
                    }
                    const blockIdx = assignIndex()
                    toolCallIndexMap.set(tcIndex, blockIdx)
                    const tcId = tc.id || `call_${Date.now()}_${tcIndex}`
                    const tcName = tc.function?.name || `tool_${tcIndex}`
                    toolCalls.set(tcIndex, { id: tcId, name: tcName, arguments: '', blockIndex: blockIdx })
                    enqueue(`event: content_block_start\ndata: ${JSON.stringify({
                      type: 'content_block_start', index: blockIdx,
                      content_block: { type: 'tool_use', id: tcId, name: tcName, input: {} },
                    })}\n\n`)
                    currentContentBlockIndex = blockIdx
                  }
                  if (tc.function?.arguments) {
                    const existing = toolCalls.get(tcIndex)
                    if (existing) existing.arguments += tc.function.arguments
                    const blockIdx = toolCallIndexMap.get(tcIndex)!
                    enqueue(`event: content_block_delta\ndata: ${JSON.stringify({
                      type: 'content_block_delta', index: blockIdx,
                      delta: { type: 'input_json_delta', partial_json: tc.function.arguments },
                    })}\n\n`)
                  }
                }
              }

              // finish
              if (choice.finish_reason) {
                if (currentContentBlockIndex >= 0) {
                  enqueue(`event: content_block_stop\ndata: ${JSON.stringify({ type: 'content_block_stop', index: currentContentBlockIndex })}\n\n`)
                  currentContentBlockIndex = -1
                }
                const stopMap: Record<string, string> = { stop: 'end_turn', length: 'max_tokens', tool_calls: 'tool_use', content_filter: 'stop_sequence' }
                stopReasonDelta = {
                  type: 'message_delta',
                  delta: { stop_reason: stopMap[choice.finish_reason] || 'end_turn', stop_sequence: null },
                  usage: stopReasonDelta?.usage || { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0 },
                }
                break
              }
            }
          }

          // finalize
          if (stopReasonDelta) {
            enqueue(`event: message_delta\ndata: ${JSON.stringify(stopReasonDelta)}\n\n`)
          }
          enqueue(`event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n\n`)

          for (const chunk of chunks) controller.enqueue(chunk)
          controller.close()
          isClosed = true
        } catch (err) {
          if (!isClosed) { controller.error(err); isClosed = true }
        } finally {
          reader.releaseLock()
        }
      },
    })
  }
}
