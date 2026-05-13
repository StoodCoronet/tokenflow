import { existsSync, readFileSync, writeFileSync, chmodSync } from 'fs'
import JSON5 from 'json5'
import { expandTilde } from '@tokenflow/shared'
import { DEFAULT_CONFIG_PATH, DEFAULT_PORT, DEFAULT_UI_PORT, DEFAULT_DB_PATH } from '@tokenflow/shared'
import type { AppConfig } from '@tokenflow/shared'
import { ensureConfigDir, getConfigDir } from './processManager.js'

export function getConfigPath(): string {
  return expandTilde(process.env.TOKENFLOW_CONFIG_PATH ?? DEFAULT_CONFIG_PATH)
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
      'gpt-4o': { prompt: 5, completion: 15 },
      'gpt-4o-mini': { prompt: 0.15, completion: 0.6 },
      'claude-3-5-sonnet': { prompt: 3, completion: 15 },
      'claude-3-5-sonnet-20241022': { prompt: 3, completion: 15 },
      'claude-3-opus-20240229': { prompt: 15, completion: 75 },
      'deepseek-chat': { prompt: 0.14, completion: 0.28 },
      'deepseek-coder': { prompt: 0.14, completion: 0.28 },
      'gemini-1.5-pro': { prompt: 1.25, completion: 5 },
      'gemini-1.5-flash': { prompt: 0.075, completion: 0.3 },
    },
  }
}

export function loadConfig(): AppConfig {
  const configPath = getConfigPath()
  if (!existsSync(configPath)) {
    return getDefaultConfig()
  }
  const raw = readFileSync(configPath, 'utf-8')
  const saved = JSON5.parse(raw)
  return { ...getDefaultConfig(), ...saved }
}

export function saveConfig(config: AppConfig): void {
  ensureConfigDir()
  const path = getConfigPath()
  writeFileSync(path, JSON5.stringify(config, null, 2))
  try { chmodSync(path, 0o600) } catch {}
}
