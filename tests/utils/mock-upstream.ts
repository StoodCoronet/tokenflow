import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http'

export interface MockRequest {
  method: string
  url: string
  headers: Record<string, string | string[] | undefined>
  body: unknown
}

export interface MockUpstream {
  server: Server
  port: number
  url: string
  requests: MockRequest[]
  close: () => Promise<void>
}

export interface MockResponse {
  status?: number
  body?: object
  streamChunks?: string[]
}

/**
 * Start a mock upstream HTTP server that records requests and returns
 * pre-defined OpenAI-format responses.
 */
export function startMockUpstream(responses?: MockResponse[]): Promise<MockUpstream> {
  const requests: MockRequest[] = []
  let responseIndex = 0

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = []
    for await (const chunk of req) {
      chunks.push(chunk)
    }
    const bodyText = Buffer.concat(chunks).toString('utf-8')
    const body = bodyText ? JSON.parse(bodyText) : null

    requests.push({
      method: req.method ?? 'GET',
      url: req.url ?? '/',
      headers: req.headers,
      body,
    })

    const response = responses?.[responseIndex++] ?? {
      status: 200,
      body: {
        id: 'mock-' + responseIndex,
        object: 'chat.completion',
        model: 'gpt-4o',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Hello from mock' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      },
    }

    if (response.streamChunks) {
      res.writeHead(response.status ?? 200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })
      for (const chunk of response.streamChunks) {
        res.write(chunk + '\n\n')
      }
      res.end()
    } else {
      res.writeHead(response.status ?? 200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(response.body))
    }
  })

  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') {
        const port = addr.port
        resolve({
          server,
          port,
          url: `http://127.0.0.1:${port}`,
          requests,
          close: () => new Promise<void>((r) => server.close(() => r())),
        })
      } else {
        reject(new Error('Failed to get server address'))
      }
    })
  })
}
