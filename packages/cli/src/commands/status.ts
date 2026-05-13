import chalk from 'chalk'
import { getAllServiceStatus } from '../utils/processManager.js'
import { loadConfig } from '../utils/configLoader.js'

export function showStatus(): void {
  const status = getAllServiceStatus()
  const config = loadConfig()

  console.log(chalk.bold('Token Flow Status'))
  console.log('─'.repeat(30))

  const anyRunning = status.server || status.ui || status.docs

  if (!anyRunning) {
    console.log(`  ${chalk.red('●')} All services: ${chalk.red('stopped')}`)
    console.log(chalk.gray('  Run "tflow start" to start'))
    return
  }

  console.log(`  ${status.server ? chalk.green('●') : chalk.red('●')} Server  ${status.server ? chalk.green('running') : chalk.red('stopped')}  ${status.pids.server ? `(PID: ${status.pids.server})` : ''}`)
  console.log(`  ${status.ui ? chalk.green('●') : chalk.red('●')} UI      ${status.ui ? chalk.green('running') : chalk.red('stopped')}  ${status.pids.ui ? `(PID: ${status.pids.ui})` : ''}`)
  console.log(`  ${status.docs ? chalk.green('●') : chalk.red('●')} Docs    ${status.docs ? chalk.green('running') : chalk.red('stopped')}  ${status.pids.docs ? `(PID: ${status.pids.docs})` : ''}`)
  console.log()
  console.log(`  API:  http://0.0.0.0:${config.PORT}/v1`)
  console.log(`  UI:   http://0.0.0.0:${config.UI_PORT}`)
  console.log(`  Docs: http://0.0.0.0:40003`)
}
