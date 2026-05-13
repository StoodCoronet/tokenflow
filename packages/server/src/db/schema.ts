import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { expandTilde, generateId, timestamp } from '@tokenflow/shared'
import type { ApiKey } from '@tokenflow/shared'

let db: Database.Database | null = null

/** Reset the DB singleton — for testing only */
export function resetDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

export function getDb(dbPath?: string): Database.Database {
  if (db) return db

  const path = expandTilde(dbPath ?? process.env.TOKENFLOW_DB_PATH ?? '~/.tokenflow/tokenflow.db')
  const dir = dirname(path)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  db = new Database(path)
  db.pragma('journal_mode = WAL')
  migrate(db)
  return db
}

function migrate(db: Database.Database): void {
  // Check if api_keys table exists with old schema (has upstream_key column)
  const hasUpstreamKey = db.prepare(
    `SELECT 1 FROM pragma_table_info('api_keys') WHERE name = 'upstream_key'`
  ).get()

  if (hasUpstreamKey) {
    // Migrate: recreate api_keys without upstream_key and base_url
    db.exec(`
      CREATE TABLE api_keys_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        scenario TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO api_keys_new
        SELECT id, name, provider, scenario, created_at, updated_at FROM api_keys;
      DROP TABLE api_keys;
      ALTER TABLE api_keys_new RENAME TO api_keys;
    `)
  } else {
    db.exec(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        scenario TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `)
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS request_logs (
      id TEXT PRIMARY KEY,
      api_key_id TEXT NOT NULL,
      session_id TEXT,
      model TEXT NOT NULL,
      prompt_tokens INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'success',
      detected_pattern TEXT,
      efficiency_score REAL DEFAULT 0,
      request_data TEXT,
      response_data TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      api_key_id TEXT NOT NULL,
      start_time TEXT NOT NULL,
      last_activity TEXT NOT NULL,
      message_count INTEGER DEFAULT 0,
      total_prompt_tokens INTEGER DEFAULT 0,
      total_completion_tokens INTEGER DEFAULT 0,
      current_pattern TEXT,
      FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
    );

    CREATE TABLE IF NOT EXISTS provider_models (
      provider_name TEXT NOT NULL,
      model_id TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      PRIMARY KEY (provider_name, model_id)
    );

    CREATE TABLE IF NOT EXISTS stats_aggregates (
      window_type TEXT NOT NULL,
      window_start TEXT NOT NULL,
      api_key_id TEXT NOT NULL,
      model TEXT,
      request_count INTEGER DEFAULT 0,
      prompt_tokens INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      avg_efficiency REAL DEFAULT 0,
      pattern_full_context INTEGER DEFAULT 0,
      pattern_sliding_window INTEGER DEFAULT 0,
      pattern_summarization INTEGER DEFAULT 0,
      estimated_cost REAL DEFAULT 0,
      PRIMARY KEY (window_type, window_start, api_key_id, model)
    );
    CREATE INDEX IF NOT EXISTS idx_stats_window ON stats_aggregates(window_type, window_start);
    CREATE INDEX IF NOT EXISTS idx_stats_key ON stats_aggregates(api_key_id, window_type, window_start);
  `)
}

// --- Provider Models CRUD ---

export function insertProviderModels(providerName: string, models: string[]) {
  const db = getDb()
  const now = timestamp()
  const stmt = db.prepare(`INSERT OR REPLACE INTO provider_models (provider_name, model_id, fetched_at) VALUES (?, ?, ?)`)
  db.transaction(() => {
    for (const modelId of models) {
      stmt.run(providerName, modelId, now)
    }
  })()
}

export function listProviderModels(providerName: string) {
  return getDb().prepare('SELECT model_id, fetched_at FROM provider_models WHERE provider_name = ?').all(providerName) as { model_id: string; fetched_at: string }[]
}

export function clearProviderModels(providerName: string) {
  return getDb().prepare('DELETE FROM provider_models WHERE provider_name = ?').run(providerName)
}

// --- API Key CRUD ---

export function createApiKey(data: { name: string; provider: string; scenario?: string }) {
  const db = getDb()
  const id = generateId()
  const now = timestamp()
  db.prepare(`
    INSERT INTO api_keys (id, name, provider, scenario, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, data.name, data.provider, data.scenario ?? null, now, now)
  return { id, ...data, created_at: now, updated_at: now }
}

export function listApiKeys() {
  return getDb().prepare('SELECT id, name, provider, scenario, created_at, updated_at FROM api_keys').all()
}

export function getApiKey(id: string): ApiKey | undefined {
  return getDb().prepare('SELECT * FROM api_keys WHERE id = ?').get(id) as ApiKey | undefined
}

export function updateApiKey(id: string, data: { name?: string; provider?: string; scenario?: string }) {
  const db = getDb()
  const now = timestamp()
  const sets: string[] = []
  const values: any[] = []
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      sets.push(`${key} = ?`)
      values.push(val)
    }
  }
  if (sets.length === 0) return getApiKey(id)
  sets.push('updated_at = ?')
  values.push(now)
  values.push(id)
  db.prepare(`UPDATE api_keys SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  return getApiKey(id)
}

export function deleteApiKey(id: string) {
  return getDb().prepare('DELETE FROM api_keys WHERE id = ?').run(id)
}

// --- Request Log ---

export function insertRequestLog(log: {
  id: string
  api_key_id: string
  session_id: string | null
  model: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  status: string
  detected_pattern: string | null
  efficiency_score: number
  request_data: string
  response_data: string
  estimated_cost?: number
}) {
  const db = getDb()
  db.prepare(`
    INSERT INTO request_logs (id, api_key_id, session_id, model, prompt_tokens, completion_tokens,
      total_tokens, status, detected_pattern, efficiency_score, request_data, response_data, created_at, estimated_cost)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(log.id, log.api_key_id, log.session_id, log.model, log.prompt_tokens, log.completion_tokens,
    log.total_tokens, log.status, log.detected_pattern, log.efficiency_score, log.request_data, log.response_data, timestamp(),
    log.estimated_cost ?? 0)
}

// --- Session ---

export function getSession(sessionId: string) {
  return getDb().prepare('SELECT * FROM sessions WHERE session_id = ?').get(sessionId)
}

export function upsertSession(data: {
  session_id: string
  api_key_id: string
  prompt_tokens: number
  completion_tokens: number
  detected_pattern: string | null
}) {
  const db = getDb()
  const now = timestamp()
  const existing = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(data.session_id) as any

  if (existing) {
    db.prepare(`
      UPDATE sessions SET
        last_activity = ?,
        message_count = message_count + 1,
        total_prompt_tokens = total_prompt_tokens + ?,
        total_completion_tokens = total_completion_tokens + ?,
        current_pattern = COALESCE(?, current_pattern)
      WHERE session_id = ?
    `).run(now, data.prompt_tokens, data.completion_tokens, data.detected_pattern, data.session_id)
  } else {
    db.prepare(`
      INSERT INTO sessions (session_id, api_key_id, start_time, last_activity, message_count,
        total_prompt_tokens, total_completion_tokens, current_pattern)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?)
    `).run(data.session_id, data.api_key_id, now, now, data.prompt_tokens, data.completion_tokens, data.detected_pattern)
  }
}

// --- Stats Aggregation ---

function floorToHour(date: Date): string {
  const d = new Date(date)
  d.setMinutes(0, 0, 0)
  return d.toISOString()
}

function floorToDay(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function upsertStatsAggregate(log: {
  api_key_id: string
  model: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  efficiency_score: number
  detected_pattern: string | null
  estimated_cost?: number
}) {
  const now = new Date()
  const hourWindow = floorToHour(now)
  const dayWindow = floorToDay(now)

  for (const { window_type, window_start } of [
    { window_type: 'hour', window_start: hourWindow },
    { window_type: 'day', window_start: dayWindow },
  ]) {
    _upsertStatsRow(window_type, window_start, log.api_key_id, log.model, log)
    _upsertStatsRow(window_type, window_start, log.api_key_id, null, log)
  }
}

function _upsertStatsRow(
  window_type: string,
  window_start: string,
  api_key_id: string,
  model: string | null,
  log: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    efficiency_score: number
    detected_pattern: string | null
    estimated_cost?: number
  }
) {
  const db = getDb()
  const modelVal = model ?? null

  db.prepare(`
    INSERT OR IGNORE INTO stats_aggregates
    (window_type, window_start, api_key_id, model, request_count, prompt_tokens, completion_tokens, total_tokens, avg_efficiency, estimated_cost)
    VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 0)
  `).run(window_type, window_start, api_key_id, modelVal)

  const validPatterns = ['full_context', 'sliding_window', 'summarization']
  const patternCol = log.detected_pattern && validPatterns.includes(log.detected_pattern)
    ? `pattern_${log.detected_pattern}`
    : null

  const patternUpdate = patternCol ? `, ${patternCol} = ${patternCol} + 1` : ''

  db.prepare(`
    UPDATE stats_aggregates SET
      request_count = request_count + 1,
      prompt_tokens = prompt_tokens + ?,
      completion_tokens = completion_tokens + ?,
      total_tokens = total_tokens + ?,
      avg_efficiency = (avg_efficiency * request_count + ?) / (request_count + 1),
      estimated_cost = estimated_cost + ?
      ${patternUpdate}
    WHERE window_type = ? AND window_start = ? AND api_key_id = ? AND model IS ?
  `).run(
    log.prompt_tokens,
    log.completion_tokens,
    log.total_tokens,
    log.efficiency_score,
    log.estimated_cost ?? 0,
    window_type,
    window_start,
    api_key_id,
    modelVal
  )
}

export function cleanupOldStats() {
  getDb().prepare("DELETE FROM stats_aggregates WHERE window_start < datetime('now', '-90 days')").run()
}

export function getPaginatedRequestLogs(apiKeyId: string, page: number, pageSize: number) {
  const db = getDb()
  const offset = (page - 1) * pageSize
  const items = db.prepare(
    'SELECT id, model, prompt_tokens, completion_tokens, total_tokens, status, detected_pattern, efficiency_score, created_at, request_data, response_data FROM request_logs WHERE api_key_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(apiKeyId, pageSize, offset)
  const total = (db.prepare('SELECT COUNT(*) as total FROM request_logs WHERE api_key_id = ?').get(apiKeyId) as any).total
  return { items, total, page, page_size: pageSize }
}
