import { usageResponse } from '@dataroom/shared'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { env } from '@/config/env'
import { getUsagePerDataroom } from '@/db/queries'

export async function meRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.addHook('preHandler', (req) => app.requireAuth(req))

  server.get('/me/usage', { schema: { response: { 200: usageResponse } } }, async (req) => {
    const perDataroom = await getUsagePerDataroom(req.auth.userId)
    const usedBytes = perDataroom.reduce((sum, d) => sum + d.bytes, 0)
    return {
      usedBytes,
      quotaBytes: env.USER_QUOTA_BYTES,
      perDataroom,
    }
  })
}
