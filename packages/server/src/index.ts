import { APP_NAME, APP_VERSION } from '@tokenflow/shared'
import { getDb, cleanupOldStats } from './db/schema.js'
import { loadConfig } from './configLoader.js'
import { createApp } from './app.js'

const config = loadConfig()
const port = parseInt(process.env.TOKENFLOW_PORT ?? String(config.PORT), 10)

const app = await createApp(config)

try {
  getDb(config.DATABASE)
  cleanupOldStats()
  const addr = await app.listen({ port, host: '0.0.0.0' })

  console.log(`
${APP_NAME} v${APP_VERSION}
  Server: ${addr}
  Health: ${addr}/health
  Proxy:  ${addr}/v1
  API:    ${addr}/api
`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
