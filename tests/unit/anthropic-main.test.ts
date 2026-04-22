import { describe, it, expect } from 'vitest'
import { AnthropicMainTransformer } from '@tokenflow/server/transformers/anthropic.js'
import {
  anthropicBasicRequest,
  anthropicSystemArrayRequest,
  anthropicWithImageRequest,
  anthropicWithToolsRequest,
  anthropicWithToolChoiceAny,
  anthropicWithToolChoiceNamed,
  anthropicWithToolUse,
  anthropicWithToolResult,
  anthropicWithToolResultError,
  anthropicWithThinking,
  anthropicStreamingRequest,
  anthropicBasicResponse,
  anthropicToolUseResponse,
  anthropicThinkingResponse,
  anthropicBasicStreamEvents,
  anthropicToolUseStreamEvents,
  anthropicThinkingStreamEvents,
} from '../fixtures/anthropic.js'
import { openaiBasicResponse, openaiToolCallsResponse, openaiResponseWithThinking } from '../fixtures/openai.js'

describe('AnthropicMainTransformer', () => {
  const transformer = new AnthropicMainTransformer()

  // ── transformRequestOut: Anthropic → IR ──

  describe('transformRequestOut', () => {
    it('converts system string to system message', async () => {
      const result = await transformer.transformRequestOut(anthropicBasicRequest)

      expect(result.messages[0]).toEqual({
        role: 'system',
        content: 'You are a helpful assistant.',
      })
      expect(result.messages[1]).toEqual({
        role: 'user',
        content: 'Hello!',
      })
      expect(result.model).toBe('claude-sonnet-4-6')
      expect(result.max_tokens).toBe(1024)
      expect(result.temperature).toBe(0.7)
      expect(result.stream).toBe(false)
    })

    it('converts system array to system message with text blocks', async () => {
      const result = await transformer.transformRequestOut(anthropicSystemArrayRequest)

      expect(result.messages[0]).toEqual({
        role: 'system',
        content: [
          { type: 'text', text: 'You are a helpful assistant.' },
          { type: 'text', text: 'Be concise.' },
        ],
      })
    })

    it('converts image content to image_url format', async () => {
      const result = await transformer.transformRequestOut(anthropicWithImageRequest)

      expect(result.messages[0].role).toBe('user')
      const content = result.messages[0].content as any[]
      expect(content[0]).toEqual({ type: 'text', text: 'What is in this image?' })
      expect(content[1].type).toBe('image_url')
      expect(content[1].image_url.url).toMatch(/^data:image\/png;base64,/)
      expect(content[1].media_type).toBe('image/png')
    })

    it('converts tools with input_schema to unified tool format', async () => {
      const result = await transformer.transformRequestOut(anthropicWithToolsRequest)

      expect(result.tools).toHaveLength(1)
      expect(result.tools![0]).toEqual({
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get current weather for a city',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string', description: 'City name' },
              unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
            },
            required: ['location'],
          },
        },
      })
      expect(result.tool_choice).toBe('auto')
    })

    it('preserves tool_choice "any" as-is', async () => {
      const result = await transformer.transformRequestOut(anthropicWithToolChoiceAny)
      expect(result.tool_choice).toBe('any')
    })

    it('converts tool_choice "tool" named to function object', async () => {
      const result = await transformer.transformRequestOut(anthropicWithToolChoiceNamed)
      expect(result.tool_choice).toEqual({
        type: 'function',
        function: { name: 'get_weather' },
      })
    })

    it('converts assistant tool_use to tool_calls', async () => {
      const result = await transformer.transformRequestOut(anthropicWithToolUse)

      const assistantMsg = result.messages[1]
      expect(assistantMsg.role).toBe('assistant')
      expect(assistantMsg.content).toBe('')
      expect(assistantMsg.tool_calls).toEqual([
        {
          id: 'toolu_01T1x1fJ34qAmk2tNTrN7Up6',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"location":"San Francisco, CA","unit":"fahrenheit"}',
          },
        },
      ])
    })

    it('converts tool_result to tool message', async () => {
      const result = await transformer.transformRequestOut(anthropicWithToolResult)

      const toolMsg = result.messages[2]
      expect(toolMsg.role).toBe('tool')
      expect(toolMsg.tool_call_id).toBe('toolu_01T1x1fJ34qAmk2tNTrN7Up6')
      expect(toolMsg.content).toBe('{"temperature": 72, "condition": "sunny"}')
    })

    it('converts tool_result with is_error to tool message', async () => {
      const result = await transformer.transformRequestOut(anthropicWithToolResultError)

      const toolMsg = result.messages[2]
      expect(toolMsg.role).toBe('tool')
      expect(toolMsg.content).toBe('Failed to fetch weather data')
    })

    it('preserves thinking block on assistant message', async () => {
      const result = await transformer.transformRequestOut(anthropicWithThinking)

      const assistantMsg = result.messages[1]
      expect(assistantMsg.role).toBe('assistant')
      expect(assistantMsg.thinking).toEqual({
        content: 'I need to find the greatest common divisor of 48 and 180.',
        signature:
          'EqQBCgIYAhIMRg4VknXW9W7jZ1bNEiC9sBQYj3wKL6z8rOq4JML1sBQYj3wKL6z8rOq4JMIpKqZIznI6Qm5bLg42Y8eOvywS3H8cZ0aCBwYBBiB9ZW50cnlfaWQSBggDEgIYAiIwaUdxM2V2aDVkM25tWWR0R0Zna1JCaDJjcTJKdW1YRWkxY3RRMlhPRVh3RT0wmQHqDgwB6gwBAAHqDAEAAeoMAQAB6gwBAAHqDAEAAeoxaUdxM2V2aDVkM25tWWR0R0Zna1JCaDJjcTJKdW1YRWkxY3RRMlhPRVh3RT0=',
      })
    })

    it('preserves stream flag', async () => {
      const result = await transformer.transformRequestOut(anthropicStreamingRequest)
      expect(result.stream).toBe(true)
    })
  })

  // ── transformResponseIn: IR → Anthropic (non-streaming) ──

  describe('transformResponseIn (sync)', () => {
    it('converts basic OpenAI response to Anthropic format', async () => {
      const response = new Response(JSON.stringify(openaiBasicResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })

      const result = await transformer.transformResponseIn(response, { provider: {} as any, isStream: false })
      const data = await result.json()

      expect(data.type).toBe('message')
      expect(data.role).toBe('assistant')
      expect(data.content).toEqual([{ type: 'text', text: 'Hello! How can I help you?' }])
      expect(data.stop_reason).toBe('end_turn')
      expect(data.stop_sequence).toBeNull()
    })

    it('converts tool_calls to tool_use content blocks', async () => {
      const response = new Response(JSON.stringify(openaiToolCallsResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })

      const result = await transformer.transformResponseIn(response, { provider: {} as any, isStream: false })
      const data = await result.json()

      expect(data.stop_reason).toBe('tool_use')
      expect(data.content).toHaveLength(1)
      expect(data.content[0]).toEqual({
        type: 'tool_use',
        id: 'call_abc123',
        name: 'get_current_weather',
        input: { location: 'Boston, MA' },
      })
    })

    it('converts thinking field to thinking content block', async () => {
      const response = new Response(JSON.stringify(openaiResponseWithThinking), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })

      const result = await transformer.transformResponseIn(response, { provider: {} as any, isStream: false })
      const data = await result.json()

      expect(data.content).toHaveLength(2)
      expect(data.content[0]).toEqual({
        type: 'text',
        text: 'The GCD of 48 and 180 is 12.',
      })
      expect(data.content[1]).toEqual({
        type: 'thinking',
        thinking: 'I need to find the GCD of 48 and 180.',
        signature: 'sig_abc123',
      })
    })

    it('maps stop reasons correctly', async () => {
      const cases = [
        { finish_reason: 'stop', expected: 'end_turn' },
        { finish_reason: 'length', expected: 'max_tokens' },
        { finish_reason: 'tool_calls', expected: 'tool_use' },
        { finish_reason: 'content_filter', expected: 'stop_sequence' },
      ]

      for (const { finish_reason, expected } of cases) {
        const openaiResp = {
          id: 'test',
          choices: [{ message: { content: 'test' }, finish_reason }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }
        const response = new Response(JSON.stringify(openaiResp), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })

        const result = await transformer.transformResponseIn(response, { provider: {} as any, isStream: false })
        const data = await result.json()
        expect(data.stop_reason).toBe(expected)
      }
    })

    it('maps usage fields correctly', async () => {
      const openaiResp = {
        id: 'test',
        choices: [{ message: { content: 'hi' }, finish_reason: 'stop' }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          prompt_tokens_details: { cached_tokens: 20 },
        },
      }
      const response = new Response(JSON.stringify(openaiResp), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })

      const result = await transformer.transformResponseIn(response, { provider: {} as any, isStream: false })
      const data = await result.json()

      expect(data.usage.input_tokens).toBe(80) // 100 - 20 cached
      expect(data.usage.output_tokens).toBe(50)
      expect(data.usage.cache_read_input_tokens).toBe(20)
    })
  })

  // ── transformResponseIn: streaming ──

  describe('transformResponseIn (streaming)', () => {
    async function collectStream(stream: ReadableStream): Promise<string[]> {
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      const chunks: string[] = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(decoder.decode(value, { stream: true }))
      }
      return chunks
    }

    function buildOpenAIStream(chunks: (object | string)[]): ReadableStream {
      const encoder = new TextEncoder()
      return new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            const line = typeof chunk === 'string' ? chunk : 'data: ' + JSON.stringify(chunk)
            controller.enqueue(encoder.encode(line + '\n'))
          }
          controller.close()
        },
      })
    }

    it('converts basic text stream to Anthropic SSE events', async () => {
      const openaiChunks = [
        { id: 'chatcmpl-stream01', object: 'chat.completion.chunk', created: 1694268190, model: 'gpt-4o-mini', choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] },
        { id: 'chatcmpl-stream01', object: 'chat.completion.chunk', created: 1694268190, model: 'gpt-4o-mini', choices: [{ index: 0, delta: { content: 'Hello' }, finish_reason: null }] },
        { id: 'chatcmpl-stream01', object: 'chat.completion.chunk', created: 1694268190, model: 'gpt-4o-mini', choices: [{ index: 0, delta: { content: ', how' }, finish_reason: null }] },
        { id: 'chatcmpl-stream01', object: 'chat.completion.chunk', created: 1694268190, model: 'gpt-4o-mini', choices: [{ index: 0, delta: { content: ' can I help?' }, finish_reason: null }] },
        { id: 'chatcmpl-stream01', object: 'chat.completion.chunk', created: 1694268190, model: 'gpt-4o-mini', choices: [{ index: 0, delta: {}, logprobs: null, finish_reason: 'stop' }] },
        '[DONE]',
      ]

      const response = new Response(buildOpenAIStream(openaiChunks), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })

      const result = await transformer.transformResponseIn(response, { provider: {} as any, isStream: true })
      expect(result.headers.get('Content-Type')).toBe('text/event-stream')

      const chunks = await collectStream(result.body!)
      const text = chunks.join('')

      // Check key events are present
      expect(text).toContain('event: message_start')
      expect(text).toContain('event: content_block_start')
      expect(text).toContain('"type":"text"')
      expect(text).toContain('event: content_block_delta')
      expect(text).toContain('"text_delta"')
      expect(text).toContain('Hello')
      expect(text).toContain('event: content_block_stop')
      expect(text).toContain('event: message_delta')
      expect(text).toContain('"stop_reason":"end_turn"')
      expect(text).toContain('event: message_stop')
    })

    it('converts tool_calls stream to Anthropic tool_use SSE events', async () => {
      const tc1 = {
        id: 'chatcmpl-toolstream',
        object: 'chat.completion.chunk',
        created: 1694268190,
        model: 'gpt-4.1',
        choices: [{
          index: 0,
          delta: {
            role: 'assistant',
            content: null,
            tool_calls: [{ index: 0, id: 'call_abc123', type: 'function', function: { name: 'get_weather', arguments: '' } }],
          },
          finish_reason: null,
        }],
      }
      const tc2 = {
        id: 'chatcmpl-toolstream',
        object: 'chat.completion.chunk',
        created: 1694268190,
        model: 'gpt-4.1',
        choices: [{
          index: 0,
          delta: { tool_calls: [{ index: 0, function: { arguments: '{"lo' } }] },
          finish_reason: null,
        }],
      }
      const tc3 = {
        id: 'chatcmpl-toolstream',
        object: 'chat.completion.chunk',
        created: 1694268190,
        model: 'gpt-4.1',
        choices: [{
          index: 0,
          delta: { tool_calls: [{ index: 0, function: { arguments: 'cation": "San' } }] },
          finish_reason: null,
        }],
      }
      const tc4 = {
        id: 'chatcmpl-toolstream',
        object: 'chat.completion.chunk',
        created: 1694268190,
        model: 'gpt-4.1',
        choices: [{
          index: 0,
          delta: { tool_calls: [{ index: 0, function: { arguments: ' Francisco"}' } }] },
          finish_reason: null,
        }],
      }
      const tc5 = {
        id: 'chatcmpl-toolstream',
        object: 'chat.completion.chunk',
        created: 1694268190,
        model: 'gpt-4.1',
        choices: [{ index: 0, delta: {}, logprobs: null, finish_reason: 'tool_calls' }],
      }
      const openaiChunks = [tc1, tc2, tc3, tc4, tc5, '[DONE]']

      const response = new Response(buildOpenAIStream(openaiChunks), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })

      const result = await transformer.transformResponseIn(response, { provider: {} as any, isStream: true })
      const chunks = await collectStream(result.body!)
      const text = chunks.join('')

      expect(text).toContain('"type":"tool_use"')
      expect(text).toContain('"name":"get_weather"')
      expect(text).toContain('"input_json_delta"')
      expect(text).toContain('"stop_reason":"tool_use"')
    })

    it('converts thinking stream to Anthropic thinking SSE events', async () => {
      const openaiChunks = [
        { id: 'chatcmpl-thinkstream', object: 'chat.completion.chunk', created: 1694268190, model: 'gpt-4.1', choices: [{ index: 0, delta: { role: 'assistant', content: '', thinking: { content: 'I need to find' } }, finish_reason: null }] },
        { id: 'chatcmpl-thinkstream', object: 'chat.completion.chunk', created: 1694268190, model: 'gpt-4.1', choices: [{ index: 0, delta: { thinking: { content: ' the GCD' } }, finish_reason: null }] },
        { id: 'chatcmpl-thinkstream', object: 'chat.completion.chunk', created: 1694268190, model: 'gpt-4.1', choices: [{ index: 0, delta: { thinking: { signature: 'EqQBCgIYAhIM...' } }, finish_reason: null }] },
        { id: 'chatcmpl-thinkstream', object: 'chat.completion.chunk', created: 1694268190, model: 'gpt-4.1', choices: [{ index: 0, delta: { content: 'The answer is 12.' }, finish_reason: null }] },
        { id: 'chatcmpl-thinkstream', object: 'chat.completion.chunk', created: 1694268190, model: 'gpt-4.1', choices: [{ index: 0, delta: {}, logprobs: null, finish_reason: 'stop' }] },
        '[DONE]',
      ]

      const response = new Response(buildOpenAIStream(openaiChunks), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })

      const result = await transformer.transformResponseIn(response, { provider: {} as any, isStream: true })
      const chunks = await collectStream(result.body!)
      const text = chunks.join('')

      expect(text).toContain('"type":"thinking"')
      expect(text).toContain('"thinking_delta"')
      expect(text).toContain('"signature_delta"')
      expect(text).toContain('"text_delta"')
    })
  })
})
