import Fastify from 'fastify'
import cors from '@fastify/cors'
import { APP_NAME, APP_VERSION } from '@tokenflow/shared'
import { proxyHandler } from './proxy/handler.js'
import { registerRoutes } from './routes/index.js'
import type { AppConfig } from '@tokenflow/shared'

export async function createApp(config: AppConfig) {
  const app = Fastify({ logger: { level: config.LOG_LEVEL } })

  await app.register(cors, { origin: true })

  app.get('/health', async () => {
    return { status: 'ok', name: APP_NAME, version: APP_VERSION }
  })

  app.get('/', async () => {
    return {
      name: APP_NAME,
      version: APP_VERSION,
      docs: `http://0.0.0.0:${config.PORT}/docs`,
    }
  })

  app.all('/v1/*', proxyHandler)

  await registerRoutes(app)

  return app
}
