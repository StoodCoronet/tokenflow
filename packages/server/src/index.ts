import { getDb } from './db/schema.js'
import { loadConfig } from './configLoader.js'
import { createApp } from './app.js'

const config = loadConfig()
const port = parseInt(process.env.TOKENFLOW_PORT ?? String(config.PORT), 10)

const app = await createApp(config)

try {
  getDb(config.DATABASE)
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`Token Flow v${process.env.npm_package_version ?? '0.1.0'} running on port ${port}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
