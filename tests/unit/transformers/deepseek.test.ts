import { describe, it, expect } from 'vitest'
import { DeepseekProviderTransformer } from '@tokenflow/server/transformers/deepseek.js'
import { createMockContext, mockResponse, mockStreamResponse, readStream, makeStreamChunk } from '../../utils/transformer-test-helper.js'

describe('DeepseekProviderTransformer', () => {
  const transformer = new DeepseekProviderTransformer()

  describe('transformRequestIn', () => {
    it('clamps max_tokens to 8192 when above limit', async () => {
      const result = await transformer.transformRequestIn({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 10000,
      } as any, createMockContext())

      expect((result.body as any).max_tokens).toBe(8192)
    })

    it('leaves max_tokens unchanged when within limit', async () => {
      const result = await transformer.transformRequestIn({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1024,
      } as any, createMockContext())

      expect((result.body as any).max_tokens).toBe(1024)
    })
  })

  describe('transformResponseOut', () => {
    it('passes through sync response', async () => {
      const response = mockResponse({ choices: [{ message: { content: 'hi' } }] })
      const result = await transformer.transformResponseOut(response)
      expect(await result.json()).toEqual({ choices: [{ message: { content: 'hi' } }] })
    })

    it('rewrites reasoning_content to thinking in stream', async () => {
      const chunks = [
        makeStreamChunk({ choices: [{ delta: { reasoning_content: 'Thinking...' } }] }),
        makeStreamChunk({ choices: [{ delta: { content: 'Answer' } }] }),
      ]
      const response = mockStreamResponse(chunks)
      const result = await transformer.transformResponseOut(response, createMockContext())
      const text = await readStream(result)

      expect(text).toContain('thinking')
      expect(text).toContain('"content":"Thinking..."')
      expect(text).not.toContain('reasoning_content')
      expect(text).toContain('Answer')
    })

    it('emits complete thinking chunk when reasoning transitions to content', async () => {
      const chunks = [
        makeStreamChunk({ choices: [{ delta: { reasoning_content: 'Reasoning' } }] }),
        makeStreamChunk({ choices: [{ delta: { content: 'Hello' } }] }),
      ]
      const response = mockStreamResponse(chunks)
      const result = await transformer.transformResponseOut(response, createMockContext())
      const text = await readStream(result)

      expect(text).toContain('"thinking":{"content":"Reasoning"')
      expect(text).toContain('"thinking":{"content":"Reasoning","signature"')
      expect(text).toContain('"content":null')
    })
  })
})
