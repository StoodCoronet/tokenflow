import { describe, it, expect } from 'vitest'
import { resolvePricing, computeCost } from '../../packages/server/src/proxy/pricing.js'
import { getDefaultConfig } from '../../packages/server/src/configLoader.js'

const PRICING = getDefaultConfig().Pricing!

describe('resolvePricing', () => {
  it('matches exact model name', () => {
    const p = resolvePricing('gpt-4o', PRICING)
    expect(p).toBeDefined()
    expect(p!.prompt).toBe(2.5)
    expect(p!.completion).toBe(10)
  })

  it('returns undefined for unknown model', () => {
    expect(resolvePricing('unknown-model-xyz', PRICING)).toBeUndefined()
  })

  it('strips provider prefix (openai/gpt-4o)', () => {
    const p = resolvePricing('openai/gpt-4o', PRICING)
    expect(p).toBeDefined()
    expect(p!.prompt).toBe(2.5)
    expect(p!.completion).toBe(10)
  })

  it('strips provider prefix (anthropic/claude-3-5-sonnet)', () => {
    const p = resolvePricing('anthropic/claude-3-5-sonnet', PRICING)
    expect(p).toBeDefined()
    expect(p!.prompt).toBe(3)
    expect(p!.completion).toBe(15)
  })

  it('strips provider prefix (google/gemini-1.5-pro)', () => {
    const p = resolvePricing('google/gemini-1.5-pro', PRICING)
    expect(p).toBeDefined()
    expect(p!.prompt).toBe(1.25)
    expect(p!.completion).toBe(5)
  })

  it('strips provider prefix (deepseek/deepseek-chat)', () => {
    const p = resolvePricing('deepseek/deepseek-chat', PRICING)
    expect(p).toBeDefined()
    expect(p!.prompt).toBe(0.14)
    expect(p!.completion).toBe(0.28)
  })

  it('prefers exact match over prefix strip', () => {
    const exact = resolvePricing('gpt-4o', PRICING)
    const prefixed = resolvePricing('openai/gpt-4o', PRICING)
    expect(exact).toEqual(prefixed)
  })
})

describe('computeCost', () => {
  it('returns 0 when pricing is missing', () => {
    expect(computeCost('nonexistent-model', 1000, 500, PRICING)).toBe(0)
  })

  it('computes cost for gpt-4o', () => {
    // 1000 prompt @ $2.5/M + 500 completion @ $10/M = $0.0025 + $0.005 = $0.0075
    expect(computeCost('gpt-4o', 1000, 500, PRICING)).toBeCloseTo(0.0075, 6)
  })

  it('computes cost for gpt-4o-mini', () => {
    // 2000 prompt @ $0.15/M + 1000 completion @ $0.6/M = $0.0003 + $0.0006 = $0.0009
    expect(computeCost('gpt-4o-mini', 2000, 1000, PRICING)).toBeCloseTo(0.0009, 6)
  })

  it('computes cost for prefixed model', () => {
    expect(computeCost('openai/gpt-4o', 1000, 500, PRICING)).toBeCloseTo(0.0075, 6)
  })

  it('covers all studio-sim models', () => {
    const models = [
      'gpt-4o',
      'gpt-4o-mini',
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'deepseek-chat',
      'deepseek-coder',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'openai/gpt-4o',
      'anthropic/claude-3-5-sonnet',
      'google/gemini-1.5-pro',
      'llama-3.1-70b-versatile',
      'mixtral-8x7b-32768',
      'gemma-7b-it',
      'llama3.1-70b',
      'llama3.1-8b',
      'claude-3-5-sonnet',
      'claude-3-haiku-20240307',
    ]
    for (const m of models) {
      const cost = computeCost(m, 1_000_000, 1_000_000, PRICING)
      expect(cost, `expected pricing for ${m}`).toBeGreaterThan(0)
    }
  })
})
