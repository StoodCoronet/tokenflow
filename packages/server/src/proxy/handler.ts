import type { FastifyRequest, FastifyReply } from 'fastify'
import { generateId } from '@tokenflow/shared'
import { getApiKey, insertRequestLog, upsertSession, getSession } from '../db/schema.js'
import { runDetectors } from '../detectors/index.js'
import { getTransformer } from '../transformers/index.js'
import type { InternalRequest, TransformContext } from '../transformers/base.js'
import { resolveRoute } from './router.js'
import { loadConfig } from '../configLoader.js'

export async function proxyHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as any
  const apiKeyHeader = request.headers['x-api-key'] as string

  if (!apiKeyHeader) {
    return reply.code(401).send({ error: { message: 'Missing X-API-Key header' } })
  }

  const apiKey = getApiKey(apiKeyHeader)
  if (!apiKey) {
    return reply.code(401).send({ error: { message: 'Invalid API Key' } })
  }

  const config = loadConfig()

  // Determine target provider and model
  let providerName = apiKey.provider
  let targetModel = body.model

  // Smart routing (if enabled)
  const route = resolveRoute(body, config)
  if (route) {
    providerName = route.providerName
    if (!body.model) targetModel = route.model
  }

  const provider = config.Providers.find(p => p.name === providerName)
  if (!provider) {
    return reply.code(400).send({ error: { message: `No provider "${providerName}" configured` } })
  }

  // Get transformer for the target provider
  const transformer = getTransformer(providerName) || getTransformer('openai')!

  const ctx: TransformContext = {
    provider: { api_base_url: provider.api_base_url, api_key: provider.api_key, models: provider.models },
    isStream: body.stream === true,
  }

  // Build internal request (normalize incoming body)
  let internal: InternalRequest = body
  if (transformer.transformRequestIn) {
    internal = await transformer.transformRequestIn(body, ctx)
  }
  internal.model = targetModel || internal.model

  // Format request for the upstream provider
  let upstream: { url: string; headers: Record<string, string>; body: unknown }
  if (transformer.transformRequestOut) {
    upstream = await transformer.transformRequestOut(internal, ctx)
  } else {
    // Fallback: raw pass-through
    upstream = {
      url: `${provider.api_base_url}/v1/chat/completions`,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provider.api_key}` },
      body: internal,
    }
  }

  try {
    const response = await fetch(upstream.url, {
      method: 'POST',
      headers: upstream.headers,
      body: JSON.stringify(upstream.body),
    })

    if (!response.ok) {
      const errBody = await response.text()
      return reply.code(response.status).send(errBody)
    }

    // Transform response if needed
    let finalResponse = response
    if (transformer.transformResponseIn) {
      finalResponse = await transformer.transformResponseIn(response, ctx)
    }

    const isStream = body.stream === true

    if (isStream && finalResponse.body) {
      // Stream response back
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })

      let fullContent = ''
      let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

      const reader = finalResponse.body.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          reply.raw.write(chunk)
          fullContent += chunk

          // Extract usage from SSE stream
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const parsed = JSON.parse(line.slice(6))
                if (parsed.usage) {
                  usage = parsed.usage
                }
              } catch {}
            }
          }
        }
      } finally {
        reply.raw.end()
      }

      // Async analysis and logging
      const sessionId = body.session_id || `auto-${generateId().slice(0, 8)}`
      const session = getSession(sessionId)
      const analysis = runDetectors(body, usage, session as any)
      logRequest(apiKey.id, body, usage, 'success', analysis)

    } else {
      // Non-stream response
      const rawResponse = await finalResponse.json()
      const usage = extractUsage(rawResponse)

      const sessionId = body.session_id || `auto-${generateId().slice(0, 8)}`
      const session = getSession(sessionId)
      const analysis = runDetectors(body, usage, session as any)
      logRequest(apiKey.id, body, usage, 'success', analysis)

      return reply.send(rawResponse)
    }
  } catch (err: any) {
    logRequest(apiKey.id, body, { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, 'error', null)
    return reply.code(502).send({ error: { message: `Upstream error: ${err.message}` } })
  }
}

function extractUsage(raw: any): { prompt_tokens: number; completion_tokens: number; total_tokens: number } {
  if (raw.usage) {
    return {
      prompt_tokens: raw.usage.prompt_tokens || raw.usage.input_tokens || 0,
      completion_tokens: raw.usage.completion_tokens || raw.usage.output_tokens || 0,
      total_tokens: raw.usage.total_tokens || 0,
    }
  }
  return { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
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
