/**
 * Recalculate estimated_cost for existing request_logs and rebuild stats_aggregates.
 * Usage: npx tsx scripts/recalculate-costs.ts
 */
import { expandTilde } from '../packages/shared/src/index.js'
import { computeCost } from '../packages/server/src/proxy/pricing.js'
import { loadConfig, getDefaultConfig } from '../packages/server/src/configLoader.js'
import { getDb } from '../packages/server/src/db/schema.js'

const config = loadConfig()
const dbPath = expandTilde(config.DATABASE || '~/.tokenflow/tokenflow.db')
// Use getDb to trigger migrations (adds missing estimated_cost column)
const db = getDb(dbPath)

console.log(`Connected to ${dbPath}`)

// Merge saved config pricing with defaults so new entries are available
const pricingTable = { ...getDefaultConfig().Pricing, ...config.Pricing }

// 1. Update request_logs estimated_cost
const logs = db.prepare(`
  SELECT id, model, prompt_tokens, completion_tokens FROM request_logs
`).all() as Array<{ id: string; model: string; prompt_tokens: number; completion_tokens: number }>

const updateLog = db.prepare('UPDATE request_logs SET estimated_cost = ? WHERE id = ?')
let updatedLogs = 0
let zeroCostLogs = 0

for (const log of logs) {
  const cost = computeCost(log.model, log.prompt_tokens, log.completion_tokens, pricingTable)
  updateLog.run(cost, log.id)
  updatedLogs++
  if (cost === 0) zeroCostLogs++
}

console.log(`Updated ${updatedLogs} request_logs (${zeroCostLogs} still zero due to missing pricing)`)

// 2. Rebuild stats_aggregates from scratch
db.prepare('DELETE FROM stats_aggregates').run()

const allLogs = db.prepare(`
  SELECT
    api_key_id,
    model,
    prompt_tokens,
    completion_tokens,
    total_tokens,
    efficiency_score,
    detected_pattern,
    estimated_cost,
    created_at
  FROM request_logs
`).all() as Array<{
  api_key_id: string
  model: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  efficiency_score: number
  detected_pattern: string | null
  estimated_cost: number
  created_at: string
}>

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

const insertAgg = db.prepare(`
  INSERT OR IGNORE INTO stats_aggregates
  (window_type, window_start, api_key_id, model, request_count, prompt_tokens, completion_tokens, total_tokens, avg_efficiency, estimated_cost)
  VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 0)
`)

const validPatterns = ['full_context', 'sliding_window', 'summarization']

for (const log of allLogs) {
  const createdAt = new Date(log.created_at)
  const hourWindow = floorToHour(createdAt)
  const dayWindow = floorToDay(createdAt)

  for (const { window_type, window_start } of [
    { window_type: 'hour', window_start: hourWindow },
    { window_type: 'day', window_start: dayWindow },
  ]) {
    for (const model of [log.model, null]) {
      insertAgg.run(window_type, window_start, log.api_key_id, model)

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
        log.estimated_cost,
        window_type,
        window_start,
        log.api_key_id,
        model,
      )
    }
  }
}

console.log(`Rebuilt stats_aggregates from ${allLogs.length} request_logs`)

db.close()
console.log('Done.')
