import type { FastifyInstance } from 'fastify'
import { getDb, listApiKeys, createApiKey, deleteApiKey, getApiKey } from '../db/schema.js'

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
  app.get('/api/sessions', async () => {
    const db = getDb()
    return db.prepare('SELECT * FROM sessions ORDER BY last_activity DESC LIMIT 50').all()
  })

  app.get('/api/sessions/:id', async (request) => {
    const { id } = request.params as { id: string }
    const db = getDb()
    const session = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(id)
    const logs = db.prepare('SELECT * FROM request_logs WHERE session_id = ? ORDER BY created_at').all(id)
    return { session, logs }
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
}
