import { describe, it, expect } from 'vitest'
import { GroqProviderTransformer } from '@tokenflow/server/transformers/groq.js'
import { createMockContext, mockResponse, mockStreamResponse, readStream, makeStreamChunk } from '../../utils/transformer-test-helper.js'

describe('GroqProviderTransformer', () => {
  const transformer = new GroqProviderTransformer()

  describe('transformRequestIn', () => {
    it('strips cache_control from message content items', async () => {
      const result = await transformer.transformRequestIn({
        model: 'llama3-8b',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'hi', cache_control: { type: 'ephemeral' } },
          ],
        }],
      } as any, createMockContext())

      const msg = (result.body as any).messages[0]
      expect(msg.content[0].cache_control).toBeUndefined()
      expect(msg.content[0].text).toBe('hi')
    })

    it('strips cache_control from message level', async () => {
      const result = await transformer.transformRequestIn({
        model: 'llama3-8b',
        messages: [{
          role: 'user',
          content: 'hi',
          cache_control: { type: 'ephemeral' },
        }],
      } as any, createMockContext())

      const msg = (result.body as any).messages[0]
      expect(msg.cache_control).toBeUndefined()
    })

    it('strips $schema from tool parameters', async () => {
      const result = await transformer.transformRequestIn({
        model: 'llama3-8b',
        messages: [{ role: 'user', content: 'hi' }],
        tools: [{
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get weather',
            parameters: {
              type: 'object',
              $schema: 'http://json-schema.org/draft-07/schema#',
              properties: {},
            },
          },
        }],
      } as any, createMockContext())

      const tool = (result.body as any).tools[0]
      expect(tool.function.parameters.$schema).toBeUndefined()
    })
  })

  describe('transformResponseOut', () => {
    it('passes through sync response', async () => {
      const response = mockResponse({ id: 'test' })
      const result = await transformer.transformResponseOut(response)
      expect(await result.json()).toEqual({ id: 'test' })
    })

    it('throws on stream error chunk', async () => {
      const chunks = [
        makeStreamChunk({ error: { message: 'Rate limited' } }),
      ]
      const response = mockStreamResponse(chunks)
      const result = await transformer.transformResponseOut(response)
      await expect(readStream(result)).rejects.toThrow()
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
  })
})
