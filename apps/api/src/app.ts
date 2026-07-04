import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import sensible from '@fastify/sensible'
import Fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { env } from '@/config/env'
import { clerkAuthPlugin } from '@/plugins/clerk-auth'
import { errorHandlerPlugin } from '@/plugins/error-handler'
import { authRoutes } from '@/routes/auth'
import { dataroomsRoutes } from '@/routes/datarooms'
import { filesRoutes } from '@/routes/files'
import { foldersRoutes } from '@/routes/folders'
import { healthRoutes } from '@/routes/health'
import { meRoutes } from '@/routes/me'
import { publicSharesRoutes } from '@/routes/public-shares'
import { searchRoutes } from '@/routes/search'
import { sharesRoutes } from '@/routes/shares'
import { trashRoutes } from '@/routes/trash'

export async function buildApp() {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'development'
        ? {
            level: 'debug',
            transport: { target: 'pino-pretty', options: { colorize: true } },
          }
        : { level: 'info' },
    disableRequestLogging: false,
  }).withTypeProvider<ZodTypeProvider>()

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(cors, {
    origin: env.ALLOWED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  })
  await app.register(sensible)
  await app.register(rateLimit, {
    global: false,
    keyGenerator: (req) => req.auth?.userId ?? req.ip,
  })
  await app.register(errorHandlerPlugin)
  await app.register(clerkAuthPlugin)

  await app.register(healthRoutes)
  await app.register(publicSharesRoutes)
  await app.register(authRoutes)
  await app.register(dataroomsRoutes)
  await app.register(foldersRoutes)
  await app.register(filesRoutes)
  await app.register(meRoutes)
  await app.register(searchRoutes)
  await app.register(sharesRoutes)
  await app.register(trashRoutes)

  return app
}
