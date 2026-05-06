import type { FastifyInstance } from 'fastify'
import { getDb, listApiKeys, createApiKey, deleteApiKey, getApiKey, updateApiKey, insertProviderModels, listProviderModels, clearProviderModels, getPaginatedRequestLogs } from '../db/schema.js'
import { loadConfig, saveConfig } from '../configLoader.js'
import type { AppConfig, Provider } from '@tokenflow/shared'

export async function registerRoutes(app: FastifyInstance) {
  // API Keys
  app.get('/api/keys', async () => {
    return listApiKeys()
  })

  app.post('/api/keys', async (request) => {
    const body = request.body as any
    return createApiKey({
      name: body.name,
      provider: body.provider || 'openai',
      scenario: body.scenario,
    })
  })

  app.delete('/api/keys/:id', async (request) => {
    const { id } = request.params as { id: string }
    deleteApiKey(id)
    return { ok: true }
  })

  app.put('/api/keys/:id', async (request) => {
    const { id } = request.params as { id: string }
    const body = request.body as any
    return updateApiKey(id, {
      name: body.name,
      provider: body.provider,
      scenario: body.scenario,
    })
  })

  // Dashboard stats
  app.get('/api/dashboard', async (request) => {
    const db = getDb()
    const query = request.query as any
    const range = query?.range || '24h'
    const windowType = ['1h', '6h', '24h'].includes(range) ? 'hour' : 'day'
    const rangeOffset = {
      '1h': '-1 hours',
      '6h': '-6 hours',
      '24h': '-24 hours',
      '7d': '-7 days',
      '30d': '-30 days',
    }[range as string] || '-24 hours'

    const summary = db.prepare(`
      SELECT COALESCE(SUM(request_count), 0) as total_requests,
             COALESCE(SUM(prompt_tokens), 0) as total_prompt,
             COALESCE(SUM(completion_tokens), 0) as total_completion,
             COALESCE(SUM(total_tokens), 0) as total_tokens,
             COALESCE(AVG(avg_efficiency), 0) as avg_efficiency
      FROM stats_aggregates
      WHERE window_type = ? AND window_start >= datetime('now', ?) AND model IS NULL
    `).get(windowType, rangeOffset) as any

    const trend = db.prepare(`
      SELECT window_start, SUM(request_count) as request_count, SUM(total_tokens) as total_tokens
      FROM stats_aggregates
      WHERE window_type = ? AND window_start >= datetime('now', ?) AND model IS NULL
      GROUP BY window_start
      ORDER BY window_start ASC
    `).all(windowType, rangeOffset)

    const keyDistribution = db.prepare(`
      SELECT s.api_key_id, k.name as key_name, SUM(s.request_count) as request_count, SUM(s.total_tokens) as total_tokens
      FROM stats_aggregates s
      LEFT JOIN api_keys k ON s.api_key_id = k.id
      WHERE s.window_type = ? AND s.window_start >= datetime('now', ?) AND s.model IS NULL
      GROUP BY s.api_key_id
      ORDER BY total_tokens DESC
    `).all(windowType, rangeOffset)

    const modelDistribution = db.prepare(`
      SELECT model, SUM(request_count) as request_count, SUM(total_tokens) as total_tokens
      FROM stats_aggregates
      WHERE window_type = ? AND window_start >= datetime('now', ?) AND model IS NOT NULL
      GROUP BY model
      ORDER BY total_tokens DESC
    `).all(windowType, rangeOffset)

    const gradeDistribution = db.prepare(`
      SELECT
        SUM(CASE WHEN efficiency_score >= 80 THEN 1 ELSE 0 END) as A,
        SUM(CASE WHEN efficiency_score >= 60 AND efficiency_score < 80 THEN 1 ELSE 0 END) as B,
        SUM(CASE WHEN efficiency_score >= 40 AND efficiency_score < 60 THEN 1 ELSE 0 END) as C,
        SUM(CASE WHEN efficiency_score < 40 THEN 1 ELSE 0 END) as D
      FROM request_logs
      WHERE created_at >= datetime('now', ?)
    `).get(rangeOffset) as any

    const patternDistribution = db.prepare(`
      SELECT COALESCE(SUM(pattern_full_context), 0) as full_context,
             COALESCE(SUM(pattern_sliding_window), 0) as sliding_window,
             COALESCE(SUM(pattern_summarization), 0) as summarization
      FROM stats_aggregates
      WHERE window_type = ? AND window_start >= datetime('now', ?) AND model IS NULL
    `).get(windowType, rangeOffset) as any

    const totalRequests = summary.total_requests || 0
    const patternTotal = (patternDistribution.full_context || 0) + (patternDistribution.sliding_window || 0) + (patternDistribution.summarization || 0)

    return {
      range,
      window_type: windowType,
      total_requests: totalRequests,
      total_prompt_tokens: summary.total_prompt || 0,
      total_completion_tokens: summary.total_completion || 0,
      avg_efficiency: Math.round(summary.avg_efficiency || 0),
      trend,
      key_distribution: keyDistribution,
      model_distribution: modelDistribution,
      grade_distribution: {
        A: gradeDistribution.A || 0,
        B: gradeDistribution.B || 0,
        C: gradeDistribution.C || 0,
        D: gradeDistribution.D || 0,
      },
      pattern_distribution: {
        full_context: patternDistribution.full_context || 0,
        sliding_window: patternDistribution.sliding_window || 0,
        summarization: patternDistribution.summarization || 0,
        none: Math.max(0, totalRequests - patternTotal),
      },
      anomalies: detectAnomalies(db, windowType),
    }
  })

  app.get('/api/dashboard/keys/:key_id', async (request, reply) => {
    const { key_id } = request.params as { key_id: string }
    const query = request.query as any
    const range = query?.range || '24h'
    const page = Math.max(1, parseInt(query?.page) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(query?.page_size) || 20))

    const windowType = ['1h', '6h', '24h'].includes(range) ? 'hour' : 'day'
    const rangeOffset = {
      '1h': '-1 hours',
      '6h': '-6 hours',
      '24h': '-24 hours',
      '7d': '-7 days',
      '30d': '-30 days',
    }[range as string] || '-24 hours'

    const db = getDb()
    const apiKey = db.prepare('SELECT id, name, provider, scenario FROM api_keys WHERE id = ?').get(key_id) as any
    if (!apiKey) {
      return reply.code(404).send({ error: 'Key not found' })
    }

    const summary = db.prepare(`
      SELECT COALESCE(SUM(request_count), 0) as total_requests,
             COALESCE(SUM(prompt_tokens), 0) as total_prompt,
             COALESCE(SUM(completion_tokens), 0) as total_completion,
             COALESCE(SUM(total_tokens), 0) as total_tokens,
             COALESCE(AVG(avg_efficiency), 0) as avg_efficiency
      FROM stats_aggregates
      WHERE window_type = ? AND window_start >= datetime('now', ?) AND api_key_id = ? AND model IS NULL
    `).get(windowType, rangeOffset, key_id) as any

    const trend = db.prepare(`
      SELECT window_start, SUM(request_count) as request_count, SUM(total_tokens) as total_tokens
      FROM stats_aggregates
      WHERE window_type = ? AND window_start >= datetime('now', ?) AND api_key_id = ? AND model IS NULL
      GROUP BY window_start
      ORDER BY window_start ASC
    `).all(windowType, rangeOffset, key_id)

    const modelDistribution = db.prepare(`
      SELECT model, SUM(request_count) as request_count, SUM(total_tokens) as total_tokens
      FROM stats_aggregates
      WHERE window_type = ? AND window_start >= datetime('now', ?) AND api_key_id = ? AND model IS NOT NULL
      GROUP BY model
      ORDER BY total_tokens DESC
    `).all(windowType, rangeOffset, key_id)

    const patternDist = db.prepare(`
      SELECT COALESCE(SUM(pattern_full_context), 0) as full_context,
             COALESCE(SUM(pattern_sliding_window), 0) as sliding_window,
             COALESCE(SUM(pattern_summarization), 0) as summarization
      FROM stats_aggregates
      WHERE window_type = ? AND window_start >= datetime('now', ?) AND api_key_id = ? AND model IS NULL
    `).get(windowType, rangeOffset, key_id) as any

    const { items, total } = getPaginatedRequestLogs(key_id, page, pageSize)
    const totalRequests = summary.total_requests || 0
    const patternTotal = (patternDist.full_context || 0) + (patternDist.sliding_window || 0) + (patternDist.summarization || 0)

    return {
      range,
      api_key: apiKey,
      summary: {
        total_requests: totalRequests,
        total_prompt_tokens: summary.total_prompt || 0,
        total_completion_tokens: summary.total_completion || 0,
        avg_efficiency: Math.round(summary.avg_efficiency || 0),
      },
      trend,
      model_distribution: modelDistribution,
      pattern_distribution: {
        full_context: patternDist.full_context || 0,
        sliding_window: patternDist.sliding_window || 0,
        summarization: patternDist.summarization || 0,
        none: Math.max(0, totalRequests - patternTotal),
      },
      requests: {
        items,
        total,
        page,
        page_size: pageSize,
      },
    }
  })

  function detectAnomalies(db: ReturnType<typeof getDb>, windowType: string) {
    const keyIds = db.prepare(`SELECT DISTINCT api_key_id FROM stats_aggregates WHERE window_type = ? AND model IS NULL`).all(windowType) as any[]
    const anomalies: any[] = []
    for (const { api_key_id } of keyIds) {
      const windows = db.prepare(`
        SELECT window_start, total_tokens
        FROM stats_aggregates
        WHERE window_type = ? AND api_key_id = ? AND model IS NULL
        ORDER BY window_start DESC
        LIMIT 2
      `).all(windowType, api_key_id) as any[]
      if (windows.length === 2 && windows[1].total_tokens > 0) {
        const factor = windows[0].total_tokens / windows[1].total_tokens
        if (factor >= 3.0) {
          const keyName = (db.prepare('SELECT name FROM api_keys WHERE id = ?').get(api_key_id) as any)?.name || api_key_id
          anomalies.push({
            api_key_id,
            key_name: keyName,
            spike_factor: Math.round(factor * 10) / 10,
            message: `Token usage increased ${Math.round(factor * 100)}% compared to previous ${windowType}`,
          })
        }
      }
    }
    return anomalies
  }

  // Sessions
  app.get('/api/sessions', async (request) => {
    const db = getDb()
    const query = request.query as any
    const limit = Math.min(parseInt(query?.limit) || 20, 100)
    const offset = parseInt(query?.offset) || 0

    let sql = 'SELECT s.*, k.name as key_name FROM sessions s LEFT JOIN api_keys k ON s.api_key_id = k.id WHERE 1=1'
    const params: any[] = []

    if (query?.key_id) { sql += ' AND s.api_key_id = ?'; params.push(query.key_id) }
    if (query?.pattern) { sql += ' AND s.current_pattern = ?'; params.push(query.pattern) }
    if (query?.status === 'active') {
      sql += " AND s.last_activity > datetime('now', '-5 minutes')"
    } else if (query?.status === 'idle') {
      sql += " AND s.last_activity <= datetime('now', '-5 minutes')"
    }
    if (query?.efficiency_max) {
      sql += ' AND s.message_count > 0 AND (CAST(s.total_prompt_tokens + s.total_completion_tokens AS REAL) / MAX(s.message_count, 1)) <= ?'
      params.push(parseFloat(query.efficiency_max))
    }
    if (query?.time_start) { sql += ' AND s.last_activity >= ?'; params.push(query.time_start) }
    if (query?.time_end) { sql += ' AND s.last_activity <= ?'; params.push(query.time_end) }

    const countSql = sql.replace('SELECT s.*, k.name as key_name', 'SELECT COUNT(*) as total')
    const total = (db.prepare(countSql).get(...params) as any)?.total || 0

    sql += ' ORDER BY s.last_activity DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    return { sessions: db.prepare(sql).all(...params), total, limit, offset }
  })

  app.get('/api/sessions/stats', async () => {
    const db = getDb()
    const totalSessions = (db.prepare('SELECT COUNT(*) as c FROM sessions').get() as any).c
    const activeSessions = (db.prepare("SELECT COUNT(*) as c FROM sessions WHERE last_activity > datetime('now', '-5 minutes')").get() as any).c
    const totalTokens = (db.prepare('SELECT COALESCE(SUM(total_prompt_tokens + total_completion_tokens), 0) as t FROM sessions').get() as any).t
    const avgEfficiency = (db.prepare('SELECT AVG(efficiency_score) as a FROM request_logs').get() as any).a || 0
    const patternDist = db.prepare('SELECT current_pattern as pattern, COUNT(*) as count FROM sessions WHERE current_pattern IS NOT NULL GROUP BY current_pattern').all()
    return { total_sessions: totalSessions, active_sessions: activeSessions, total_tokens: totalTokens, avg_efficiency: Math.round(avgEfficiency), pattern_distribution: patternDist }
  })

  app.get('/api/sessions/:id', async (request) => {
    const { id } = request.params as { id: string }
    const db = getDb()
    const session = db.prepare('SELECT s.*, k.name as key_name FROM sessions s LEFT JOIN api_keys k ON s.api_key_id = k.id WHERE s.session_id = ?').get(id)
    const logs = db.prepare('SELECT * FROM request_logs WHERE session_id = ? ORDER BY created_at').all(id)
    const recentMessages = db.prepare(
      "SELECT json_extract(request_data, '$.messages') as messages FROM request_logs WHERE session_id = ? ORDER BY created_at DESC LIMIT 1"
    ).get(id) as any
    let lastMessages: any[] = []
    try {
      const parsed = recentMessages?.messages ? JSON.parse(recentMessages.messages) : []
      lastMessages = parsed.slice(-5).map((m: any) => ({ role: m.role, content: typeof m.content === 'string' ? m.content.slice(0, 80) : '(non-text)' }))
    } catch {}
    return { session, logs, recent_messages: lastMessages }
  })

  // Analysis
  app.get('/api/analysis/:session_id', async (request) => {
    const { session_id } = request.params as { session_id: string }
    const db = getDb()
    const logs = db.prepare(
      'SELECT efficiency_score, detected_pattern, created_at FROM request_logs WHERE session_id = ? ORDER BY created_at'
    ).all(session_id)
    return { session_id, logs }
  })

  // Provider Models
  app.get('/api/providers/:name/models', async (request) => {
    const { name } = request.params as { name: string }
    const config = loadConfig()
    const provider = config.Providers.find((p: Provider) => p.name === name)
    if (!provider) {
      return { models: [], error: 'Provider not found' }
    }

    // Try to return cached models first
    const cached = listProviderModels(name)
    if (cached.length > 0) {
      return {
        models: cached.map(c => c.model_id),
        fetched_at: cached[0].fetched_at,
      }
    }

    try {
      const base = provider.api_base_url.replace(/\/$/, '')
      let url: string
      let headers: Record<string, string> = {}

      if (provider.template === 'anthropic') {
        const anthropicModels = [
          'claude-3-5-sonnet-20241022',
          'claude-3-5-sonnet-20240620',
          'claude-3-opus-20240229',
          'claude-3-sonnet-20240229',
          'claude-3-haiku-20240307',
        ]
        insertProviderModels(name, anthropicModels)
        return { models: anthropicModels, fetched_at: timestamp() }
      }

      // OpenAI-compatible
      url = base.endsWith('/v1') ? `${base}/models` : `${base}/v1/models`
      headers = { Authorization: `Bearer ${provider.api_key}` }

      const res = await fetch(url, { headers })
      if (!res.ok) {
        return { models: [], error: `Upstream error: ${res.status}` }
      }

      const data = await res.json() as any
      const models = (data.data || []).map((m: any) => m.id).filter(Boolean) as string[]

      if (models.length > 0) {
        clearProviderModels(name)
        insertProviderModels(name, models)
      }

      return { models, fetched_at: timestamp() }
    } catch (err: any) {
      return { models: [], error: err.message || 'Failed to fetch models' }
    }
  })

  // Config
  app.get('/api/config', async () => {
    const config = loadConfig()
    return maskConfig(config)
  })

  app.put('/api/config', async (request) => {
    const incoming = request.body as Partial<AppConfig>
    const current = loadConfig()

    // Merge: restore masked api_keys
    if (incoming.Providers) {
      incoming.Providers = incoming.Providers.map((p, i) => {
        if (p.api_key?.includes('***') && current.Providers[i]?.api_key) {
          return { ...p, api_key: current.Providers[i].api_key }
        }
        return p
      })
    }

    const merged: AppConfig = { ...current, ...incoming }
    // Ensure all detector entries preserve defaults
    merged.Detectors = { ...current.Detectors, ...incoming.Detectors }

    saveConfig(merged)
    return { ok: true, config: maskConfig(merged) }
  })
}

function maskConfig(config: AppConfig) {
  return {
    ...config,
    Providers: config.Providers.map((p: Provider) => ({
      ...p,
      api_key: p.api_key ? p.api_key.slice(0, 4) + '***' : '',
    })),
  }
}
