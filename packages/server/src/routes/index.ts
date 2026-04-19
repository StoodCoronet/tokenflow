import type { FastifyInstance } from 'fastify'
import { getDb, listApiKeys, createApiKey, deleteApiKey, getApiKey, updateApiKey } from '../db/schema.js'
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
      upstream_key: body.upstream_key,
      base_url: body.base_url,
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
      upstream_key: body.upstream_key,
      base_url: body.base_url,
      scenario: body.scenario,
    })
  })

  // Dashboard stats
  app.get('/api/dashboard', async () => {
    const db = getDb()
    const totalRequests = db.prepare('SELECT COUNT(*) as count FROM request_logs').get() as any
    const totalTokens = db.prepare('SELECT SUM(total_tokens) as total FROM request_logs').get() as any
    const avgEfficiency = db.prepare('SELECT AVG(efficiency_score) as avg FROM request_logs').get() as any
    const recentLogs = db.prepare(
      'SELECT id, model, prompt_tokens, completion_tokens, total_tokens, status, detected_pattern, efficiency_score, created_at FROM request_logs ORDER BY created_at DESC LIMIT 50'
    ).all()
    const sessions = db.prepare(
      'SELECT * FROM sessions ORDER BY last_activity DESC LIMIT 20'
    ).all()

    return {
      total_requests: totalRequests.count,
      total_tokens: totalTokens.total || 0,
      avg_efficiency: Math.round(avgEfficiency.avg || 0),
      recent_logs: recentLogs,
      sessions,
    }
  })

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
