import chalk from 'chalk'
import { loadConfig } from '../utils/configLoader.js'

export function showTldr(): void {
  const config = loadConfig()
  const host = 'localhost'

  console.log(chalk.bold('Token Flow — Quick Reference'))
  console.log()
  console.log('  tflow start            Start proxy server')
  console.log('  tflow stop             Stop server')
  console.log('  tflow restart          Restart server')
  console.log('  tflow status           Show server status')
  console.log('  tflow ui               Open Web dashboard')
  console.log('  tflow config           Interactive configuration')
  console.log()
  console.log(chalk.gray(`  Proxy:     http://${host}:${config.PORT}/v1`))
  console.log(chalk.gray(`  Dashboard: http://${host}:${config.UI_PORT}`))
  console.log()
  console.log(chalk.bold('Quick Start:'))
  console.log()
  console.log('  1. tflow start && tflow ui    # Start and open dashboard')
  console.log('  2. tflow config               # Add your first API Key')
  console.log(`  3. Point your OpenAI client to http://${host}:${config.PORT}/v1`)
  console.log()
  console.log(chalk.gray('  Config: ~/.tokenflow/config.json5'))
  console.log(chalk.gray('  Docs:   https://github.com/user/token_flow'))
}
