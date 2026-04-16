import chalk from 'chalk'
import { input, select, confirm } from '@inquirer/prompts'
import { loadConfig, saveConfig } from '../utils/configLoader.js'
import type { AppConfig, Provider } from '@tokenflow/shared'

export async function configure(): Promise<void> {
  const config = loadConfig()

  console.log(chalk.bold('Token Flow Configuration'))
  console.log('─'.repeat(30))

  const action = await select({
    message: 'What do you want to configure?',
    choices: [
      { name: 'Add/Edit Provider', value: 'provider' },
      { name: 'Server Ports', value: 'ports' },
      { name: 'Smart Router', value: 'router' },
      { name: 'Detectors', value: 'detectors' },
      { name: 'View Current Config', value: 'view' },
      { name: 'Exit', value: 'exit' },
    ],
  })

  switch (action) {
    case 'provider':
      await configureProvider(config)
      break
    case 'ports':
      await configurePorts(config)
      break
    case 'router':
      await configureRouter(config)
      break
    case 'detectors':
      await configureDetectors(config)
      break
    case 'view':
      console.log(JSON.stringify(config, null, 2))
      return
    case 'exit':
      return
  }
}

async function configureProvider(config: AppConfig): Promise<void> {
  const name = await input({ message: 'Provider name (e.g. openai, anthropic):' })
  const api_base_url = await input({ message: 'API Base URL:' })
  const api_key = await input({ message: 'API Key:' })
  const modelsStr = await input({ message: 'Models (comma-separated):' })
  const models = modelsStr.split(',').map(m => m.trim()).filter(Boolean)

  const existing = config.Providers.findIndex(p => p.name === name)
  const provider: Provider = { name, api_base_url, api_key, models }

  if (existing >= 0) {
    config.Providers[existing] = provider
    console.log(chalk.green(`Updated provider: ${name}`))
  } else {
    config.Providers.push(provider)
    console.log(chalk.green(`Added provider: ${name}`))
  }

  saveConfig(config)
}

async function configurePorts(config: AppConfig): Promise<void> {
  const portStr = await input({ message: 'Server port:', default: String(config.PORT) })
  const uiPortStr = await input({ message: 'UI port:', default: String(config.UI_PORT) })
  config.PORT = parseInt(portStr, 10)
  config.UI_PORT = parseInt(uiPortStr, 10)
  saveConfig(config)
  console.log(chalk.green(`Ports updated: server=${config.PORT}, ui=${config.UI_PORT}`))
}

async function configureRouter(config: AppConfig): Promise<void> {
  const enabled = await confirm({ message: 'Enable smart router?', default: config.Router.enabled })
  config.Router.enabled = enabled
  if (enabled) {
    const defaultRoute = await input({ message: 'Default route (provider,model):', default: config.Router.default || 'openai,gpt-4o' })
    config.Router.default = defaultRoute
  }
  saveConfig(config)
  console.log(chalk.green(`Router ${enabled ? 'enabled' : 'disabled'}`))
}

async function configureDetectors(config: AppConfig): Promise<void> {
  for (const [name, cfg] of Object.entries(config.Detectors)) {
    const enabled = await confirm({ message: `Enable ${name} detector?`, default: cfg.enabled })
    config.Detectors[name] = { enabled }
  }
  saveConfig(config)
  console.log(chalk.green('Detectors updated'))
}
