import { spawn } from 'child_process'
import { resolve } from 'path'
import chalk from 'chalk'
import { getAllServiceStatus, writePids, ensureConfigDir, isProcessRunning } from '../utils/processManager.js'
import { loadConfig } from '../utils/configLoader.js'
import { findWorkspaceRoot } from '../utils/workspaceRoot.js'

function spawnService(name: string, cwd: string, command: string, args: string[]): { pid: number; name: string } {
  const child = spawn(command, args, {
    cwd,
    detached: true,
    stdio: 'ignore',
    shell: true,
    env: { ...process.env, FORCE_COLOR: '0' },
  })
  child.unref()
  return { pid: child.pid!, name }
}

export function startServer(portOverride?: number): void {
  const status = getAllServiceStatus()
  if (status.server) {
    console.log(chalk.yellow('Services are already running'))
    console.log(chalk.gray(`  Server PID: ${status.pids.server}`))
    if (status.ui) console.log(chalk.gray(`  UI PID: ${status.pids.ui}`))
    if (status.docs) console.log(chalk.gray(`  Docs PID: ${status.pids.docs}`))
    return
  }

  const config = loadConfig()
  const port = portOverride ?? config.PORT
  const workspaceRoot = findWorkspaceRoot()

  ensureConfigDir()

  const services: { pid: number; name: string }[] = []

  // Start server
  services.push(spawnService('server', resolve(workspaceRoot, 'packages/server'), 'pnpm', ['dev']))

  // Start UI
  services.push(spawnService('ui', resolve(workspaceRoot, 'packages/ui'), 'pnpm', ['dev']))

  // Start docs
  services.push(spawnService('docs', resolve(workspaceRoot, 'packages/docs'), 'pnpm', ['dev']))

  // Small delay to verify processes actually started
  setTimeout(() => {
    const pids = {
      server: services.find(s => s.name === 'server')!.pid,
      ui: services.find(s => s.name === 'ui')!.pid,
      docs: services.find(s => s.name === 'docs')!.pid,
    }

    const alive = services.filter(s => isProcessRunning(s.pid))
    if (alive.length !== services.length) {
      console.log(chalk.yellow('Warning: some services may not have started correctly'))
    }

    writePids(pids)

    console.log(chalk.green(`Token Flow started (${alive.length}/${services.length} services)`))
    console.log(chalk.gray(`  Server: http://0.0.0.0:${port}`))
    console.log(chalk.gray(`  UI:     http://0.0.0.0:${config.UI_PORT}`))
    console.log(chalk.gray(`  Docs:   http://0.0.0.0:40003`))
  }, 800)
}
