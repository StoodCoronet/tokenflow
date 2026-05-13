import chalk from 'chalk'
import { getAllServiceStatus, removePids, isProcessRunning } from '../utils/processManager.js'

function killGracefully(pid: number): boolean {
  try {
    process.kill(pid, 'SIGTERM')
    // Wait briefly and check
    for (let i = 0; i < 10; i++) {
      if (!isProcessRunning(pid)) return true
      // Busy-wait ~100ms
      const start = Date.now()
      while (Date.now() - start < 100) { /* spin */ }
    }
    // Force kill
    try { process.kill(pid, 'SIGKILL') } catch {}
    return true
  } catch (err: any) {
    if (err.code === 'ESRCH') return true
    return false
  }
}

export function stopServer(): void {
  const status = getAllServiceStatus()
  const running = [status.server && status.pids.server, status.ui && status.pids.ui, status.docs && status.pids.docs]
    .filter(Boolean) as number[]

  if (running.length === 0) {
    console.log(chalk.yellow('No services are running'))
    return
  }

  let stopped = 0
  for (const pid of running) {
    if (killGracefully(pid)) stopped++
  }

  removePids()
  console.log(chalk.green(`Stopped ${stopped}/${running.length} services`))
}
