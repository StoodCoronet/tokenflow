import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { generateId } from '@tokenflow/shared'
import { getApiKey } from '../db/schema.js'
import { insertRequestLog, upsertSession } from '../db/schema.js'
import { runDetectors } from '../detectors/index.js'

export async function proxyHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as any
  const apiKeyHeader = request.headers['x-api-key'] as string

  if (!apiKeyHeader) {
    return reply.code(401).send({ error: 'Missing X-API-Key header' })
  }

  const apiKey = getApiKey(apiKeyHeader)
  if (!apiKey) {
    return reply.code(401).send({ error: 'Invalid API Key' })
  }

  // Find matching provider
  const { loadConfig } = await import('../configLoader.js')
  const config = loadConfig()
  const provider = config.Providers.find(p =>
    p.models.includes(body.model) || p.name === apiKey.provider
  )

  if (!provider) {
    return reply.code(400).send({ error: `No provider found for model: ${body.model}` })
  }

  // Build upstream request
  const upstreamUrl = `${provider.api_base_url}/v1${request.url.replace('/v1', '')}`
  const startTime = Date.now()

  try {
    const isStream = body.stream === true

    const upstreamHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.api_key}`,
    }

    const response = await fetch(upstreamUrl, {
      method: 'POST',
      headers: upstreamHeaders,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errBody = await response.text()
      return reply.code(response.status).send(errBody)
    }

    if (isStream && response.body) {
      // Stream response
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })

      let fullContent = ''
      let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          reply.raw.write(chunk)
          fullContent += chunk

          // Try to extract usage from stream
          const usageMatch = chunk.match(/"usage":\s*\{[^}]+\}/)
          if (usageMatch) {
            try {
              usage = JSON.parse(`{${usageMatch[0]}}`).usage
            } catch {}
          }
        }
      } finally {
        reply.raw.end()
      }

      // Log after stream completes
      const analysis = runDetectors(body, usage)
      logRequest(apiKey.id, body, usage, 'success', analysis)
    } else {
      // Non-stream response
      const data = await response.json() as any
      const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

      const analysis = runDetectors(body, usage)
      logRequest(apiKey.id, body, usage, 'success', analysis)

      return reply.send(data)
    }
  } catch (err: any) {
    logRequest(apiKey.id, body, { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, 'error', null)
    return reply.code(502).send({ error: `Upstream error: ${err.message}` })
  }
}

function logRequest(
  apiKeyId: string,
  body: any,
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number },
  status: string,
  analysis: any
) {
  const sessionId = body.session_id || `auto-${generateId().slice(0, 8)}`

  insertRequestLog({
    id: generateId(),
    api_key_id: apiKeyId,
    session_id: sessionId,
    model: body.model,
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    total_tokens: usage.total_tokens,
    status,
    detected_pattern: analysis?.detected_pattern ?? null,
    efficiency_score: analysis?.efficiency_score ?? 0,
    request_data: JSON.stringify(body),
    response_data: '{}',
  })

  upsertSession({
    session_id: sessionId,
    api_key_id: apiKeyId,
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    detected_pattern: analysis?.detected_pattern ?? null,
  })
}
