import { describe, it, expect } from 'vitest'
import { CerebrasProviderTransformer } from '@tokenflow/server/transformers/cerebras.js'
import { createMockContext, mockResponse } from '../../utils/transformer-test-helper.js'

describe('CerebrasProviderTransformer', () => {
  const transformer = new CerebrasProviderTransformer()

  describe('transformRequestIn', () => {
    it('deletes reasoning field when present', async () => {
      const result = await transformer.transformRequestIn({
        model: 'cerebras-model',
        messages: [{ role: 'user', content: 'hi' }],
        reasoning: { effort: 'high' },
      } as any, createMockContext())

      const body = result.body as any
      expect(body.reasoning).toBeUndefined()
      expect(body.disable_reasoning).toBeUndefined()
    })

    it('injects disable_reasoning: false when reasoning is absent', async () => {
      const result = await transformer.transformRequestIn({
        model: 'cerebras-model',
        messages: [{ role: 'user', content: 'hi' }],
      } as any, createMockContext())

      const body = result.body as any
      expect(body.disable_reasoning).toBe(false)
    })

    it('builds OpenAI-compatible URL and headers', async () => {
      const result = await transformer.transformRequestIn({
        model: 'cerebras-model',
        messages: [{ role: 'user', content: 'hi' }],
      } as any, createMockContext({ api_base_url: 'https://api.cerebras.ai' }))

      expect(result.url).toBe('https://api.cerebras.ai/v1/chat/completions')
      expect(result.headers['Authorization']).toBe('Bearer sk-test')
    })
  })

  describe('transformResponseOut', () => {
    it('passes through sync response unchanged', async () => {
      const response = mockResponse({ id: 'test' })
      const result = await transformer.transformResponseOut(response)
      expect(await result.json()).toEqual({ id: 'test' })
    })

    it('passes through stream response unchanged', async () => {
      const response = mockResponse({ id: 'test' })
      const result = await transformer.transformResponseOut(response)
      expect(result.status).toBe(200)
    })
  })
})
