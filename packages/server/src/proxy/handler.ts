import type { FastifyRequest, FastifyReply } from 'fastify'
import { generateId } from '@tokenflow/shared'
import { getApiKey, insertRequestLog, upsertSession, getSession } from '../db/schema.js'
import { runDetectors } from '../detectors/index.js'
import { getMainTransformer, getProviderTransformer } from '../transformers/index.js'
import type { TransformContext } from '../transformers/base.js'
import { loadConfig } from '../configLoader.js'
import { ProxyAgent } from 'undici'

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
  const providerName = apiKey.provider

  const provider = config.Providers.find(p => p.name === providerName)
  if (!provider) {
    return reply.code(400).send({ error: { message: `No provider "${providerName}" configured` } })
  }

  // Select transformers
  const mainTransformer = getMainTransformer(request.url)
  const providerTransformer = getProviderTransformer(provider.template) || getProviderTransformer('openai')!

  const ctx: TransformContext = {
    provider: {
      api_base_url: provider.api_base_url,
      api_key: provider.api_key,
      models: provider.models,
      options: provider.options,
    },
    isStream: body.stream === true,
  }

  // Layer 1: Main transformer — client format → IR
  const unified = await mainTransformer.transformRequestOut(body, ctx)
  unified.model = body.model || unified.model

  // Layer 2: Provider transformer — IR → provider format
  const upstream = await providerTransformer.transformRequestIn(unified, ctx)

  try {
    const upstreamHeaders = {
      ...upstream.headers,
      ...(provider.options?.extra_headers || {}),
    }
    const fetchOpts: RequestInit & { dispatcher?: any } = {
      method: 'POST',
      headers: upstreamHeaders,
      body: JSON.stringify(upstream.body),
    }
    if (config.PROXY_URL) {
      fetchOpts.dispatcher = new ProxyAgent(config.PROXY_URL)
    }
    const response = await fetch(upstream.url, fetchOpts)

    if (!response.ok) {
      const errBody = await response.text()
      return reply.code(response.status).send(errBody)
    }

    // Layer 2: Provider transformer — provider response → IR
    const irResponse = await providerTransformer.transformResponseOut(response, ctx)

    // Layer 1: Main transformer — IR → client format
    const clientResponse = await mainTransformer.transformResponseIn(irResponse, ctx)

    const isStream = body.stream === true

    if (isStream && clientResponse.body) {
      // Stream response back
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })

      let fullContent = ''
      let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

      const reader = clientResponse.body.getReader()
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
      const rawResponse = await clientResponse.json()
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
