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
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      upstream_key TEXT NOT NULL,
      base_url TEXT NOT NULL,
      scenario TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

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
  `)
}

// --- API Key CRUD ---

export function createApiKey(data: { name: string; provider: string; upstream_key: string; base_url: string; scenario?: string }) {
  const db = getDb()
  const id = generateId()
  const now = timestamp()
  db.prepare(`
    INSERT INTO api_keys (id, name, provider, upstream_key, base_url, scenario, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.name, data.provider, data.upstream_key, data.base_url, data.scenario ?? null, now, now)
  return { id, ...data, created_at: now, updated_at: now }
}

export function listApiKeys() {
  return getDb().prepare('SELECT id, name, provider, base_url, scenario, created_at, updated_at FROM api_keys').all()
}

export function getApiKey(id: string): ApiKey | undefined {
  return getDb().prepare('SELECT * FROM api_keys WHERE id = ?').get(id) as ApiKey | undefined
}

export function updateApiKey(id: string, data: { name?: string; provider?: string; upstream_key?: string; base_url?: string; scenario?: string }) {
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
}) {
  const db = getDb()
  db.prepare(`
    INSERT INTO request_logs (id, api_key_id, session_id, model, prompt_tokens, completion_tokens,
      total_tokens, status, detected_pattern, efficiency_score, request_data, response_data, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(log.id, log.api_key_id, log.session_id, log.model, log.prompt_tokens, log.completion_tokens,
    log.total_tokens, log.status, log.detected_pattern, log.efficiency_score, log.request_data, log.response_data, timestamp())
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
