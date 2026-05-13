/**
 * Mock Pricing Server — standalone dev helper with crawler
 *
 * Run: npx tsx tests/mock/pricing-server.ts
 *
 * Exposes:
 *   GET /pricing.json     → Token Flow native format (memory, auto-refreshed)
 *   GET /openrouter.json  → OpenRouter-compatible format
 *   POST /refresh         → Trigger crawl now
 */

import { createServer } from 'http'

const PORT = process.env.PRICING_MOCK_PORT ? parseInt(process.env.PRICING_MOCK_PORT, 10) : 40010

// ── Default fallback prices (used when crawl fails) ──
const DEFAULT_PRICES: Record<string, { prompt: number; completion: number }> = {
  'gpt-4o': { prompt: 5, completion: 15 },
  'gpt-4o-mini': { prompt: 0.15, completion: 0.6 },
  'claude-3-5-sonnet': { prompt: 3, completion: 15 },
  'claude-3-5-sonnet-20241022': { prompt: 3, completion: 15 },
  'claude-3-opus-20240229': { prompt: 15, completion: 75 },
  'deepseek-chat': { prompt: 0.14, completion: 0.28 },
  'deepseek-coder': { prompt: 0.14, completion: 0.28 },
  'gemini-1.5-pro': { prompt: 1.25, completion: 5 },
  'gemini-1.5-flash': { prompt: 0.075, completion: 0.3 },
}

// Mutable in-memory price store
let currentPrices = { ...DEFAULT_PRICES }
let lastUpdated = new Date().toISOString()
let lastCrawlLog: string[] = []

// ── Crawler: DeepSeek (direct HTML, no anti-bot) ──
async function crawlDeepSeek(): Promise<Partial<typeof DEFAULT_PRICES>> {
  const res = await fetch('https://api-docs.deepseek.com/quick_start/pricing', {
    headers: { 'User-Agent': 'Mozilla/5.0 (TokenFlow-Pricing-Crawler/1.0)' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()

  const prices: Partial<typeof DEFAULT_PRICES> = {}

  // DeepSeek docs HTML pattern (verified 2026-05-10):
  // CACHE MISS)</td><td>$0.14</td><td>$0.435
  // 1M OUTPUT TOKENS</td><td>$0.28</td><td>$0.87
  // First price = flash (col 2), second = pro (col 3)

  const missRow = html.match(/CACHE MISS\)[\s\S]*?\$([0-9.]+)[\s\S]*?\$([0-9.]+)/i)
  const outRow = html.match(/1M OUTPUT TOKENS[\s\S]*?\$([0-9.]+)[\s\S]*?\$([0-9.]+)/i)

  if (missRow && outRow) {
    const flashIn = parseFloat(missRow[1])
    const flashOut = parseFloat(outRow[1])
    if (!Number.isNaN(flashIn) && !Number.isNaN(flashOut)) {
      prices['deepseek-chat'] = { prompt: flashIn, completion: flashOut }
      prices['deepseek-coder'] = { prompt: flashIn, completion: flashOut }
    }

    const proIn = parseFloat(missRow[2])
    const proOut = parseFloat(outRow[2])
    if (!Number.isNaN(proIn) && !Number.isNaN(proOut)) {
      prices['deepseek-v4-pro'] = { prompt: proIn, completion: proOut }
    }
  }

  return prices
}

function extractPrice(html: string, regex: RegExp): number | null {
  const m = html.match(regex)
  if (!m) return null
  const n = parseFloat(m[1])
  return Number.isNaN(n) ? null : n
}

function extractSecondPrice(html: string, regex: RegExp): number | null {
  const m = html.match(regex)
  if (!m || m[2] == null) return null
  const n = parseFloat(m[2])
  return Number.isNaN(n) ? null : n
}

// ── Crawler: OpenRouter (unified API, no anti-bot) ──
async function crawlOpenRouter(): Promise<Partial<typeof DEFAULT_PRICES>> {
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json() as { data?: Array<{ id: string; pricing?: { prompt: string; completion: string } }> }

  const prices: Partial<typeof DEFAULT_PRICES> = {}
  if (!data.data) return prices

  const wanted = new Set(Object.keys(DEFAULT_PRICES))
  for (const item of data.data) {
    if (!wanted.has(item.id) || !item.pricing) continue
    const prompt = parseFloat(item.pricing.prompt) * 1_000_000
    const completion = parseFloat(item.pricing.completion) * 1_000_000
    if (!Number.isNaN(prompt) && !Number.isNaN(completion)) {
      prices[item.id] = { prompt: Math.round(prompt * 1e6) / 1e6, completion: Math.round(completion * 1e6) / 1e6 }
    }
  }
  return prices
}

// ── Master crawl ──
async function runCrawl(): Promise<void> {
  const log: string[] = []
  const merged: Record<string, { prompt: number; completion: number }> = {}

  // Try each provider parser
  const parsers = [
    { name: 'deepseek', fn: crawlDeepSeek },
    { name: 'openrouter', fn: crawlOpenRouter },
  ]

  for (const { name, fn } of parsers) {
    try {
      const result = await fn()
      const count = Object.keys(result).length
      if (count > 0) {
        Object.assign(merged, result)
        log.push(`${name}: OK (${count} models)`)
      } else {
        log.push(`${name}: no data`)
      }
    } catch (err: any) {
      log.push(`${name}: ${err.message}`)
    }
  }

  // Merge: crawl results override defaults, but keep defaults for missing models
  currentPrices = { ...DEFAULT_PRICES, ...merged }
  lastUpdated = new Date().toISOString()
  lastCrawlLog = log

  console.log(`[${lastUpdated}] Crawl finished`)
  for (const line of log) console.log(`  ${line}`)
}

// ── HTTP Server ──
const server = createServer((req, res) => {
  const url = req.url ?? '/'

  if (url === '/pricing.json') {
    const payload = {
      updatedAt: lastUpdated,
      source: 'tokenflow-pricing-server',
      crawlLog: lastCrawlLog,
      prices: currentPrices,
    }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify(payload, null, 2))
    return
  }

  if (url === '/openrouter.json') {
    const payload = {
      data: Object.entries(currentPrices).map(([id, p]) => ({
        id,
        pricing: {
          prompt: String(p.prompt / 1_000_000),
          completion: String(p.completion / 1_000_000),
        },
      })),
    }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify(payload, null, 2))
    return
  }

  if (url === '/refresh' && req.method === 'POST') {
    runCrawl().then(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, updatedAt: lastUpdated, log: lastCrawlLog }, null, 2))
    }).catch((err) => {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: err.message }))
    })
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found', routes: ['/pricing.json', '/openrouter.json', 'POST /refresh'] }))
})

server.listen(PORT, () => {
  console.log(`Pricing server running at http://localhost:${PORT}`)
  console.log(`  GET  /pricing.json    → native format`)
  console.log(`  GET  /openrouter.json → OpenRouter format`)
  console.log(`  POST /refresh         → trigger crawl now`)
  console.log('')
  console.log('Auto-crawling on startup...')
  runCrawl().catch(() => {})
})
