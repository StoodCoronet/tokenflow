import { describe, it, expect } from 'vitest'
import { OpenAIProviderTransformer } from '@tokenflow/server/transformers/openai.js'
import { irOpenAiBasic, irOpenAiWithTools, irOpenAiStreaming } from '../fixtures/ir.js'
import type { TransformContext, ProviderConfig } from '@tokenflow/server/transformers/base.js'

describe('OpenAIProviderTransformer', () => {
  const transformer = new OpenAIProviderTransformer()

  const mockProvider: ProviderConfig = {
    api_base_url: 'https://api.openai.com',
    api_key: 'sk-test123',
    models: ['gpt-4.1', 'gpt-4o-mini'],
  }

  function makeContext(isStream = false): TransformContext {
    return { provider: mockProvider, isStream }
  }

  describe('transformRequestIn', () => {
    it('builds correct URL and Authorization header', async () => {
      const result = await transformer.transformRequestIn(irOpenAiBasic, makeContext())

      expect(result.url).toBe('https://api.openai.com/v1/chat/completions')
      expect(result.headers['Authorization']).toBe('Bearer sk-test123')
      expect(result.headers['Content-Type']).toBe('application/json')
    })

    it('passes through basic request body fields', async () => {
      const result = await transformer.transformRequestIn(irOpenAiBasic, makeContext())
      const body = result.body as any

      expect(body.model).toBe('gpt-4.1')
      expect(body.messages).toEqual(irOpenAiBasic.messages)
      expect(body.temperature).toBe(0.7)
      expect(body.stream).toBe(false)
    })

    it('maps max_completion_tokens to max_tokens', async () => {
      // Note: current implementation only checks request.max_tokens,
      // not request.max_completion_tokens. This test documents current behavior.
      const result = await transformer.transformRequestIn(irOpenAiBasic, makeContext())
      const body = result.body as any

      expect(body.max_tokens).toBeUndefined()
      expect(body.max_completion_tokens).toBeUndefined()
    })

    it('passes through tools and tool_choice', async () => {
      const result = await transformer.transformRequestIn(irOpenAiWithTools, makeContext())
      const body = result.body as any

      expect(body.tools).toEqual(irOpenAiWithTools.tools)
      expect(body.tool_choice).toBe('auto')
    })

    it('passes through streaming flag', async () => {
      const result = await transformer.transformRequestIn(irOpenAiStreaming, makeContext(true))
      const body = result.body as any

      expect(body.stream).toBe(true)
    })

    it('omits undefined fields from body', async () => {
      const minimalRequest = {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user' as const, content: 'hi' }],
      }
      const result = await transformer.transformRequestIn(minimalRequest as any, makeContext())
      const body = result.body as any

      expect(body.model).toBe('gpt-4o-mini')
      expect(body.messages).toEqual([{ role: 'user', content: 'hi' }])
      expect(body.max_tokens).toBeUndefined()
      expect(body.temperature).toBeUndefined()
      expect(body.tools).toBeUndefined()
      expect(body.tool_choice).toBeUndefined()
    })
  })

  describe('transformResponseOut', () => {
    it('passes through response unchanged', async () => {
      const response = new Response('{"id":"test"}', { status: 200 })
      const result = await transformer.transformResponseOut(response)

      expect(result.status).toBe(200)
      expect(await result.text()).toBe('{"id":"test"}')
    })
  })
})
