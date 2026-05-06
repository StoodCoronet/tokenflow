/**
 * Real provider end-to-end validation.
 *
 * This script validates that Token Flow's transformer pipeline works correctly
 * against real API providers:
 * - OpenRouter (OpenAI style, needs proxy)
 * - Kimi (Anthropic style via OpenAI-compatible endpoint, no proxy)
 *
 * Run: npx tsx tests/e2e/real-provider.ts
 */

import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { OpenAIMainTransformer, OpenAIProviderTransformer, AnthropicMainTransformer } from '../../packages/server/src/transformers/index.js'
import type { TransformContext, ProviderConfig } from '../../packages/server/src/transformers/base.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// Load .env from project root if present
function loadEnv(path: string) {
  try {
    const content = readFileSync(path, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      if (!(key in process.env)) process.env[key] = value
    }
  } catch {
    // ignore if .env doesn't exist
  }
}
loadEnv(join(process.cwd(), '.env'))

const OPENROUTER_KEY = process.env.OPENROUTER_KEY || ''
const KIMI_KEY = process.env.KIMI_KEY || ''

interface CurlResult {
  status: number
  body: string
  json(): unknown
}

function curlFetch(url: string, opts?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<CurlResult> {
  return new Promise((resolve, reject) => {
    const args = ['-s', '-L', '-w', '\\n%{http_code}']
    if (opts?.method) args.push('-X', opts.method)
    for (const [k, v] of Object.entries(opts?.headers ?? {})) args.push('-H', `${k}: ${v}`)
    if (opts?.body) args.push('-d', opts.body)
    args.push(url)

    const child = spawn('curl', args, {
      env: {
        ...process.env,
        https_proxy: process.env.HTTPS_PROXY || '',
        http_proxy: process.env.HTTP_PROXY || '',
        all_proxy: process.env.ALL_PROXY || '',
      },
    })

    let stdout = ''
    child.stdout.on('data', (d) => { stdout += d })
    child.stderr.on('data', (d) => { console.error('curl stderr:', d.toString()) })
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`curl exited ${code}`))
      const lines = stdout.trim().split('\n')
      const status = parseInt(lines.pop()!, 10)
      const body = lines.join('\n')
      resolve({ status, body, json: () => JSON.parse(body) })
    })
  })
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// ── Helpers ──

function makeProvider(baseUrl: string, apiKey: string, models: string[]): ProviderConfig {
  return { api_base_url: baseUrl, api_key: apiKey, models }
}

function makeCtx(provider: ProviderConfig, isStream = false): TransformContext {
  return { provider, isStream }
}

function check(condition: boolean, message: string) {
  if (!condition) throw new Error(`ASSERT FAIL: ${message}`)
  console.log(`  ✅ ${message}`)
}

// ── OpenRouter (OpenAI style) ──

async function validateOpenRouter() {
  console.log('\n🔄 OpenRouter — OpenAI style')

  const openAiMain = new OpenAIMainTransformer()
  const openAiProvider = new OpenAIProviderTransformer()

  const clientRequest = {
    model: 'openai/gpt-4o-mini',
    messages: [{ role: 'user' as const, content: 'Say hello in one word' }],
    max_tokens: 10,
    temperature: 0.7,
  }

  // Step 1: RequestOut (client → IR)
  const irRequest = await openAiMain.transformRequestOut(clientRequest, makeCtx(makeProvider('', '', [])))
  check(irRequest.model === 'openai/gpt-4o-mini', 'IR request preserves model')
  check(irRequest.messages.length === 1, 'IR request has 1 message')

  // Step 2: RequestIn (IR → provider)
  const provider = makeProvider('https://openrouter.ai/api/v1', OPENROUTER_KEY, ['openai/gpt-4o-mini'])
  const providerReq = await openAiProvider.transformRequestIn(irRequest, makeCtx(provider))
  check(providerReq.url === 'https://openrouter.ai/api/v1/chat/completions', 'Provider URL correct')
  check(providerReq.headers['Authorization'] === `Bearer ${OPENROUTER_KEY}`, 'Provider auth header correct')

  // Step 3: Send to real provider
  console.log('  📡 Sending request to OpenRouter (via proxy)...')
  const res = await curlFetch(providerReq.url, {
    method: 'POST',
    headers: providerReq.headers as Record<string, string>,
    body: JSON.stringify(providerReq.body),
  })
  check(res.status === 200, `OpenRouter responded HTTP ${res.status}`)

  const rawBody = res.json() as any
  check(rawBody.choices?.[0]?.message?.content != null, 'OpenRouter response has content')
  console.log(`     Content: "${rawBody.choices[0].message.content}"`)

  // Step 4: ResponseOut (provider → IR)
  const providerResponse = new Response(res.body, { status: res.status, headers: { 'Content-Type': 'application/json' } })
  const irResponse = await openAiProvider.transformResponseOut(providerResponse, makeCtx(provider))
  check(irResponse.status === 200, 'IR response status 200')

  // Step 5: ResponseIn (IR → client)
  const clientResponse = await openAiMain.transformResponseIn(irResponse, makeCtx(provider))
  check(clientResponse.status === 200, 'Client response status 200')
  const clientJson = await clientResponse.json()
  check((clientJson as any).choices?.[0]?.message?.content === rawBody.choices[0].message.content, 'Client response content matches')

  console.log('  ✅ OpenRouter validation passed')
}

// ── Kimi (Anthropic style client → OpenAI provider) ──

async function validateKimi() {
  console.log('\n🔄 Kimi — Anthropic style client via OpenAI-compatible endpoint')

  const anthropicMain = new AnthropicMainTransformer()
  const openAiProvider = new OpenAIProviderTransformer()

  const clientRequest = {
    model: 'kimi-k2.5',
    max_tokens: 30,
    messages: [{ role: 'user' as const, content: 'Say hello in one word' }],
  }

  // Step 1: RequestOut (Anthropic client → IR)
  const irRequest = await anthropicMain.transformRequestOut(clientRequest, makeCtx(makeProvider('', '', [])))
  check(irRequest.model === 'kimi-k2.5', 'IR request preserves model')
  check(irRequest.messages.length === 1, 'IR request has 1 message')
  check(irRequest.messages[0].role === 'user', 'IR message role is user')

  // Step 2: RequestIn (IR → provider OpenAI format)
  const provider = makeProvider('https://api.moonshot.cn/v1', KIMI_KEY, ['kimi-k2.5'])
  const providerReq = await openAiProvider.transformRequestIn(irRequest, makeCtx(provider))
  check(providerReq.url === 'https://api.moonshot.cn/v1/chat/completions', 'Provider URL correct')
  check(providerReq.headers['Authorization'] === `Bearer ${KIMI_KEY}`, 'Provider auth header correct')

  // Step 3: Send to real provider (no proxy needed)
  console.log('  📡 Sending request to Kimi (direct)...')
  const res = await fetch(providerReq.url, {
    method: 'POST',
    headers: providerReq.headers as Record<string, string>,
    body: JSON.stringify(providerReq.body),
  })
  check(res.status === 200, `Kimi responded HTTP ${res.status}`)

  const rawBody = await res.json() as any
  check(rawBody.choices?.[0]?.message?.content != null, 'Kimi response has content')
  console.log(`     Content: "${rawBody.choices[0].message.content}"`)

  // Step 4: ResponseOut (provider OpenAI → IR)
  const providerResponse = new Response(JSON.stringify(rawBody), { status: 200, headers: { 'Content-Type': 'application/json' } })
  const irResponse = await openAiProvider.transformResponseOut(providerResponse, makeCtx(provider))
  check(irResponse.status === 200, 'IR response status 200')

  // Step 5: ResponseIn (IR → Anthropic client)
  const clientResponse = await anthropicMain.transformResponseIn(irResponse, makeCtx(provider))
  check(clientResponse.status === 200, 'Client response status 200')
  const clientJson = await clientResponse.json() as any
  check(clientJson.type === 'message', 'Anthropic response type is message')
  check(clientJson.role === 'assistant', 'Anthropic response role is assistant')
  const hasText = clientJson.content?.some((c: any) => c.type === 'text')
  check(hasText || (rawBody as any).choices?.[0]?.message?.reasoning_content, 'Anthropic response has content or reasoning')
  const textBlock = clientJson.content?.find((c: any) => c.type === 'text')
  console.log(`     Anthropic content: "${textBlock?.text ?? '(empty - reasoning only)'}"`)

  console.log('  ✅ Kimi validation passed')
}

// ── Main ──

async function main() {
  console.log('🚀 Real Provider E2E Validation')
  console.log('================================')

  try {
    await validateOpenRouter()
  } catch (err: any) {
    console.error('  ❌ OpenRouter validation failed:', err.message)
  }

  try {
    await validateKimi()
  } catch (err: any) {
    console.error('  ❌ Kimi validation failed:', err.message)
  }

  console.log('\n✅ Validation complete')
}

main().catch(console.error)
