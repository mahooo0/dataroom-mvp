import { healthResponseSchema } from '@dataroom/shared'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

export async function healthRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  // Unauth liveness — for uptime monitors / Traefik / Dokploy
  server.get(
    '/health',
    {
      schema: {
        response: {
          200: z.object({
            status: z.literal('ok'),
            timestamp: z.string().datetime(),
          }),
        },
      },
    },
    async () => ({
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
    }),
  )

  // Auth roundtrip — proves Clerk JWT verification works end-to-end
  server.get(
    '/me',
    {
      preHandler: async (req) => {
        await app.requireAuth(req)
      },
      schema: {
        response: {
          200: healthResponseSchema,
        },
      },
    },
    async (req) => ({
      status: 'ok' as const,
      userId: req.auth.userId,
      timestamp: new Date().toISOString(),
    }),
  )
}
