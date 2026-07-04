import { HeadBucketCommand } from '@aws-sdk/client-s3'
import { healthResponseSchema } from '@dataroom/shared'
import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { db } from '@/db/client'
import { BUCKET, s3ForServerOps } from '@/services/storage.service'

export async function healthRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  // Shallow liveness — cheap 200 for uptime monitors that just want a heartbeat.
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

  // Deep readiness — Traefik / Dokploy should route to /ready so a broken DB or
  // unreachable MinIO removes the instance from the pool instead of 500-ing users.
  server.get(
    '/ready',
    {
      schema: {
        response: {
          200: z.object({
            status: z.literal('ok'),
            db: z.literal('ok'),
            s3: z.literal('ok'),
            timestamp: z.string().datetime(),
          }),
          503: z.object({
            status: z.literal('degraded'),
            db: z.enum(['ok', 'fail']),
            s3: z.enum(['ok', 'fail']),
            timestamp: z.string().datetime(),
          }),
        },
      },
    },
    async (_req, reply) => {
      const [dbOk, s3Ok] = await Promise.all([
        db
          .execute(sql`SELECT 1`)
          .then(() => true)
          .catch(() => false),
        s3ForServerOps
          .send(new HeadBucketCommand({ Bucket: BUCKET }))
          .then(() => true)
          .catch(() => false),
      ])
      if (dbOk && s3Ok) {
        return {
          status: 'ok' as const,
          db: 'ok' as const,
          s3: 'ok' as const,
          timestamp: new Date().toISOString(),
        }
      }
      reply.code(503)
      return {
        status: 'degraded' as const,
        db: dbOk ? ('ok' as const) : ('fail' as const),
        s3: s3Ok ? ('ok' as const) : ('fail' as const),
        timestamp: new Date().toISOString(),
      }
    },
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
