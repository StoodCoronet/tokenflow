import { describe, it, expect } from 'vitest'
import { VertexGeminiProviderTransformer, VertexClaudeProviderTransformer } from '@tokenflow/server/transformers/vertex.js'
import { createMockContext, mockResponse } from '../../utils/transformer-test-helper.js'

const mockAuth = {
  getAccessToken: async () => 'fake-gcp-token',
  resolveProjectId: async () => 'test-project',
}

describe('VertexGeminiProviderTransformer', () => {
  const transformer = new VertexGeminiProviderTransformer(mockAuth)

  it('constructs Vertex Gemini URL with project and location', async () => {
    const result = await transformer.transformRequestIn({
      model: 'gemini-1.5-pro',
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
    } as any, createMockContext())

    expect(result.url).toContain('projects/test-project')
    expect(result.url).toContain('locations/us-central1')
    expect(result.url).toContain(':generateContent')
    expect(result.headers['Authorization']).toBe('Bearer fake-gcp-token')
  })

  it('delegates response conversion to gemini transformer', async () => {
    const response = mockResponse({
      responseId: 'v-gemini-123',
      modelVersion: 'gemini-1.5-pro',
      candidates: [{
        content: { parts: [{ text: 'Hello' }] },
        finishReason: 'STOP',
      }],
      usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2, totalTokenCount: 7 },
    })
    const result = await transformer.transformResponseOut(response, createMockContext())
    const json = await result.json()

    expect(json.object).toBe('chat.completion')
    expect(json.choices[0].message.content).toBe('Hello')
  })
})

describe('VertexClaudeProviderTransformer', () => {
  const transformer = new VertexClaudeProviderTransformer(mockAuth)

  it('constructs Vertex Claude URL with rawPredict', async () => {
    const result = await transformer.transformRequestIn({
      model: 'claude-3-5-sonnet',
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
    } as any, createMockContext())

    expect(result.url).toContain('projects/test-project')
    expect(result.url).toContain('locations/us-east5')
    expect(result.url).toContain(':rawPredict')
    expect(result.headers['Authorization']).toBe('Bearer fake-gcp-token')
  })

  it('delegates response conversion to anthropic transformer', async () => {
    const response = mockResponse({
      id: 'msg_vertex_123',
      type: 'message',
      role: 'assistant',
      model: 'claude-3-5-sonnet',
      content: [{ type: 'text', text: 'Hello from Vertex' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 },
    })
    const result = await transformer.transformResponseOut(response, createMockContext())
    const json = await result.json()

    expect(json.choices[0].message.content).toBe('Hello from Vertex')
  })
})
