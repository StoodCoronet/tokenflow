import { existsSync, readFileSync } from 'fs'
import JSON5 from 'json5'
import { expandTilde, DEFAULT_CONFIG_PATH, DEFAULT_PORT, DEFAULT_UI_PORT, DEFAULT_DB_PATH } from '@tokenflow/shared'
import type { AppConfig } from '@tokenflow/shared'

export function loadConfig(): AppConfig {
  const configPath = expandTilde(DEFAULT_CONFIG_PATH)
  if (!existsSync(configPath)) {
    return getDefaultConfig()
  }
  const raw = readFileSync(configPath, 'utf-8')
  const saved = JSON5.parse(raw)
  return { ...getDefaultConfig(), ...saved }
}

function getDefaultConfig(): AppConfig {
  return {
    PORT: DEFAULT_PORT,
    UI_PORT: DEFAULT_UI_PORT,
    APIKEY: '',
    DATABASE: expandTilde(DEFAULT_DB_PATH),
    Providers: [],
    Router: { enabled: false, default: '' },
    Detectors: {
      fullContext: { enabled: true },
      slidingWindow: { enabled: true },
      summarization: { enabled: true },
    },
    LOG_LEVEL: 'info',
  }
}
