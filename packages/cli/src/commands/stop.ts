import chalk from 'chalk'
import { getServerStatus, readPid, removePid } from '../utils/processManager.js'

export function stopServer(): void {
  const status = getServerStatus()
  if (!status.running) {
    console.log(chalk.yellow('Server is not running'))
    return
  }

  try {
    process.kill(status.pid!, 'SIGTERM')
    removePid()
    console.log(chalk.green('Server stopped'))
  } catch (err: any) {
    if (err.code === 'ESRCH') {
      removePid()
      console.log(chalk.yellow('Server process not found, cleaned up PID file'))
    } else {
      console.error(chalk.red(`Failed to stop server: ${err.message}`))
    }
  }
}
