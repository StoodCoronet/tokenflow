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

function getDefaultConfig(): AppConfig {
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
  }
}
