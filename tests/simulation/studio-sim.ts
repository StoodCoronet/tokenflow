/**
 * Studio Simulation — 多项目/多用户高强度使用场景模拟
 *
 * 模拟一个小团队使用 Token Flow 的完整场景，用于：
 * - 验证 Dashboard 数据展示和趋势图
 * - 发现并发/性能/数据一致性 bug
 * - 快速生成丰富的测试数据
 *
 * Usage:
 *   npx tsx tests/simulation/studio-sim.ts [options]
 *
 * Options:
 *   --requests <n>     总请求数 (默认: 500)
 *   --keys <n>         Key 数量 (默认: 6)
 *   --providers <n>    Provider 数量 (默认: 4)
 *   --concurrency <n>  并发数 (默认: 5)
 *   --stream <ratio>   streaming 比例 0-1 (默认: 0.3)
 *   --days <n>         时间跨度天数 (默认: 1)
 *   --fast             快速模式：直接 INSERT 数据库，不走 HTTP
 *   --seed <n>         随机种子 (默认: 42)
 *   --keep             运行结束后保持 server 不退出
 *   --port <n>         Token Flow server 端口 (默认: 随机)
 *
 * Examples:
 *   # 默认：500 请求，最近 24 小时，6 个 key，4 个 provider
 *   npx tsx tests/simulation/studio-sim.ts
 *
 *   # 快速生成 7 天历史数据
 *   npx tsx tests/simulation/studio-sim.ts --days 7 --requests 2000 --fast
 *
 *   # 高并发压力测试
 *   npx tsx tests/simulation/studio-sim.ts --requests 5000 --concurrency 50
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'

import { createApp } from '../../packages/server/src/app.js'
import { resetDb, getDb, createApiKey } from '../../packages/server/src/db/schema.js'
import { loadConfig } from '../../packages/server/src/configLoader.js'
import { generateId } from '../../packages/shared/src/index.js'

// ── Types ──

interface SimConfig {
  totalRequests: number
  keyCount: number
  providerCount: number
  concurrency: number
  streamRatio: number
  days: number
  fast: boolean
  seed: number
  keep: boolean
  port: number
}

interface SimProvider {
  name: string
  template: string
  models: string[]
  scenario: string
  patternBias: 'full_context' | 'sliding_window' | 'summarization' | 'random'
}

interface SimKey {
  id: string
  name: string
  provider: string
  providerTemplate: string
  scenario: string
  patternBias: string
  sessions: SimSession[]
}

interface SimSession {
  id: string
  keyId: string
  messageCount: number
  messages: Array<{ role: string; content: string }>
  pattern: string
}

interface SimRequest {
  time: Date
  keyId: string
  sessionId: string
  model: string
  messages: Array<{ role: string; content: string }>
  stream: boolean
  promptTokens: number
  completionTokens: number
}

// ── CLI Parsing ──

function parseArgs(): SimConfig {
  const args = process.argv.slice(2)
  const get = (flag: string, fallback: string) => {
    const idx = args.indexOf(flag)
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback
  }
  const has = (flag: string) => args.includes(flag)

  return {
    totalRequests: parseInt(get('--requests', '500'), 10),
    keyCount: parseInt(get('--keys', '6'), 10),
    providerCount: parseInt(get('--providers', '4'), 10),
    concurrency: parseInt(get('--concurrency', '5'), 10),
    streamRatio: parseFloat(get('--stream', '0.3')),
    days: parseInt(get('--days', '1'), 10),
    fast: has('--fast'),
    seed: parseInt(get('--seed', '42'), 10),
    keep: has('--keep'),
    port: parseInt(get('--port', '0'), 10),
  }
}

// ── Seeded RNG ──

function makeRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

let rng: () => number

function randInt(min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min
}

function randPick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)]
}

function randBool(prob: number) {
  return rng() < prob
}

function randNormal(mean: number, std: number) {
  // Box-Muller
  const u1 = rng()
  const u2 = rng()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return Math.max(0, mean + z * std)
}

// ── Smart Mock Upstream ──

interface MockUpstream {
  url: string
  close: () => Promise<void>
}

function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token for English/Chinese mixed
  return Math.max(1, Math.ceil(text.length / 4))
}

function estimatePromptTokens(messages: Array<{ role: string; content: string }>): number {
  let total = 0
  for (const m of messages) {
    total += estimateTokens(m.content) + 3 // +3 for role/format overhead
  }
  return total
}

const RESPONSE_SNIPPETS = [
  'Here is the analysis you requested.',
  'The data shows a clear trend.',
  'Based on the context, I recommend...',
  'Let me break this down for you.',
  'The implementation involves several steps.',
  'Here is a summary of the findings.',
  'I have processed your request.',
  'The solution requires careful consideration.',
  'Here are the key points to consider.',
  'Let me provide a detailed explanation.',
]

function generateResponseContent(): string {
  const base = randPick(RESPONSE_SNIPPETS)
  const extra = randInt(0, 3)
  let result = base
  for (let i = 0; i < extra; i++) {
    result += ' ' + randPick(RESPONSE_SNIPPETS)
  }
  return result
}

function startSmartMockUpstream(): Promise<MockUpstream> {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = []
    for await (const chunk of req) {
      chunks.push(chunk)
    }
    const bodyText = Buffer.concat(chunks).toString('utf-8')
    const body = bodyText ? JSON.parse(bodyText) : {}

    const promptTokens = estimatePromptTokens(body.messages || [])
    const completionTokens = randInt(20, 400)

    const isStream = body.stream === true

    if (isStream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })
      const content = generateResponseContent()
      const words = content.split(' ')
      for (let i = 0; i < words.length; i++) {
        const chunk = {
          id: 'mock-' + i,
          object: 'chat.completion.chunk',
          model: body.model,
          choices: [{ index: 0, delta: { content: words[i] + ' ' } }],
        }
        res.write(`data: ${JSON.stringify(chunk)}\n\n`)
      }
      res.write(`data: ${JSON.stringify({ usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens } })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          id: 'mock-' + generateId(),
          object: 'chat.completion',
          model: body.model,
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: generateResponseContent() },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens },
        })
      )
    }
  })

  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') {
        resolve({
          url: `http://127.0.0.1:${addr.port}`,
          close: () => new Promise<void>((r) => server.close(() => r())),
        })
      } else {
        reject(new Error('Failed to get server address'))
      }
    })
  })
}

// ── Simulation Data Generation ──

const PROVIDER_TEMPLATES: SimProvider[] = [
  {
    name: 'openai-prod',
    template: 'openai',
    models: ['gpt-4o', 'gpt-4o-mini'],
    scenario: 'AI Customer Service',
    patternBias: 'sliding_window',
  },
  {
    name: 'anthropic-internal',
    template: 'anthropic',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
    scenario: 'Internal Tools',
    patternBias: 'full_context',
  },
  {
    name: 'deepseek-dev',
    template: 'deepseek',
    models: ['deepseek-chat', 'deepseek-coder'],
    scenario: 'Code Assistant',
    patternBias: 'summarization',
  },
  {
    name: 'gemini-data',
    template: 'gemini',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
    scenario: 'Data Analysis',
    patternBias: 'random',
  },
]

const USER_QUERIES = [
  'Explain this code',
  'Summarize the document',
  'Translate to Chinese',
  'Write a test case',
  'Refactor this function',
  'Generate a report',
  'What are the key findings',
  'Help me debug this error',
  'Create a summary',
  'Analyze the trend',
  'Compare these options',
  'Suggest improvements',
  'What is the best approach',
  'Generate sample data',
  'Review this PR',
]

const SYSTEM_PROMPTS = [
  'You are a helpful assistant.',
  'You are a code reviewer. Be concise.',
  'You are a data analyst. Use markdown tables.',
  'You are a translator. Preserve formatting.',
]

const SUMMARY_SYSTEM_PROMPTS = [
  'Summary of previous conversation: The user is working on a multi-service architecture project. Key topics discussed: API design, authentication flows, database schema optimization. Current focus: implementing rate limiting.',
  'Context summary: Previous 20 messages covered React component patterns, state management with Zustand, and testing strategies with Vitest. User prefers functional components.',
  'Previous conversation summary: Discussion about LLM prompt engineering techniques. Covered: chain-of-thought, few-shot prompting, and structured output formats.',
]

function buildMessages(pattern: string, turn: number): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = []

  if (pattern === 'summarization') {
    messages.push({ role: 'system', content: randPick(SUMMARY_SYSTEM_PROMPTS) })
  } else if (randBool(0.7)) {
    messages.push({ role: 'system', content: randPick(SYSTEM_PROMPTS) })
  }

  const maxTurns =
    pattern === 'full_context'
      ? Math.min(turn + 3, 35)
      : pattern === 'sliding_window'
        ? Math.min(turn + 3, 12)
        : pattern === 'summarization'
          ? Math.min(turn + 2, 8)
          : Math.min(turn + 2, 6)

  for (let i = 0; i < maxTurns; i++) {
    messages.push({ role: 'user', content: randPick(USER_QUERIES) })
    if (i < maxTurns - 1 || randBool(0.5)) {
      messages.push({ role: 'assistant', content: generateResponseContent() })
    }
  }

  return messages
}

function distributeRequests(count: number, days: number): Date[] {
  const now = Date.now()
  const spanMs = days * 24 * 60 * 60 * 1000
  const times: Date[] = []

  // Realistic distribution: more requests during work hours (9-18) and weekdays
  for (let i = 0; i < count; i++) {
    const offset = rng() * spanMs
    const candidate = new Date(now - offset)
    const hour = candidate.getHours()
    const dayOfWeek = candidate.getDay() // 0=Sun, 6=Sat

    // Weight: work hours (9-18) = 3x, evening (18-23) = 1.5x, night = 0.5x
    let hourWeight = 1
    if (hour >= 9 && hour <= 18) hourWeight = 3
    else if (hour >= 19 && hour <= 23) hourWeight = 1.5
    else hourWeight = 0.3

    // Weight: weekday = 2x, weekend = 0.5x
    let dayWeight = dayOfWeek === 0 || dayOfWeek === 6 ? 0.4 : 2

    const weight = hourWeight * dayWeight
    if (rng() < weight / 6) {
      times.push(candidate)
    } else {
      // Retry with bias toward work hours
      const biasedHour = randInt(9, 18)
      candidate.setHours(biasedHour, randInt(0, 59), randInt(0, 59))
      times.push(candidate)
    }
  }

  return times.sort((a, b) => a.getTime() - b.getTime())
}

function generateSimulation(cfg: SimConfig): { providers: SimProvider[]; keys: SimKey[]; requests: SimRequest[] } {
  const providers = PROVIDER_TEMPLATES.slice(0, cfg.providerCount)

  // Create keys
  const keys: SimKey[] = []
  const keysPerProvider = Math.ceil(cfg.keyCount / cfg.providerCount)
  let keyIdx = 0
  for (let pi = 0; pi < providers.length && keys.length < cfg.keyCount; pi++) {
    const prov = providers[pi]
    for (let ki = 0; ki < keysPerProvider && keys.length < cfg.keyCount; ki++) {
      keys.push({
        id: `sim-key-${keyIdx++}`, // temporary id for mapping
        name: `${prov.scenario} Key ${ki + 1}`,
        provider: prov.name,
        providerTemplate: prov.template,
        scenario: prov.scenario,
        patternBias: prov.patternBias,
        sessions: [],
      })
    }
  }

  // Create sessions (2-4 per key)
  for (const key of keys) {
    const sessionCount = randInt(2, 4)
    for (let si = 0; si < sessionCount; si++) {
      key.sessions.push({
        id: `sess-${generateId().slice(0, 8)}`,
        keyId: key.id,
        messageCount: 0,
        messages: [],
        pattern: key.patternBias === 'random' ? randPick(['full_context', 'sliding_window', 'summarization']) : key.patternBias,
      })
    }
  }

  // Distribute requests over time
  const times = distributeRequests(cfg.totalRequests, cfg.days)

  // Assign requests to keys/sessions
  const requests: SimRequest[] = []
  for (let i = 0; i < cfg.totalRequests; i++) {
    const key = randPick(keys)
    const session = randPick(key.sessions)
    const turn = session.messageCount
    session.messageCount++

    const messages = buildMessages(session.pattern, turn)
    const promptTokens = estimatePromptTokens(messages)
    const completionTokens = randInt(20, 400)

    requests.push({
      time: times[i],
      keyId: key.id,
      sessionId: session.id,
      model: randPick(providers.find((p) => p.name === key.provider)!.models),
      messages,
      stream: randBool(cfg.streamRatio),
      promptTokens,
      completionTokens,
    })
  }

  return { providers, keys, requests }
}

// ── HTTP Execution ──

async function executeHttpRequests(
  requests: SimRequest[],
  tfPort: number,
  keyMap: Map<string, string>,
  concurrency: number
): Promise<void> {
  let index = 0

  async function worker() {
    while (index < requests.length) {
      const req = requests[index++]
      const apiKey = keyMap.get(req.keyId)!

      try {
        await fetch(`http://127.0.0.1:${tfPort}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
          },
          body: JSON.stringify({
            model: req.model,
            messages: req.messages,
            stream: req.stream,
            session_id: req.sessionId,
          }),
        })
      } catch (err) {
        // Ignore errors for simulation robustness
      }

      if (index % 50 === 0) {
        process.stdout.write(`\r  Progress: ${index}/${requests.length}`)
      }
    }
  }

  const workers: Promise<void>[] = []
  for (let i = 0; i < concurrency; i++) {
    workers.push(worker())
  }
  await Promise.all(workers)
  process.stdout.write(`\r  Progress: ${requests.length}/${requests.length}\n`)
}

// ── Fast Mode: Direct DB Insert ──

function executeFastInsert(
  requests: SimRequest[],
  keyMap: Map<string, string>,
  db: Database.Database
): void {
  const insertLog = db.prepare(`
    INSERT INTO request_logs (id, api_key_id, session_id, model, prompt_tokens, completion_tokens,
      total_tokens, status, detected_pattern, efficiency_score, request_data, response_data, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const upsertSess = db.prepare(`
    INSERT INTO sessions (session_id, api_key_id, start_time, last_activity, message_count,
      total_prompt_tokens, total_completion_tokens, current_pattern)
    VALUES (?, ?, ?, ?, 1, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      last_activity = excluded.last_activity,
      message_count = message_count + 1,
      total_prompt_tokens = total_prompt_tokens + excluded.total_prompt_tokens,
      total_completion_tokens = total_completion_tokens + excluded.total_completion_tokens,
      current_pattern = COALESCE(excluded.current_pattern, current_pattern)
  `)

  db.transaction(() => {
    for (let i = 0; i < requests.length; i++) {
      const req = requests[i]
      const apiKey = keyMap.get(req.keyId)!
      const totalTokens = req.promptTokens + req.completionTokens
      const timeIso = req.time.toISOString()

      // Simple pattern assignment for fast mode
      const pattern =
        req.messages.length > 25
          ? 'full_context'
          : req.messages.length > 4 && req.messages[0]?.role === 'system' && req.messages[0].content.length > 300
            ? 'summarization'
            : req.messages.length >= 4 && req.messages.length <= 16
              ? 'sliding_window'
              : null

      // Efficiency score heuristic
      let score = 100
      if (req.messages.length > 20) score -= 25
      else if (req.messages.length > 10) score -= 10
      if (req.promptTokens > 50000) score -= 20
      else if (req.promptTokens > 20000) score -= 10
      score = Math.max(0, Math.min(100, score))

      insertLog.run(
        generateId(),
        apiKey,
        req.sessionId,
        req.model,
        req.promptTokens,
        req.completionTokens,
        totalTokens,
        'success',
        pattern,
        score,
        JSON.stringify({ model: req.model, messages: req.messages }),
        '{}',
        timeIso
      )

      upsertSess.run(
        req.sessionId,
        apiKey,
        timeIso,
        timeIso,
        req.promptTokens,
        req.completionTokens,
        pattern
      )

      if (i % 100 === 0) {
        process.stdout.write(`\r  Progress: ${i}/${requests.length}`)
      }
    }
  })()

  process.stdout.write(`\r  Progress: ${requests.length}/${requests.length}\n`)
}

// ── Stats Rebuild ──

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

function rebuildStatsAggregates(db: Database.Database) {
  db.exec('DELETE FROM stats_aggregates')

  const logs = db
    .prepare(
      'SELECT api_key_id, model, prompt_tokens, completion_tokens, total_tokens, efficiency_score, detected_pattern, created_at FROM request_logs'
    )
    .all() as any[]

  const insert = db.prepare(`
    INSERT OR IGNORE INTO stats_aggregates
    (window_type, window_start, api_key_id, model, request_count, prompt_tokens, completion_tokens, total_tokens, avg_efficiency,
     pattern_full_context, pattern_sliding_window, pattern_summarization)
    VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 0, 0)
  `)

  const update = db.prepare(`
    UPDATE stats_aggregates SET
      request_count = request_count + 1,
      prompt_tokens = prompt_tokens + ?,
      completion_tokens = completion_tokens + ?,
      total_tokens = total_tokens + ?,
      avg_efficiency = (avg_efficiency * request_count + ?) / (request_count + 1)
    WHERE window_type = ? AND window_start = ? AND api_key_id = ? AND model IS ?
  `)

  const updatePattern = db.prepare(`
    UPDATE stats_aggregates SET
      pattern_full_context = pattern_full_context + ?,
      pattern_sliding_window = pattern_sliding_window + ?,
      pattern_summarization = pattern_summarization + ?
    WHERE window_type = ? AND window_start = ? AND api_key_id = ? AND model IS ?
  `)

  db.transaction(() => {
    for (const log of logs) {
      const time = new Date(log.created_at)
      const hourWindow = floorToHour(time)
      const dayWindow = floorToDay(time)

      for (const { window_type, window_start } of [
        { window_type: 'hour', window_start: hourWindow },
        { window_type: 'day', window_start: dayWindow },
      ]) {
        // per-key + model
        insert.run(window_type, window_start, log.api_key_id, log.model)
        update.run(
          log.prompt_tokens,
          log.completion_tokens,
          log.total_tokens,
          log.efficiency_score,
          window_type,
          window_start,
          log.api_key_id,
          log.model
        )
        const pfc = log.detected_pattern === 'full_context' ? 1 : 0
        const psw = log.detected_pattern === 'sliding_window' ? 1 : 0
        const ps = log.detected_pattern === 'summarization' ? 1 : 0
        updatePattern.run(pfc, psw, ps, window_type, window_start, log.api_key_id, log.model)

        // per-key (model = null)
        insert.run(window_type, window_start, log.api_key_id, null)
        update.run(
          log.prompt_tokens,
          log.completion_tokens,
          log.total_tokens,
          log.efficiency_score,
          window_type,
          window_start,
          log.api_key_id,
          null
        )
        updatePattern.run(pfc, psw, ps, window_type, window_start, log.api_key_id, null)
      }
    }
  })()
}

// ── Summary ──

function printSummary(db: Database.Database, cfg: SimConfig, durationMs: number) {
  const totalRequests = (db.prepare('SELECT COUNT(*) as c FROM request_logs').get() as any).c
  const totalSessions = (db.prepare('SELECT COUNT(*) as c FROM sessions').get() as any).c
  const totalKeys = (db.prepare('SELECT COUNT(*) as c FROM api_keys').get() as any).c
  const totalTokens = (db.prepare('SELECT SUM(total_tokens) as s FROM request_logs').get() as any).s || 0

  const patternStats = db
    .prepare(
      `SELECT detected_pattern as pattern, COUNT(*) as count FROM request_logs GROUP BY detected_pattern`
    )
    .all() as any[]

  const keyStats = db
    .prepare(
      `SELECT k.name, COUNT(*) as req_count, SUM(r.total_tokens) as tokens
       FROM request_logs r JOIN api_keys k ON r.api_key_id = k.id
       GROUP BY k.id ORDER BY req_count DESC`
    )
    .all() as any[]

  const hourWindows = (db.prepare('SELECT COUNT(DISTINCT window_start) as c FROM stats_aggregates WHERE window_type = ?').get('hour') as any).c
  const dayWindows = (db.prepare('SELECT COUNT(DISTINCT window_start) as c FROM stats_aggregates WHERE window_type = ?').get('day') as any).c

  console.log('\n📊 Simulation Summary')
  console.log('====================')
  console.log(`  Duration:        ${(durationMs / 1000).toFixed(1)}s`)
  console.log(`  Mode:            ${cfg.fast ? 'Fast (direct DB)' : 'HTTP (full proxy)'}`)
  console.log(`  Requests:        ${totalRequests}`)
  console.log(`  Sessions:        ${totalSessions}`)
  console.log(`  Keys:            ${totalKeys}`)
  console.log(`  Total Tokens:    ${totalTokens.toLocaleString()}`)
  console.log(`  Time Span:       ${cfg.days} day(s)`)
  console.log(`  Hour Windows:    ${hourWindows}`)
  console.log(`  Day Windows:     ${dayWindows}`)

  console.log('\n  Patterns:')
  for (const row of patternStats) {
    const name = row.pattern ?? 'none'
    const pct = ((row.count / totalRequests) * 100).toFixed(1)
    console.log(`    ${name.padEnd(20)} ${String(row.count).padStart(4)} (${pct}%)`)
  }

  console.log('\n  Top Keys:')
  for (const row of keyStats.slice(0, 5)) {
    console.log(`    ${row.name.padEnd(25)} ${String(row.req_count).padStart(4)} req  ${String(row.tokens).padStart(6)} tokens`)
  }

  console.log('\n✅ Data ready. Open the dashboard to view results.')
}

// ── Main ──

async function main() {
  const cfg = parseArgs()
  rng = makeRng(cfg.seed)

  console.log('🚀 Token Flow Studio Simulation')
  console.log('================================')
  console.log(`  Requests:     ${cfg.totalRequests}`)
  console.log(`  Keys:         ${cfg.keyCount}`)
  console.log(`  Providers:    ${cfg.providerCount}`)
  console.log(`  Concurrency:  ${cfg.concurrency}`)
  console.log(`  Stream ratio: ${cfg.streamRatio}`)
  console.log(`  Days:         ${cfg.days}`)
  console.log(`  Mode:         ${cfg.fast ? 'Fast (DB direct)' : 'HTTP (proxy)'}`)
  console.log(`  Seed:         ${cfg.seed}`)
  console.log('')

  // 1. Start mock upstream
  console.log('1. Starting mock upstream...')
  const mock = await startSmartMockUpstream()
  console.log(`   Mock upstream: ${mock.url}`)

  // 2. Setup temp config
  console.log('2. Setting up temporary config...')
  const tempDir = join(tmpdir(), `tf-sim-${Date.now()}`)
  mkdirSync(tempDir, { recursive: true })

  const configPath = join(tempDir, 'config.json5')
  const providers = PROVIDER_TEMPLATES.slice(0, cfg.providerCount).map((p) => ({
    name: p.name,
    template: p.template,
    api_base_url: mock.url,
    api_key: 'sim-key',
    models: p.models,
  }))

  const appConfig = {
    PORT: cfg.port,
    UI_PORT: 0,
    APIKEY: '',
    DATABASE: ':memory:',
    Providers: providers,
    Detectors: {
      fullContext: { enabled: true },
      slidingWindow: { enabled: true },
      summarization: { enabled: true },
    },
    LOG_LEVEL: 'silent' as const,
    PROXY_URL: '',
  }
  writeFileSync(configPath, JSON.stringify(appConfig, null, 2))

  process.env.TOKENFLOW_CONFIG_PATH = configPath
  process.env.TOKENFLOW_DB_PATH = ':memory:'

  // 3. Start Token Flow server
  console.log('3. Starting Token Flow server...')
  resetDb()
  const loadedConfig = loadConfig()
  const tfApp = await createApp(loadedConfig)
  const db = getDb(':memory:')
  const addr = await tfApp.listen({ port: cfg.port || 0, host: '127.0.0.1' })
  const tfPort = parseInt(addr.split(':').pop()!, 10)
  console.log(`   Token Flow:    http://127.0.0.1:${tfPort}`)
  console.log(`   Dashboard:     http://localhost:40002 (start with pnpm dev:ui)`)

  // 4. Generate simulation data
  console.log('4. Generating simulation data...')
  const { keys, requests } = generateSimulation(cfg)

  // 5. Create keys in DB
  console.log('5. Creating API keys...')
  const keyMap = new Map<string, string>() // simKeyId -> dbKeyId
  for (const key of keys) {
    const dbKey = createApiKey({ name: key.name, provider: key.provider, scenario: key.scenario })
    keyMap.set(key.id, dbKey.id)
  }
  console.log(`   Created ${keys.length} keys`)

  // 6. Execute requests
  console.log(`6. Executing ${requests.length} requests...`)
  const startTime = Date.now()

  if (cfg.fast) {
    executeFastInsert(requests, keyMap, db)
  } else {
    await executeHttpRequests(requests, tfPort, keyMap, cfg.concurrency)
    // After HTTP execution, fix timestamps and re-insert with correct data
    // so that Dashboard time distribution matches the simulation.
    // The proxy pipeline was already exercised during the HTTP calls.
    console.log('   Fixing timestamps after HTTP execution...')
    db.exec('DELETE FROM request_logs')
    db.exec('DELETE FROM sessions')
    db.exec('DELETE FROM stats_aggregates')
    executeFastInsert(requests, keyMap, db)
  }

  // 7. Rebuild stats aggregates
  console.log('7. Rebuilding stats aggregates...')
  rebuildStatsAggregates(db)

  const duration = Date.now() - startTime

  // 9. Print summary
  printSummary(db, cfg, duration)

  // 10. Cleanup or keep
  if (cfg.keep) {
    console.log('\n⏸️  Server is running. Press Ctrl+C to stop.')
    console.log(`   TF API:  http://127.0.0.1:${tfPort}`)
    // Keep process alive
    await new Promise(() => {})
  } else {
    console.log('\n🧹 Cleaning up...')
    await tfApp.close()
    await mock.close()
    rmSync(tempDir, { recursive: true, force: true })
    delete process.env.TOKENFLOW_CONFIG_PATH
    delete process.env.TOKENFLOW_DB_PATH
    console.log('   Done.')
  }
}

main().catch((err) => {
  console.error('❌ Simulation failed:', err)
  process.exit(1)
})
