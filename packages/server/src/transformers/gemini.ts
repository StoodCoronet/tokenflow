import type { ProviderTransformer, UnifiedChatRequest, ProviderRequest, TransformContext } from './base.js'

/**
 * Gemini provider transformer.
 * Converts between IR (OpenAI) and Gemini native API format.
 */
export class GeminiProviderTransformer implements ProviderTransformer {
  name = 'gemini'

  async transformRequestIn(request: UnifiedChatRequest, context: TransformContext): Promise<ProviderRequest> {
    const base = context.provider.api_base_url.replace(/\/$/, '')
    const action = request.stream ? 'streamGenerateContent?alt=sse' : 'generateContent'
    const url = `${base}/v1beta/models/${request.model}:${action}`

    const contents: any[] = []
    const toolResponses = request.messages.filter((m) => m.role === 'tool')

    for (const message of request.messages) {
      if (message.role === 'tool') continue

      let role: 'user' | 'model'
      if (message.role === 'assistant') {
        role = 'model'
      } else {
        role = 'user'
      }

      const parts: any[] = []

      if (typeof message.content === 'string') {
        parts.push({ text: message.content })
      } else if (Array.isArray(message.content)) {
        for (const item of message.content) {
          if (item.type === 'text') {
            parts.push({ text: item.text || '' })
          } else if (item.type === 'image_url') {
            const url = item.image_url?.url || ''
            if (url.startsWith('http')) {
              parts.push({ file_data: { mime_type: item.media_type, file_uri: url } })
            } else {
              const data = url.split(',').pop() || url
              parts.push({ inlineData: { mime_type: item.media_type, data } })
            }
          }
        }
      }

      if (message.tool_calls?.length) {
        for (const tc of message.tool_calls) {
          parts.push({
            functionCall: {
              id: tc.id || `tool_${Math.random().toString(36).substring(2, 15)}`,
              name: tc.function.name,
              args: JSON.parse(tc.function.arguments || '{}'),
            },
          })
        }
      }

      if (parts.length === 0) {
        parts.push({ text: '' })
      }

      contents.push({ role, parts })

      if (role === 'model' && message.tool_calls) {
        const functionResponses = message.tool_calls.map((tc) => {
          const resp = toolResponses.find((r) => r.tool_call_id === tc.id)
          return {
            functionResponse: {
              name: tc.function.name,
              response: { result: resp?.content },
            },
          }
        })
        contents.push({ role: 'user', parts: functionResponses })
      }
    }

    const tools: any[] = []
    if (request.tools?.length) {
      const functionDeclarations = request.tools
        .filter((t) => t.function.name !== 'web_search')
        .map((t) => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        }))
      if (functionDeclarations.length) {
        tools.push({ functionDeclarations })
      }
      if (request.tools.some((t) => t.function.name === 'web_search')) {
        tools.push({ googleSearch: {} })
      }
    }

    const generationConfig: any = {}
    if (request.temperature !== undefined) generationConfig.temperature = request.temperature
    if (request.max_tokens !== undefined) generationConfig.maxOutputTokens = request.max_tokens

    const body: any = { contents, generationConfig }
    if (tools.length) body.tools = tools

    if (request.tool_choice) {
      const toolConfig: any = { functionCallingConfig: {} }
      if (request.tool_choice === 'auto') {
        toolConfig.functionCallingConfig.mode = 'AUTO'
      } else if (request.tool_choice === 'none') {
        toolConfig.functionCallingConfig.mode = 'NONE'
      } else if (request.tool_choice === 'required') {
        toolConfig.functionCallingConfig.mode = 'ANY'
      } else if (typeof request.tool_choice === 'object' && request.tool_choice.function?.name) {
        toolConfig.functionCallingConfig.mode = 'ANY'
        toolConfig.functionCallingConfig.allowedFunctionNames = [request.tool_choice.function.name]
      }
      body.toolConfig = toolConfig
    }

    return {
      url,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': context.provider.api_key,
      },
      body,
    }
  }

  async transformResponseOut(response: Response): Promise<Response> {
    const contentType = response.headers.get('Content-Type') || ''

    if (contentType.includes('application/json')) {
      const json = await response.json()
      const candidate = json.candidates?.[0]
      const parts = candidate?.content?.parts || []

      const textContent = parts
        .filter((p: any) => p.text && !p.thought)
        .map((p: any) => p.text)
        .join('')

      const tool_calls = parts
        .filter((p: any) => p.functionCall)
        .map((p: any) => ({
          id: p.functionCall.id || `tool_${Math.random().toString(36).substring(2, 15)}`,
          type: 'function',
          function: {
            name: p.functionCall.name,
            arguments: JSON.stringify(p.functionCall.args || {}),
          },
        }))

      const res = {
        id: json.responseId || `gemini-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: json.modelVersion || '',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: textContent || null,
            tool_calls: tool_calls.length > 0 ? tool_calls : undefined,
          },
          finish_reason: (candidate?.finishReason as string)?.toLowerCase() || 'stop',
        }],
        usage: {
          prompt_tokens: json.usageMetadata?.promptTokenCount || 0,
          completion_tokens: json.usageMetadata?.candidatesTokenCount || 0,
          total_tokens: json.usageMetadata?.totalTokenCount || 0,
        },
      }

      return new Response(JSON.stringify(res), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      })
    }

    if (contentType.includes('stream') && response.body) {
      const decoder = new TextDecoder()
      const encoder = new TextEncoder()
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
                if (!line.startsWith('data: ')) {
                  controller.enqueue(encoder.encode(line + '\n'))
                  continue
                }

                try {
                  const chunk = JSON.parse(line.slice(6))
                  const candidate = chunk.candidates?.[0]
                  const parts = candidate?.content?.parts || []

                  const textContent = parts
                    .filter((p: any) => p.text && !p.thought)
                    .map((p: any) => p.text)
                    .join('')

                  const tool_calls = parts
                    .filter((p: any) => p.functionCall)
                    .map((p: any) => ({
                      id: p.functionCall.id || `tool_${Math.random().toString(36).substring(2, 15)}`,
                      type: 'function',
                      function: {
                        name: p.functionCall.name,
                        arguments: JSON.stringify(p.functionCall.args || {}),
                      },
                    }))

                  const delta: any = { role: 'assistant' }
                  if (textContent) delta.content = textContent
                  if (tool_calls.length) delta.tool_calls = tool_calls

                  const res = {
                    id: chunk.responseId || `gemini-${Date.now()}`,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: chunk.modelVersion || '',
                    choices: [{
                      index: 0,
                      delta,
                      finish_reason: candidate?.finishReason?.toLowerCase() || null,
                    }],
                  }

                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(res)}\n\n`))
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
        headers: response.headers,
      })
    }

    return response
  }
}
