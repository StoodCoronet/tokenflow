import { describe, it, expect } from 'vitest'
import { OpenAIResponsesProviderTransformer } from '@tokenflow/server/transformers/openai-responses.js'
import { createMockContext, mockResponse, mockStreamResponse, readStream, makeStreamChunk } from '../../utils/transformer-test-helper.js'

describe('OpenAIResponsesProviderTransformer', () => {
  const transformer = new OpenAIResponsesProviderTransformer()

  describe('transformRequestIn', () => {
    it('converts messages to input array', async () => {
      const result = await transformer.transformRequestIn({
        model: 'gpt-5-codex',
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'hi' },
        ],
      } as any, createMockContext())

      const body = result.body as any
      expect(body.input).toBeDefined()
      expect(body.messages).toBeUndefined()
      expect(body.input.some((i: any) => i.role === 'user' && i.content === 'hi')).toBe(true)
    })

    it('moves first system message to instructions', async () => {
      const result = await transformer.transformRequestIn({
        model: 'gpt-5-codex',
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'hi' },
        ],
      } as any, createMockContext())

      const body = result.body as any
      expect(body.instructions).toBe('You are helpful')
    })

    it('rewrites reasoning to effort + summary', async () => {
      const result = await transformer.transformRequestIn({
        model: 'gpt-5-codex',
        messages: [{ role: 'user', content: 'hi' }],
        reasoning: { effort: 'high' },
      } as any, createMockContext())

      const body = result.body as any
      expect(body.reasoning).toEqual({ effort: 'high', summary: 'detailed' })
    })

    it('deletes temperature and max_tokens', async () => {
      const result = await transformer.transformRequestIn({
        model: 'gpt-5-codex',
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 0.5,
        max_tokens: 1024,
      } as any, createMockContext())

      const body = result.body as any
      expect(body.temperature).toBeUndefined()
      expect(body.max_tokens).toBeUndefined()
    })

    it('converts tool messages to function_call_output', async () => {
      const result = await transformer.transformRequestIn({
        model: 'gpt-5-codex',
        messages: [
          { role: 'user', content: 'weather?' },
          { role: 'assistant', content: '', tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '{}' } }] },
          { role: 'tool', content: 'sunny', tool_call_id: 'call_1' },
        ],
      } as any, createMockContext())

      const body = result.body as any
      const toolOutput = body.input.find((i: any) => i.type === 'function_call_output')
      expect(toolOutput).toBeDefined()
      expect(toolOutput.call_id).toBe('call_1')
      expect(toolOutput.output).toBe('sunny')
    })

    it('converts assistant tool_calls to function_call items', async () => {
      const result = await transformer.transformRequestIn({
        model: 'gpt-5-codex',
        messages: [
          { role: 'assistant', content: '', tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '{}' } }] },
        ],
      } as any, createMockContext())

      const body = result.body as any
      const funcCall = body.input.find((i: any) => i.type === 'function_call')
      expect(funcCall).toBeDefined()
      expect(funcCall.call_id).toBe('call_1')
    })

    it('builds Responses API URL', async () => {
      const result = await transformer.transformRequestIn({
        model: 'gpt-5-codex',
        messages: [{ role: 'user', content: 'hi' }],
      } as any, createMockContext({ api_base_url: 'https://api.openai.com' }))

      expect(result.url).toBe('https://api.openai.com/v1/responses')
    })
  })

  describe('transformResponseOut', () => {
    it('converts sync Responses API response to chat.completion', async () => {
      const response = mockResponse({
        id: 'resp_123',
        object: 'response',
        model: 'gpt-5-codex',
        created_at: 1710000000,
        output: [
          { type: 'message', content: [{ type: 'output_text', text: 'Hello!' }] },
        ],
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      })
      const result = await transformer.transformResponseOut(response)
      const json = await result.json()

      expect(json.object).toBe('chat.completion')
      expect(json.choices[0].message.content).toBe('Hello!')
      expect(json.usage.total_tokens).toBe(15)
    })

    it('converts function_call output to tool_calls', async () => {
      const response = mockResponse({
        id: 'resp_123',
        object: 'response',
        model: 'gpt-5-codex',
        created_at: 1710000000,
        output: [
          { type: 'function_call', call_id: 'call_1', name: 'get_weather', arguments: '{}' },
        ],
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      })
      const result = await transformer.transformResponseOut(response)
      const json = await result.json()

      expect(json.choices[0].finish_reason).toBe('tool_calls')
      expect(json.choices[0].message.tool_calls[0].function.name).toBe('get_weather')
    })

    it('converts stream output_text.delta to chat.completion.chunk', async () => {
      const chunks = [
        makeStreamChunk({ type: 'response.output_text.delta', item_id: 'item_1', delta: 'Hello', response: { model: 'gpt-5-codex' } }),
      ]
      const response = mockStreamResponse(chunks)
      const result = await transformer.transformResponseOut(response)
      const text = await readStream(result)

      expect(text).toContain('chat.completion.chunk')
      expect(text).toContain('Hello')
    })

    it('converts stream reasoning_summary_text.delta to thinking', async () => {
      const chunks = [
        makeStreamChunk({ type: 'response.reasoning_summary_text.delta', item_id: 'item_1', delta: 'Thinking...', response: { model: 'gpt-5-codex' } }),
      ]
      const response = mockStreamResponse(chunks)
      const result = await transformer.transformResponseOut(response)
      const text = await readStream(result)

      expect(text).toContain('thinking')
      expect(text).toContain('Thinking...')
    })

    it('sends finish_reason stop on response.completed', async () => {
      const chunks = [
        makeStreamChunk({ type: 'response.completed', response: { id: 'resp_1', model: 'gpt-5-codex', output: [{ type: 'message' }] } }),
      ]
      const response = mockStreamResponse(chunks)
      const result = await transformer.transformResponseOut(response)
      const text = await readStream(result)

      expect(text).toContain('"finish_reason":"stop"')
    })

    it('sends finish_reason tool_calls when function_call present', async () => {
      const chunks = [
        makeStreamChunk({ type: 'response.completed', response: { id: 'resp_1', model: 'gpt-5-codex', output: [{ type: 'function_call' }] } }),
      ]
      const response = mockStreamResponse(chunks)
      const result = await transformer.transformResponseOut(response)
      const text = await readStream(result)

      expect(text).toContain('"finish_reason":"tool_calls"')
    })
  })
})
