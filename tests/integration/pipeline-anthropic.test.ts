import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startMockUpstream } from '../utils/mock-upstream.js'
import { createApp } from '@tokenflow/server/app.js'
import { resetDb, getDb, createApiKey } from '@tokenflow/server/db/schema.js'
import { loadConfig } from '@tokenflow/server/configLoader.js'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

describe('Anthropic Pipeline', () => {
  let mock: Awaited<ReturnType<typeof startMockUpstream>>
  let tfApp: Awaited<ReturnType<typeof createApp>>
  let tfPort: number
  let tempDir: string
  let apiKeyId: string

  beforeAll(async () => {
    mock = await startMockUpstream([
      {
        body: {
          id: 'mock-sync',
          object: 'chat.completion',
          model: 'gpt-4o',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Hello from mock' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        },
      },
      {
        streamChunks: [
          'data: {"id":"1","object":"chat.completion.chunk","model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"}}]}',
          'data: {"id":"1","object":"chat.completion.chunk","model":"gpt-4o","choices":[{"index":0,"delta":{"content":" world"}}]}',
          'data: [DONE]',
        ],
      },
    ])

    tempDir = join(tmpdir(), `tf-test-${Date.now()}`)
    mkdirSync(tempDir, { recursive: true })

    const configPath = join(tempDir, 'config.json5')
    const config = {
      PORT: 0,
      UI_PORT: 0,
      APIKEY: '',
      DATABASE: ':memory:',
      Providers: [{
        name: 'openai',
        api_base_url: mock.url,
        api_key: 'test-key',
        models: ['gpt-4o'],
      }],
      Router: { enabled: false, default: '' },
      Detectors: {
        fullContext: { enabled: false },
        slidingWindow: { enabled: false },
        summarization: { enabled: false },
      },
      LOG_LEVEL: 'silent' as const,
    }
    writeFileSync(configPath, JSON.stringify(config, null, 2))

    process.env.TOKENFLOW_CONFIG_PATH = configPath
    process.env.TOKENFLOW_DB_PATH = ':memory:'

    resetDb()

    const loadedConfig = loadConfig()
    tfApp = await createApp(loadedConfig)
    getDb(':memory:')

    const key = createApiKey({
      name: 'test',
      provider: 'openai',
      upstream_key: 'test-key',
      base_url: mock.url,
    })
    apiKeyId = key.id

    const addr = await tfApp.listen({ port: 0, host: '127.0.0.1' })
    tfPort = parseInt(addr.split(':').pop()!, 10)
  })

  afterAll(async () => {
    await tfApp.close()
    await mock.close()
    rmSync(tempDir, { recursive: true, force: true })
    delete process.env.TOKENFLOW_CONFIG_PATH
    delete process.env.TOKENFLOW_DB_PATH
  })

  it('converts Anthropic request to OpenAI and back', async () => {
    const res = await fetch(`http://127.0.0.1:${tfPort}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKeyId,
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()

    // Anthropic format assertions
    expect(json.type).toBe('message')
    expect(json.role).toBe('assistant')
    expect(json.content).toEqual([{ type: 'text', text: 'Hello from mock' }])
    expect(json.stop_reason).toBe('end_turn')
    expect(json.usage.output_tokens).toBe(3)

    // Mock upstream received OpenAI format
    expect(mock.requests).toHaveLength(1)
    const upstreamReq = mock.requests[0]
    expect(upstreamReq.method).toBe('POST')
    expect(upstreamReq.url).toBe('/v1/chat/completions')
    expect(upstreamReq.body).toMatchObject({
      model: 'claude-3-5-sonnet',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 100,
    })
  })

  it('streams Anthropic SSE through OpenAI upstream', async () => {
    const res = await fetch(`http://127.0.0.1:${tfPort}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKeyId,
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
      }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')

    const body = await res.text()
    expect(body).toContain('event: message_start')
    expect(body).toContain('event: content_block_delta')
    expect(body).toContain('event: message_stop')

    expect(mock.requests).toHaveLength(2)
    const upstreamReq = mock.requests[1]
    expect(upstreamReq.body).toMatchObject({
      stream: true,
    })
  })
})
