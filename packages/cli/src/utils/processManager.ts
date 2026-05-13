import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import JSON5 from 'json5'
import { expandTilde } from '@tokenflow/shared'
import { DEFAULT_CONFIG_DIR, DEFAULT_CONFIG_PATH, DEFAULT_PORT, PID_FILE } from '@tokenflow/shared'

export function getConfigDir(): string {
  return expandTilde(DEFAULT_CONFIG_DIR)
}

function getPidFile(): string {
  return expandTilde(PID_FILE)
}

function getPidsFile(): string {
  return expandTilde(DEFAULT_CONFIG_DIR + '/pids.json')
}

export function ensureConfigDir(): void {
  const dir = getConfigDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

// ── Legacy single-PID helpers (kept for backward compat) ──

export function readPid(): number | null {
  const pidFile = getPidFile()
  if (!existsSync(pidFile)) return null
  const pid = parseInt(readFileSync(pidFile, 'utf-8').trim(), 10)
  if (isNaN(pid)) return null
  return pid
}

export function writePid(pid: number): void {
  ensureConfigDir()
  writeFileSync(getPidFile(), String(pid))
}

export function removePid(): void {
  const pidFile = getPidFile()
  if (existsSync(pidFile)) {
    try { execSync(`rm ${pidFile}`) } catch {}
  }
}

// ── Multi-PID helpers (server + ui + docs) ──

export interface ServicePids {
  server?: number
  ui?: number
  docs?: number
}

export function readPids(): ServicePids {
  const pidsFile = getPidsFile()
  if (!existsSync(pidsFile)) return {}
  try {
    const raw = readFileSync(pidsFile, 'utf-8')
    return JSON.parse(raw) as ServicePids
  } catch {
    return {}
  }
}

export function writePids(pids: ServicePids): void {
  ensureConfigDir()
  writeFileSync(getPidsFile(), JSON.stringify(pids, null, 2))
}

export function removePids(): void {
  const pidsFile = getPidsFile()
  if (existsSync(pidsFile)) {
    try { execSync(`rm ${pidsFile}`) } catch {}
  }
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function readPortFromConfig(): number {
  try {
    const configPath = expandTilde(process.env.TOKENFLOW_CONFIG_PATH ?? DEFAULT_CONFIG_PATH)
    if (!existsSync(configPath)) return DEFAULT_PORT
    const saved = JSON5.parse(readFileSync(configPath, 'utf-8'))
    return saved.PORT || DEFAULT_PORT
  } catch {
    return DEFAULT_PORT
  }
}

export function getServerStatus(): { running: boolean; pid: number | null; port: number | null } {
  const pids = readPids()
  if (!pids.server) return { running: false, pid: null, port: null }
  if (!isProcessRunning(pids.server)) {
    removePids()
    return { running: false, pid: null, port: null }
  }
  return { running: true, pid: pids.server, port: readPortFromConfig() }
}

export function getAllServiceStatus(): { server: boolean; ui: boolean; docs: boolean; pids: ServicePids } {
  const pids = readPids()
  const status = {
    server: pids.server ? isProcessRunning(pids.server) : false,
    ui: pids.ui ? isProcessRunning(pids.ui) : false,
    docs: pids.docs ? isProcessRunning(pids.docs) : false,
    pids,
  }
  // If server is dead but pids file exists, clean it up
  if (pids.server && !status.server) {
    removePids()
  }
  return status
}
