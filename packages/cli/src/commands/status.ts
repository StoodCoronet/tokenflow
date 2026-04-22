import chalk from 'chalk'
import { getServerStatus } from '../utils/processManager.js'
import { loadConfig } from '../utils/configLoader.js'

export function showStatus(): void {
  const status = getServerStatus()
  const config = loadConfig()

  console.log(chalk.bold('Token Flow Status'))
  console.log('─'.repeat(30))

  if (status.running) {
    console.log(`  ${chalk.green('●')} Server: ${chalk.green('running')}`)
    console.log(`  PID: ${status.pid}`)
    console.log(`  Port: ${config.PORT}`)
    console.log(`  API: http://localhost:${config.PORT}/v1`)
    console.log(`  UI:  http://localhost:${config.UI_PORT}`)
    console.log(`  DB:  ${config.DATABASE}`)
    console.log(`  Providers: ${config.Providers.length}`)
  } else {
    console.log(`  ${chalk.red('●')} Server: ${chalk.red('stopped')}`)
    console.log(chalk.gray('  Run "tflow start" to start the server'))
  }
}
