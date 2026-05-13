import chalk from 'chalk'
import { getServerStatus } from '../utils/processManager.js'
import { loadConfig } from '../utils/configLoader.js'
import { openBrowser } from '../utils/browser.js'
import { startServer } from './start.js'

export function openUI(): void {
  let status = getServerStatus()
  const config = loadConfig()

  if (!status.running) {
    console.log(chalk.gray('Server not running, starting...'))
    startServer()
    status = getServerStatus()
  }

  const url = `http://0.0.0.0:${config.UI_PORT}`
  console.log(chalk.green(`Opening UI: ${url}`))
  openBrowser(url)
}
