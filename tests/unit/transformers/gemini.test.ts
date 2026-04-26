import { describe, it, expect } from 'vitest'
import { GeminiProviderTransformer } from '@tokenflow/server/transformers/gemini.js'
import { createMockContext, mockResponse, mockStreamResponse, readStream, makeStreamChunk } from '../../utils/transformer-test-helper.js'

describe('GeminiProviderTransformer', () => {
  const transformer = new GeminiProviderTransformer()

  describe('transformRequestIn', () => {
    it('constructs generateContent URL for non-stream', async () => {
      const result = await transformer.transformRequestIn({
        model: 'gemini-1.5-pro',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
      } as any, createMockContext({ api_base_url: 'https://generativelanguage.googleapis.com' }))

      expect(result.url).toContain(':generateContent')
      expect(result.url).not.toContain('stream')
    })

    it('constructs streamGenerateContent URL for stream', async () => {
      const result = await transformer.transformRequestIn({
        model: 'gemini-1.5-pro',
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
      } as any, createMockContext({ api_base_url: 'https://generativelanguage.googleapis.com' }))

      expect(result.url).toContain('streamGenerateContent')
    })

    it('uses x-goog-api-key header', async () => {
      const result = await transformer.transformRequestIn({
        model: 'gemini-1.5-pro',
        messages: [{ role: 'user', content: 'hi' }],
      } as any, createMockContext({ api_key: 'gemini-key' }))

      expect(result.headers['x-goog-api-key']).toBe('gemini-key')
      expect(result.headers['Authorization']).toBeUndefined()
    })

    it('converts user message to Gemini contents format', async () => {
      const result = await transformer.transformRequestIn({
        model: 'gemini-1.5-pro',
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'hi' },
        ],
      } as any, createMockContext())

      const body = result.body as any
      expect(body.contents).toBeDefined()
      expect(body.contents.length).toBeGreaterThan(0)
      const userPart = body.contents.find((c: any) => c.role === 'user' && c.parts.some((p: any) => p.text === 'hi'))
      expect(userPart).toBeDefined()
      expect(userPart.parts.some((p: any) => p.text === 'hi')).toBe(true)
    })

    it('converts assistant message to model role', async () => {
      const result = await transformer.transformRequestIn({
        model: 'gemini-1.5-pro',
        messages: [
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: 'hello' },
        ],
      } as any, createMockContext())

      const body = result.body as any
      const modelPart = body.contents.find((c: any) => c.role === 'model')
      expect(modelPart.parts[0].text).toBe('hello')
    })
  })

  describe('transformResponseOut', () => {
    it('converts Gemini sync response to OpenAI format', async () => {
      const response = mockResponse({
        responseId: 'gemini-123',
        modelVersion: 'gemini-1.5-pro',
        candidates: [{
          content: { parts: [{ text: 'Hello!' }] },
          finishReason: 'STOP',
        }],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
      })
      const result = await transformer.transformResponseOut(response, createMockContext())
      const json = await result.json()

      expect(json.object).toBe('chat.completion')
      expect(json.choices[0].message.content).toBe('Hello!')
      expect(json.usage.prompt_tokens).toBe(10)
    })

    it('converts Gemini stream to OpenAI SSE format', async () => {
      const chunks = [
        makeStreamChunk({
          responseId: 'gemini-123',
          modelVersion: 'gemini-1.5-pro',
          candidates: [{
            content: { parts: [{ text: 'Hi' }] },
            finishReason: 'STOP',
          }],
        }),
      ]
      const response = mockStreamResponse(chunks)
      const result = await transformer.transformResponseOut(response, createMockContext())
      const text = await readStream(result)

      expect(text).toContain('chat.completion.chunk')
      expect(text).toContain('Hi')
    })
  })
})
