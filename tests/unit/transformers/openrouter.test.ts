import { describe, it, expect } from 'vitest'
import { OpenrouterProviderTransformer } from '@tokenflow/server/transformers/openrouter.js'
import { createMockContext, mockResponse, mockStreamResponse, readStream, makeStreamChunk } from '../../utils/transformer-test-helper.js'

describe('OpenrouterProviderTransformer', () => {
  const transformer = new OpenrouterProviderTransformer()

  describe('transformRequestIn', () => {
    it('strips cache_control for non-Claude models', async () => {
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

    it('keeps cache_control for Claude models', async () => {
      const result = await transformer.transformRequestIn({
        model: 'claude-3-5-sonnet',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'hi', cache_control: { type: 'ephemeral' } },
          ],
        }],
      } as any, createMockContext())

      const msg = (result.body as any).messages[0]
      expect(msg.content[0].cache_control).toEqual({ type: 'ephemeral' })
    })

    it('normalizes base64 image_url to raw base64 for non-Claude', async () => {
      const result = await transformer.transformRequestIn({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: 'abc123' }, media_type: 'image/png' },
          ],
        }],
      } as any, createMockContext())

      const item = (result.body as any).messages[0].content[0]
      expect(item.image_url.url).toBe('abc123')
      expect(item.media_type).toBeUndefined()
    })

    it('prefixes base64 image_url with data URI for Claude', async () => {
      const result = await transformer.transformRequestIn({
        model: 'claude-3-5-sonnet',
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: 'abc123' }, media_type: 'image/png' },
          ],
        }],
      } as any, createMockContext())

      const item = (result.body as any).messages[0].content[0]
      expect(item.image_url.url).toBe('data:image/png;base64,abc123')
      expect(item.media_type).toBeUndefined()
    })

    it('merges provider.options into upstream body', async () => {
      const result = await transformer.transformRequestIn({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hi' }],
      } as any, createMockContext({ options: { temperature: 0.5, top_p: 0.9 } }))

      const body = result.body as any
      expect(body.temperature).toBe(0.5)
      expect(body.top_p).toBe(0.9)
    })
  })

  describe('transformResponseOut', () => {
    it('passes through sync response', async () => {
      const response = mockResponse({ id: 'test' })
      const result = await transformer.transformResponseOut(response)
      expect(await result.json()).toEqual({ id: 'test' })
    })

    it('rewrites reasoning to thinking in stream', async () => {
      const chunks = [
        makeStreamChunk({ choices: [{ delta: { reasoning: 'Reasoning' } }] }),
        makeStreamChunk({ choices: [{ delta: { content: 'Answer' } }] }),
      ]
      const response = mockStreamResponse(chunks)
      const result = await transformer.transformResponseOut(response)
      const text = await readStream(result)

      expect(text).toContain('"thinking":{"content":"Reasoning"}')
      expect(text).not.toContain('"reasoning"')
    })

    it('increments choice index when tool_call follows text', async () => {
      const chunks = [
        makeStreamChunk({ choices: [{ index: 0, delta: { content: 'text' } }] }),
        makeStreamChunk({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { name: 'foo', arguments: '' } }] } }] }),
      ]
      const response = mockStreamResponse(chunks)
      const result = await transformer.transformResponseOut(response)
      const text = await readStream(result)

      const lines = text.split('\n').filter(l => l.startsWith('data:'))
      const second = JSON.parse(lines[1].slice(6))
      expect(second.choices[0].index).toBe(1)
    })

    it('rewrites numeric tool_call ids to call_ format', async () => {
      const chunks = [
        makeStreamChunk({ choices: [{ delta: { tool_calls: [{ index: 0, id: '12345', function: { name: 'foo', arguments: '' } }] } }] }),
      ]
      const response = mockStreamResponse(chunks)
      const result = await transformer.transformResponseOut(response)
      const text = await readStream(result)

      expect(text).toContain('call_')
      expect(text).not.toContain('"id":"12345"')
    })
  })
})
