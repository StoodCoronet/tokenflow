import chalk from 'chalk'
import { stopServer } from './stop.js'
import { startServer } from './start.js'

export function restartServer(portOverride?: number): void {
  console.log(chalk.yellow('Restarting all services...'))
  stopServer()
  // Small delay to let ports free up
  setTimeout(() => {
    startServer(portOverride)
  }, 800)
}
