import { execSync, spawn } from 'child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { expandTilde } from '@tokenflow/shared'
import { DEFAULT_CONFIG_DIR, PID_FILE } from '@tokenflow/shared'

export function getConfigDir(): string {
  return expandTilde(DEFAULT_CONFIG_DIR)
}

function getPidFile(): string {
  return expandTilde(PID_FILE)
}

export function ensureConfigDir(): void {
  const dir = getConfigDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

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
    execSync(`rm ${pidFile}`)
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

export function getServerStatus(): { running: boolean; pid: number | null; port: number | null } {
  const pid = readPid()
  if (pid === null) return { running: false, pid: null, port: null }
  if (!isProcessRunning(pid)) {
    removePid()
    return { running: false, pid: null, port: null }
  }
  return { running: true, pid, port: null } // TODO: read port from config
}
