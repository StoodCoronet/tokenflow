import Fastify from 'fastify'
import cors from '@fastify/cors'
import { APP_NAME, APP_VERSION } from '@tokenflow/shared'
import { getDb } from './db/schema.js'
import { proxyHandler } from './proxy/handler.js'
import { registerRoutes } from './routes/index.js'
import { loadConfig } from './configLoader.js'

const config = loadConfig()
const port = parseInt(process.env.TOKENFLOW_PORT ?? String(config.PORT), 10)

const app = Fastify({ logger: { level: config.LOG_LEVEL } })

await app.register(cors, { origin: true })

// Health check
app.get('/health', async () => {
  return { status: 'ok', name: APP_NAME, version: APP_VERSION }
})

// App info
app.get('/', async () => {
  return {
    name: APP_NAME,
    version: APP_VERSION,
    docs: `http://localhost:${port}/docs`,
  }
})

// Proxy: catch-all for /v1/* requests
app.all('/v1/*', proxyHandler)

// API routes
await registerRoutes(app)

// Start
try {
  // Initialize DB
  getDb(config.DATABASE)

  await app.listen({ port, host: '0.0.0.0' })
  console.log(`${APP_NAME} v${APP_VERSION} running on port ${port}`)
  console.log(`  Health: http://localhost:${port}/health`)
  console.log(`  Proxy:  http://localhost:${port}/v1`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
