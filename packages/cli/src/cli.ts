import { Command } from 'commander'
import { startServer } from './commands/start.js'
import { stopServer } from './commands/stop.js'
import { restartServer } from './commands/restart.js'
import { showStatus } from './commands/status.js'
import { openUI } from './commands/ui.js'
import { configure } from './commands/config.js'
import { showTldr } from './commands/tldr.js'
import { APP_NAME, APP_VERSION } from '@tokenflow/shared'

// Handle --tldr before commander parses
if (process.argv.includes('--tldr')) {
  showTldr()
  process.exit(0)
}

const program = new Command()

program
  .name('tflow')
  .description(`${APP_NAME} — LLM traffic monitoring and context optimization`)
  .version(APP_VERSION)
  .helpOption('-h, --help', 'Show help (use --tldr for quick reference)')

program
  .command('start')
  .description('Start the proxy server')
  .option('-p, --port <port>', 'Server port')
  .action((opts) => {
    startServer(opts.port ? parseInt(opts.port, 10) : undefined)
  })

program
  .command('stop')
  .description('Stop the proxy server')
  .action(() => {
    stopServer()
  })

program
  .command('restart')
  .description('Restart the proxy server')
  .option('-p, --port <port>', 'Server port')
  .action((opts) => {
    restartServer(opts.port ? parseInt(opts.port, 10) : undefined)
  })

program
  .command('status')
  .description('Show server status')
  .action(() => {
    showStatus()
  })

program
  .command('ui')
  .description('Open Web dashboard in browser')
  .action(() => {
    openUI()
  })

program
  .command('config')
  .description('Interactive configuration')
  .action(async () => {
    await configure()
  })

program.addHelpText('after', '\n  Use --tldr for a quick reference guide')

program.parse()
