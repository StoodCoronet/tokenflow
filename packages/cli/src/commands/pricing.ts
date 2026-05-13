import chalk from 'chalk'
import { loadConfig, saveConfig } from '../utils/configLoader.js'

interface RemotePricingPayload {
  updatedAt?: string
  source?: string
  prices: Record<string, { prompt: number; completion: number }>
}

function formatPrice(n: number): string {
  if (n < 0.01) return `$${n.toFixed(4)}`
  if (n < 1) return `${(n * 100).toFixed(n >= 0.1 ? 1 : 2)}¢`
  return `$${n.toFixed(2)}`
}

export function listPricing(): void {
  const config = loadConfig()
  const prices = config.Pricing ?? {}
  const entries = Object.entries(prices)

  if (entries.length === 0) {
    console.log(chalk.yellow('No pricing configured.'))
    console.log(chalk.gray('Run "tflow pricing update" to pull from remote source.'))
    return
  }

  console.log(chalk.bold('Model Pricing ($ per 1M tokens)'))
  console.log('─'.repeat(55))
  console.log(`${chalk.bold('Model').padEnd(35)} ${chalk.bold('Prompt').padStart(9)} ${chalk.bold('Completion').padStart(10)}`)
  console.log('─'.repeat(55))

  for (const [model, p] of entries.sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(
      `${model.padEnd(35)} ${formatPrice(p.prompt).padStart(9)} ${formatPrice(p.completion).padStart(10)}`,
    )
  }

  console.log()
  console.log(chalk.gray(`Source: ${config.pricingSource || 'local defaults'}`))
}

export async function updatePricing(): Promise<void> {
  const config = loadConfig()
  const source = config.pricingSource

  if (!source) {
    console.log(chalk.yellow('No pricing source configured.'))
    console.log(chalk.gray('Set it in Settings UI or edit ~/.tokenflow/config.json5:'))
    console.log(chalk.gray('  pricingSource: "https://your-domain.com/pricing.json"'))
    console.log()
    console.log(chalk.gray('You can also use OpenRouter as a fallback source:'))
    console.log(chalk.gray('  https://openrouter.ai/api/v1/models'))
    return
  }

  console.log(chalk.gray(`Fetching pricing from ${source} ...`))

  try {
    const res = await fetch(source, { headers: { Accept: 'application/json' } })
    if (!res.ok) {
      console.log(chalk.red(`Failed to fetch: HTTP ${res.status}`))
      return
    }

    const data = (await res.json()) as RemotePricingPayload | { data?: Array<{ id: string; pricing?: { prompt: string; completion: string } }> }

    let newPrices: Record<string, { prompt: number; completion: number }> = {}

    // OpenRouter format
    if ('data' in data && Array.isArray(data.data)) {
      for (const item of data.data) {
        if (item.pricing && typeof item.pricing.prompt === 'string' && typeof item.pricing.completion === 'string') {
          const prompt = parseFloat(item.pricing.prompt) * 1_000_000
          const completion = parseFloat(item.pricing.completion) * 1_000_000
          if (!Number.isNaN(prompt) && !Number.isNaN(completion)) {
            newPrices[item.id] = { prompt: Math.round(prompt * 1e6) / 1e6, completion: Math.round(completion * 1e6) / 1e6 }
          }
        }
      }
    } else if ('prices' in data && typeof data.prices === 'object') {
      // Token Flow native format
      newPrices = data.prices
    } else {
      console.log(chalk.red('Unrecognized pricing format.'))
      console.log(chalk.gray('Expected: { prices: { "model-name": { prompt: 2.5, completion: 10 } } }'))
      return
    }

    const count = Object.keys(newPrices).length
    if (count === 0) {
      console.log(chalk.yellow('No valid prices found in response.'))
      return
    }

    config.Pricing = { ...config.Pricing, ...newPrices }
    saveConfig(config)

    console.log(chalk.green(`Updated ${count} model price(s).`))
    console.log(chalk.gray('Run "tflow pricing list" to verify.'))
  } catch (err: any) {
    console.log(chalk.red(`Error fetching pricing: ${err.message}`))
  }
}
