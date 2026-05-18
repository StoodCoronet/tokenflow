/**
 * Generate 7-day realistic usage data (~100M tokens) directly into SQLite.
 * Usage: npx tsx scripts/generate-100m-sim.ts [--db <path>] [--force]
 */
import Database from 'better-sqlite3'
import { expandTilde } from '../packages/shared/src/index.js'
import { computeCost } from '../packages/server/src/proxy/pricing.js'
import { loadConfig, getDefaultConfig } from '../packages/server/src/configLoader.js'
import { getDb, resetDb, createApiKey } from '../packages/server/src/db/schema.js'

// ── Config ──
const TOTAL_TOKENS_TARGET = 100_000_000
const DEV_TOKENS = 40_000_000
const BIZ_TOKENS = 60_000_000
const DAYS = 7
const ERROR_RATE_OVERALL = 0.04

// ── Seeded RNG ──
function makeRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}
const rng = makeRng(42)

function randInt(min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min
}

function randPick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)]
}

function randBool(prob: number) {
  return rng() < prob
}

function randNorm(mean: number, std: number): number {
  // Box-Muller
  const u1 = rng()
  const u2 = rng()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + z * std
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

// ── Time helpers ──
function floorToHour(d: Date): string {
  const c = new Date(d)
  c.setMinutes(0, 0, 0)
  return c.toISOString()
}

function floorToDay(d: Date): string {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c.toISOString()
}

function getDayOfWeek(d: Date): number {
  return d.getDay()
}

function isWeekend(d: Date): boolean {
  const dow = getDayOfWeek(d)
  return dow === 0 || dow === 6
}

// ── Role definitions ──
interface RoleDef {
  name: string
  provider: string
  scenario: string
  modelWeights: Record<string, number>
  pattern: 'full_context' | 'sliding_window' | 'summarization' | 'random'
  sessionType: 'cross_day' | 'ttl_30min' | 'per_batch'
  activeHours: [number, number][] // inclusive start, exclusive end
  promptMin: number
  promptMax: number
  completionMin: number
  completionMax: number
  targetTokens: number
  errorRate: number
  rampDay: number // day index (0-6) when this key is created
}

const ROLES: RoleDef[] = [
  // ── Dev ──
  {
    name: 'Frontend Engineer',
    provider: 'openai-prod',
    scenario: 'Frontend Dev',
    modelWeights: { 'gpt-4o': 1 },
    pattern: 'sliding_window',
    sessionType: 'cross_day',
    activeHours: [[9, 22]],
    promptMin: 500, promptMax: 2000,
    completionMin: 300, completionMax: 800,
    targetTokens: 8_000_000,
    errorRate: 0.01,
    rampDay: 0,
  },
  {
    name: 'Backend Engineer',
    provider: 'anthropic-internal',
    scenario: 'Backend Dev',
    modelWeights: { 'claude-3-5-sonnet-20241022': 0.7, 'claude-3-opus-20240229': 0.3 },
    pattern: 'sliding_window',
    sessionType: 'cross_day',
    activeHours: [[9, 22]],
    promptMin: 500, promptMax: 2000,
    completionMin: 300, completionMax: 800,
    targetTokens: 8_000_000,
    errorRate: 0.01,
    rampDay: 0,
  },
  {
    name: 'Data Scientist',
    provider: 'openai-prod',
    scenario: 'Data Science',
    modelWeights: { 'gpt-4o': 0.6, 'claude-3-5-sonnet-20241022': 0.4 },
    pattern: 'full_context',
    sessionType: 'cross_day',
    activeHours: [[9, 22]],
    promptMin: 600, promptMax: 2500,
    completionMin: 400, completionMax: 1000,
    targetTokens: 8_000_000,
    errorRate: 0.01,
    rampDay: 0,
  },
  {
    name: 'Experiment/Debug Bot',
    provider: 'openrouter-prod',
    scenario: 'Experimentation',
    modelWeights: {
      'openai/gpt-4o': 0.2,
      'anthropic/claude-3-5-sonnet': 0.2,
      'google/gemini-1.5-pro': 0.2,
      'deepseek-chat': 0.2,
      'gemini-1.5-flash': 0.2,
    },
    pattern: 'random',
    sessionType: 'ttl_30min',
    activeHours: [[9, 22]],
    promptMin: 50, promptMax: 200,
    completionMin: 30, completionMax: 100,
    targetTokens: 6_000_000,
    errorRate: 0.15,
    rampDay: 2,
  },
  {
    name: 'CI/CD Code Review',
    provider: 'openai-prod',
    scenario: 'CI/CD',
    modelWeights: { 'gpt-4o-mini': 1 },
    pattern: 'summarization',
    sessionType: 'per_batch',
    activeHours: [[2, 6]],
    promptMin: 1000, promptMax: 3000,
    completionMin: 200, completionMax: 600,
    targetTokens: 10_000_000,
    errorRate: 0.02,
    rampDay: 4,
  },
  // ── Business ──
  {
    name: 'Customer Service Auto-Reply',
    provider: 'openai-prod',
    scenario: 'Customer Support',
    modelWeights: { 'gpt-4o-mini': 1 },
    pattern: 'summarization',
    sessionType: 'ttl_30min',
    activeHours: [[0, 24]],
    promptMin: 30, promptMax: 80,
    completionMin: 20, completionMax: 70,
    targetTokens: 15_000_000,
    errorRate: 0.05,
    rampDay: 3,
  },
  {
    name: 'Document Generation SaaS',
    provider: 'gemini-data',
    scenario: 'Document Gen',
    modelWeights: { 'gemini-1.5-pro': 1 },
    pattern: 'full_context',
    sessionType: 'per_batch',
    activeHours: [[9, 22]],
    promptMin: 500, promptMax: 1500,
    completionMin: 3000, completionMax: 8000,
    targetTokens: 20_000_000,
    errorRate: 0.01,
    rampDay: 3,
  },
  {
    name: 'Internal Knowledge Base',
    provider: 'openai-prod',
    scenario: 'KB Search',
    modelWeights: { 'gpt-4o-mini': 1 },
    pattern: 'sliding_window',
    sessionType: 'ttl_30min',
    activeHours: [[9, 18]],
    promptMin: 200, promptMax: 500,
    completionMin: 100, completionMax: 300,
    targetTokens: 8_000_000,
    errorRate: 0.01,
    rampDay: 2,
  },
  {
    name: 'Marketing Copy Generator',
    provider: 'anthropic-internal',
    scenario: 'Marketing',
    modelWeights: { 'claude-3-5-sonnet-20241022': 0.5, 'gpt-4o': 0.5 },
    pattern: 'full_context',
    sessionType: 'per_batch',
    activeHours: [[9, 18]],
    promptMin: 300, promptMax: 800,
    completionMin: 500, completionMax: 1500,
    targetTokens: 10_000_000,
    errorRate: 0.01,
    rampDay: 5,
  },
  {
    name: 'User Behavior Analytics',
    provider: 'openai-prod',
    scenario: 'Analytics',
    modelWeights: { 'gpt-4o-mini': 1 },
    pattern: 'summarization',
    sessionType: 'per_batch',
    activeHours: [[1, 5]],
    promptMin: 800, promptMax: 2000,
    completionMin: 300, completionMax: 800,
    targetTokens: 7_000_000,
    errorRate: 0.01,
    rampDay: 5,
  },
]

// ── Hourly weights ──
function makeHourWeights(activeHours: [number, number][], shape: 'gaussian' | 'flat' | 'bimodal' = 'flat'): number[] {
  const w = new Array(24).fill(0)
  for (const [start, end] of activeHours) {
    for (let h = start; h < end; h++) {
      w[h % 24] = 1
    }
  }
  if (shape === 'gaussian') {
    // Peak at 14:00
    for (let h = 0; h < 24; h++) {
      if (w[h] > 0) {
        const dist = Math.abs(h - 14)
        w[h] *= Math.exp(-dist * dist / 18)
      }
    }
  } else if (shape === 'bimodal') {
    // Morning 9-11 + evening 20-22
    for (let h = 0; h < 24; h++) {
      if (w[h] > 0) {
        const d1 = Math.abs(h - 10)
        const d2 = Math.abs(h - 21)
        w[h] *= Math.max(Math.exp(-d1 * d1 / 4), Math.exp(-d2 * d2 / 4), 0.15)
      }
    }
  }
  return w
}

const ROLE_HOUR_WEIGHTS = [
  makeHourWeights([[9, 22]], 'gaussian'),      // Frontend
  makeHourWeights([[9, 22]], 'gaussian'),      // Backend
  makeHourWeights([[9, 22]], 'gaussian'),      // Data Scientist
  makeHourWeights([[9, 22]], 'gaussian'),      // Experiment
  makeHourWeights([[2, 6]], 'flat'),           // CI/CD
  makeHourWeights([[0, 24]], 'bimodal'),       // Customer Service
  makeHourWeights([[9, 22]], 'flat'),          // Document Gen
  makeHourWeights([[9, 18]], 'flat'),          // KB Search
  makeHourWeights([[9, 18]], 'flat'),          // Marketing
  makeHourWeights([[1, 5]], 'flat'),           // Analytics
]

// ── Args ──
const args = process.argv.slice(2)
const get = (flag: string, def: string) => {
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] ?? def : def
}
const has = (flag: string) => args.includes(flag)

const dbPathOverride = get('--db', '')
const force = has('--force')

// ── Main ──
async function main() {
  const config = loadConfig()
  const dbPath = dbPathOverride
    ? expandTilde(dbPathOverride)
    : expandTilde(config.DATABASE || '~/.tokenflow/tokenflow.db')

  // Connect and migrate
  resetDb()
  const db = getDb(dbPath)

  // Check existing data
  const existing = db.prepare('SELECT COUNT(*) as c FROM request_logs').get() as { c: number }
  if (existing.c > 0 && !force) {
    console.error(`Database already has ${existing.c} request_logs. Use --force to truncate.`)
    process.exit(1)
  }
  if (force && existing.c > 0) {
    console.log('Truncating existing data...')
    db.prepare('DELETE FROM request_logs').run()
    db.prepare('DELETE FROM sessions').run()
    db.prepare('DELETE FROM stats_aggregates').run()
    db.prepare('DELETE FROM api_keys').run()
    db.prepare('DELETE FROM provider_models').run()
  }

  const pricingTable = { ...getDefaultConfig().Pricing, ...config.Pricing }

  // Generate time windows
  const now = new Date()
  const endTime = now.getTime()
  const startTime = endTime - DAYS * 24 * 60 * 60 * 1000

  // Helper: pick a model by weight
  function pickModel(weights: Record<string, number>): string {
    const entries = Object.entries(weights)
    const total = entries.reduce((s, [, w]) => s + w, 0)
    let r = rng() * total
    for (const [m, w] of entries) {
      r -= w
      if (r <= 0) return m
    }
    return entries[entries.length - 1][0]
  }

  // Helper: generate tokens for a role
  function genTokens(role: RoleDef) {
    const prompt = clamp(randNorm((role.promptMin + role.promptMax) / 2, (role.promptMax - role.promptMin) / 4), role.promptMin, role.promptMax)
    const completion = clamp(randNorm((role.completionMin + role.completionMax) / 2, (role.completionMax - role.completionMin) / 4), role.completionMin, role.completionMax)
    return { prompt: Math.round(prompt), completion: Math.round(completion) }
  }

  // Create api_keys
  const keys = ROLES.map((role) => {
    const key = createApiKey({ name: role.name, provider: role.provider, scenario: role.scenario })
    return { ...key, role }
  })

  // Pre-calculate request counts per role to hit token targets
  // Average tokens per request for each role
  const roleAvgTokens = ROLES.map((r) => {
    const avgPrompt = (r.promptMin + r.promptMax) / 2
    const avgCompletion = (r.completionMin + r.completionMax) / 2
    return avgPrompt + avgCompletion
  })

  const roleRequestCounts = ROLES.map((r, i) => Math.round(r.targetTokens / roleAvgTokens[i]))
  const totalRequests = roleRequestCounts.reduce((a, b) => a + b, 0)
  console.log(`Target: ${TOTAL_TOKENS_TARGET.toLocaleString()} tokens across ${totalRequests.toLocaleString()} requests`)

  // Generate all request times per role
  type SimRequest = {
    time: Date
    keyIndex: number
    model: string
    promptTokens: number
    completionTokens: number
    status: string
    pattern: string
    efficiencyScore: number
  }

  const allRequests: SimRequest[] = []

  for (let ki = 0; ki < ROLES.length; ki++) {
    const role = ROLES[ki]
    const count = roleRequestCounts[ki]
    const hourWeights = ROLE_HOUR_WEIGHTS[ki]

    // Only generate requests on/after rampDay
    const roleStart = startTime + role.rampDay * 24 * 60 * 60 * 1000

    // Compute cumulative weight table for hours
    const hourCum: number[] = []
    let cum = 0
    for (let d = 0; d < DAYS; d++) {
      const dayTimestamp = startTime + d * 24 * 60 * 60 * 1000
      const dayDate = new Date(dayTimestamp)
      const weekendFactor = isWeekend(dayDate) ? 0.3 : 1.0
      for (let h = 0; h < 24; h++) {
        if (dayTimestamp + h * 3600_000 >= roleStart) {
          cum += hourWeights[h] * weekendFactor
        }
        hourCum.push(cum)
      }
    }

    for (let i = 0; i < count; i++) {
      const r = rng() * cum
      // Binary search for hour bucket
      let lo = 0, hi = hourCum.length - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (hourCum[mid] < r) lo = mid + 1
        else hi = mid
      }
      const bucket = lo
      const dayOffset = Math.floor(bucket / 24)
      const hour = bucket % 24
      const minute = rng() * 60
      const second = rng() * 60
      const ms = rng() * 1000
      const time = new Date(startTime + dayOffset * 24 * 60 * 60 * 1000 + hour * 3600_000 + minute * 60_000 + second * 1000 + ms)

      const { prompt, completion } = genTokens(role)
      const isError = randBool(role.errorRate)
      const status = isError ? (randBool(0.5) ? 'error' : 'timeout') : 'success'
      const model = pickModel(role.modelWeights)

      allRequests.push({
        time,
        keyIndex: ki,
        model,
        promptTokens: prompt,
        completionTokens: completion,
        status,
        pattern: role.pattern === 'random' ? randPick(['full_context', 'sliding_window', 'summarization']) : role.pattern,
        efficiencyScore: randInt(70, 100),
      })
    }
  }

  // Sort by time
  allRequests.sort((a, b) => a.time.getTime() - b.time.getTime())

  console.log(`Generated ${allRequests.length} requests. Inserting...`)

  // Session management
  const sessionMap = new Map<string, { id: string; lastActive: number; keyIndex: number }>()

  function getSessionId(req: SimRequest): string {
    const role = ROLES[req.keyIndex]
    if (role.sessionType === 'per_batch') {
      return `batch-${req.keyIndex}-${floorToHour(req.time)}`
    }
    if (role.sessionType === 'ttl_30min') {
      const key = `ttl-${req.keyIndex}`
      const existing = sessionMap.get(key)
      const nowMs = req.time.getTime()
      if (existing && nowMs - existing.lastActive < 30 * 60 * 1000 && existing.keyIndex === req.keyIndex) {
        existing.lastActive = nowMs
        return existing.id
      }
      const id = `session-${req.keyIndex}-${nowMs}`
      sessionMap.set(key, { id, lastActive: nowMs, keyIndex: req.keyIndex })
      return id
    }
    // cross_day: one session per key
    const key = `cross-${req.keyIndex}`
    const existing = sessionMap.get(key)
    if (existing) {
      existing.lastActive = req.time.getTime()
      return existing.id
    }
    const id = `session-${req.keyIndex}-0`
    sessionMap.set(key, { id, lastActive: req.time.getTime(), keyIndex: req.keyIndex })
    return id
  }

  // DB statements
  const insertLog = db.prepare(`
    INSERT INTO request_logs (id, api_key_id, session_id, model, prompt_tokens, completion_tokens,
      total_tokens, status, detected_pattern, efficiency_score, request_data, response_data, created_at, estimated_cost)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertSession = db.prepare(`
    INSERT OR IGNORE INTO sessions (session_id, api_key_id, start_time, last_activity, message_count,
      total_prompt_tokens, total_completion_tokens, current_pattern)
    VALUES (?, ?, ?, ?, 0, 0, 0, ?)
  `)

  const updateSession = db.prepare(`
    UPDATE sessions SET
      last_activity = ?,
      message_count = message_count + 1,
      total_prompt_tokens = total_prompt_tokens + ?,
      total_completion_tokens = total_completion_tokens + ?,
      current_pattern = COALESCE(?, current_pattern)
    WHERE session_id = ?
  `)

  const insertAgg = db.prepare(`
    INSERT OR IGNORE INTO stats_aggregates
    (window_type, window_start, api_key_id, model, request_count, prompt_tokens, completion_tokens, total_tokens, avg_efficiency, estimated_cost)
    VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 0)
  `)

  const updateAgg = db.prepare(`
    UPDATE stats_aggregates SET
      request_count = request_count + 1,
      prompt_tokens = prompt_tokens + ?,
      completion_tokens = completion_tokens + ?,
      total_tokens = total_tokens + ?,
      avg_efficiency = (avg_efficiency * request_count + ?) / (request_count + 1),
      estimated_cost = estimated_cost + ?
    WHERE window_type = ? AND window_start = ? AND api_key_id = ? AND model IS ?
  `)

  const validPatterns = ['full_context', 'sliding_window', 'summarization']

  let inserted = 0
  let totalPrompt = 0
  let totalCompletion = 0
  let totalCost = 0

  for (const req of allRequests) {
    const key = keys[req.keyIndex]
    const sessionId = getSessionId(req)
    const totalTokens = req.promptTokens + req.completionTokens
    const cost = computeCost(req.model, req.promptTokens, req.completionTokens, pricingTable)
    const nowIso = req.time.toISOString()

    insertLog.run(
      `req-${inserted}`, key.id, sessionId, req.model,
      req.promptTokens, req.completionTokens, totalTokens,
      req.status, req.pattern, req.efficiencyScore,
      '{}', '{}', nowIso, cost
    )

    const existingSession = db.prepare('SELECT 1 FROM sessions WHERE session_id = ?').get(sessionId)
    if (!existingSession) {
      insertSession.run(sessionId, key.id, nowIso, nowIso, req.pattern)
    }
    updateSession.run(nowIso, req.promptTokens, req.completionTokens, req.pattern, sessionId)

    const hourWindow = floorToHour(req.time)
    const dayWindow = floorToDay(req.time)

    for (const { wt, ws } of [{ wt: 'hour', ws: hourWindow }, { wt: 'day', ws: dayWindow }]) {
      for (const m of [req.model, null]) {
        insertAgg.run(wt, ws, key.id, m)
        updateAgg.run(req.promptTokens, req.completionTokens, totalTokens, req.efficiencyScore, cost, wt, ws, key.id, m)
      }
    }

    // Pattern counters
    if (validPatterns.includes(req.pattern)) {
      const col = `pattern_${req.pattern}`
      db.prepare(`
        UPDATE stats_aggregates SET ${col} = ${col} + 1
        WHERE window_type = ? AND window_start = ? AND api_key_id = ? AND model IS ?
      `).run('hour', hourWindow, key.id, null)
      db.prepare(`
        UPDATE stats_aggregates SET ${col} = ${col} + 1
        WHERE window_type = ? AND window_start = ? AND api_key_id = ? AND model IS ?
      `).run('day', dayWindow, key.id, null)
    }

    totalPrompt += req.promptTokens
    totalCompletion += req.completionTokens
    totalCost += cost
    inserted++

    if (inserted % 5000 === 0) {
      process.stdout.write(`\r  Inserted: ${inserted.toLocaleString()} / ${allRequests.length.toLocaleString()}`)
    }
  }

  process.stdout.write(`\r  Inserted: ${inserted.toLocaleString()} / ${allRequests.length.toLocaleString()}\n`)

  console.log('\n✅ Done')
  console.log(`  Total requests:  ${inserted.toLocaleString()}`)
  console.log(`  Prompt tokens:   ${totalPrompt.toLocaleString()}`)
  console.log(`  Completion:      ${totalCompletion.toLocaleString()}`)
  console.log(`  Total tokens:    ${(totalPrompt + totalCompletion).toLocaleString()}`)
  console.log(`  Est. cost:       $${totalCost.toFixed(2)}`)
  console.log(`  Error rate:      ${((allRequests.filter(r => r.status !== 'success').length / allRequests.length) * 100).toFixed(1)}%`)

  // Per-key breakdown
  console.log('\n  Per-key breakdown:')
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    const rows = db.prepare('SELECT SUM(prompt_tokens) as p, SUM(completion_tokens) as c, SUM(estimated_cost) as cost, COUNT(*) as cnt FROM request_logs WHERE api_key_id = ?').get(k.id) as any
    console.log(`    ${k.name}: ${rows.cnt.toLocaleString()} req, ${(rows.p + rows.c).toLocaleString()} tokens, $${(rows.cost ?? 0).toFixed(2)}`)
  }

  db.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
