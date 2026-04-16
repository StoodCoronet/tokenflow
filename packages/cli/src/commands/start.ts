import { spawn } from 'child_process'
import { resolve } from 'path'
import chalk from 'chalk'
import { getServerStatus, writePid, isProcessRunning, readPid, ensureConfigDir } from '../utils/processManager.js'
import { loadConfig } from '../utils/configLoader.js'

export function startServer(portOverride?: number): void {
  const status = getServerStatus()
  if (status.running) {
    console.log(chalk.yellow(`Server is already running (PID: ${status.pid})`))
    return
  }

  const config = loadConfig()
  const port = portOverride ?? config.PORT

  // Resolve server entry path
  const serverPath = resolve(import.meta.dirname, '../../server/dist/index.js')

  ensureConfigDir()

  const child = spawn('node', [serverPath], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      TOKENFLOW_PORT: String(port),
    },
  })

  child.unref()
  writePid(child.pid!)

  console.log(chalk.green(`Server started on port ${port} (PID: ${child.pid})`))
  console.log(chalk.gray(`  API: http://localhost:${port}/v1`))
  console.log(chalk.gray(`  Health: http://localhost:${port}/health`))
}
