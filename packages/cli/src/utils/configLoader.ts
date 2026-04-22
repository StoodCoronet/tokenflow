import { existsSync, readFileSync, writeFileSync, chmodSync } from 'fs'
import JSON5 from 'json5'
import { expandTilde } from '@tokenflow/shared'
import { DEFAULT_CONFIG_PATH, DEFAULT_PORT, DEFAULT_UI_PORT, DEFAULT_DB_PATH } from '@tokenflow/shared'
import type { AppConfig } from '@tokenflow/shared'
import { ensureConfigDir, getConfigDir } from './processManager.js'

export function getConfigPath(): string {
  return expandTilde(DEFAULT_CONFIG_PATH)
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
