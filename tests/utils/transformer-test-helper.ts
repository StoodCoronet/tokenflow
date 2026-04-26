import type { TransformContext, ProviderConfig } from '@tokenflow/server/transformers/base.js'

export function createMockContext(overrides?: Partial<ProviderConfig>, isStream = false): TransformContext {
  const provider: ProviderConfig = {
    api_base_url: 'https://api.example.com',
    api_key: 'sk-test',
    models: ['model-1'],
    ...overrides,
  }
  return { provider, isStream }
}

export function mockResponse(json: object, status = 200): Response {
  return new Response(JSON.stringify(json), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function mockStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk + '\n\n'))
      }
      controller.close()
    },
  })
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

export async function readStream(response: Response): Promise<string> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let result = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    result += decoder.decode(value, { stream: false })
  }
  return result
}

export function makeStreamChunk(delta: object): string {
  return `data: ${JSON.stringify(delta)}`
}
