import { describe, it, expect } from 'vitest'
import { VercelProviderTransformer } from '@tokenflow/server/transformers/vercel.js'
import { createMockContext, mockResponse, mockStreamResponse, readStream, makeStreamChunk } from '../../utils/transformer-test-helper.js'

describe('VercelProviderTransformer', () => {
  const transformer = new VercelProviderTransformer()

  describe('transformRequestIn', () => {
    it('strips cache_control for non-Claude models like openrouter', async () => {
      const result = await transformer.transformRequestIn({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'hi', cache_control: { type: 'ephemeral' } },
          ],
        }],
      } as any, createMockContext())

      const msg = (result.body as any).messages[0]
      expect(msg.content[0].cache_control).toBeUndefined()
    })

    it('merges provider.options into upstream body', async () => {
      const result = await transformer.transformRequestIn({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hi' }],
      } as any, createMockContext({ options: { temperature: 0.3 } }))

      expect((result.body as any).temperature).toBe(0.3)
    })
  })

  describe('transformResponseOut', () => {
    it('passes through sync response', async () => {
      const response = mockResponse({ id: 'test' })
      const result = await transformer.transformResponseOut(response)
      expect(await result.json()).toEqual({ id: 'test' })
    })

    it('handles reasoning stream like openrouter', async () => {
      const chunks = [
        makeStreamChunk({ choices: [{ delta: { reasoning: 'Thinking' } }] }),
      ]
      const response = mockStreamResponse(chunks)
      const result = await transformer.transformResponseOut(response)
      const text = await readStream(result)

      expect(text).toContain('thinking')
      expect(text).not.toContain('"reasoning"')
    })
  })
})
