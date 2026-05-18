import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'fs'
import { dirname } from 'path'
import JSON5 from 'json5'
import { expandTilde, DEFAULT_CONFIG_PATH, DEFAULT_PORT, DEFAULT_UI_PORT, DEFAULT_DB_PATH } from '@tokenflow/shared'
import type { AppConfig } from '@tokenflow/shared'

function getConfigPath(): string {
  return expandTilde(process.env.TOKENFLOW_CONFIG_PATH ?? DEFAULT_CONFIG_PATH)
}

export function loadConfig(): AppConfig {
  const configPath = getConfigPath()
  if (!existsSync(configPath)) {
    return getDefaultConfig()
  }
  const raw = readFileSync(configPath, 'utf-8')
  const saved = JSON5.parse(raw)
  const config = { ...getDefaultConfig(), ...saved }

  // Backward compatibility: fill missing template on Providers
  if (config.Providers) {
    config.Providers = config.Providers.map((p: any) => ({
      ...p,
      template: p.template || 'openai',
    }))
  }

  return config
}

export function saveConfig(config: AppConfig): void {
  const configPath = getConfigPath()
  mkdirSync(dirname(configPath), { recursive: true })
  writeFileSync(configPath, JSON5.stringify(config, null, 2))
  try { chmodSync(configPath, 0o600) } catch {}
}

export function getDefaultConfig(): AppConfig {
  return {
    PORT: DEFAULT_PORT,
    UI_PORT: DEFAULT_UI_PORT,
    APIKEY: '',
    DATABASE: expandTilde(DEFAULT_DB_PATH),
    Providers: [],
    Detectors: {
      fullContext: { enabled: true },
      slidingWindow: { enabled: true },
      summarization: { enabled: true },
    },
    LOG_LEVEL: 'info',
    PROXY_URL: '',
    pricingSource: 'http://localhost:40010/pricing.json',
    Pricing: {
      'gpt-4o': { prompt: 2.5, completion: 10 },
      'gpt-4o-mini': { prompt: 0.15, completion: 0.6 },
      'claude-3-5-sonnet': { prompt: 3, completion: 15 },
      'claude-3-5-sonnet-20241022': { prompt: 3, completion: 15 },
      'claude-3-opus-20240229': { prompt: 15, completion: 75 },
      'claude-3-haiku-20240307': { prompt: 0.25, completion: 1.25 },
      'deepseek-chat': { prompt: 0.14, completion: 0.28 },
      'deepseek-coder': { prompt: 0.14, completion: 0.28 },
      'gemini-1.5-pro': { prompt: 1.25, completion: 5 },
      'gemini-1.5-flash': { prompt: 0.075, completion: 0.3 },
      'llama-3.1-70b-versatile': { prompt: 0.59, completion: 0.79 },
      'llama3.1-70b': { prompt: 0.60, completion: 0.60 },
      'llama3.1-8b': { prompt: 0.10, completion: 0.10 },
      'mixtral-8x7b-32768': { prompt: 0.24, completion: 0.24 },
      'gemma-7b-it': { prompt: 0.05, completion: 0.05 },
    },
  }
}
