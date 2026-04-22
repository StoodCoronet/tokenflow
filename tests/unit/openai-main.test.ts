import { describe, it, expect } from 'vitest'
import { OpenAIMainTransformer } from '@tokenflow/server/transformers/openai.js'
import { openaiBasicRequest, openaiWithToolsRequest, openaiStreamingRequest } from '../fixtures/openai.js'
import { irOpenAiBasic, irOpenAiWithTools, irOpenAiStreaming } from '../fixtures/ir.js'

describe('OpenAIMainTransformer', () => {
  const transformer = new OpenAIMainTransformer()

  describe('transformRequestOut', () => {
    it('passes through a basic OpenAI request unchanged', async () => {
      const result = await transformer.transformRequestOut(openaiBasicRequest)
      expect(result).toEqual(irOpenAiBasic)
    })

    it('passes through a request with tools and tool_choice unchanged', async () => {
      const result = await transformer.transformRequestOut(openaiWithToolsRequest)
      expect(result).toEqual(irOpenAiWithTools)
    })

    it('passes through a streaming request unchanged', async () => {
      const result = await transformer.transformRequestOut(openaiStreamingRequest)
      expect(result).toEqual(irOpenAiStreaming)
    })
  })

  describe('transformResponseIn', () => {
    it('passes through a non-streaming response unchanged', async () => {
      const body = { id: 'test', choices: [{ message: { content: 'Hello' } }] }
      const response = new Response(JSON.stringify(body), { status: 200 })

      const result = await transformer.transformResponseIn(response)

      expect(result.status).toBe(200)
      expect(await result.json()).toEqual(body)
    })

    it('passes through a streaming response unchanged', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: hello\n\n'))
          controller.close()
        },
      })
      const response = new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })

      const result = await transformer.transformResponseIn(response)

      expect(result.headers.get('Content-Type')).toBe('text/event-stream')
      const reader = result.body!.getReader()
      const { value } = await reader.read()
      expect(new TextDecoder().decode(value)).toBe('data: hello\n\n')
    })
  })
})
