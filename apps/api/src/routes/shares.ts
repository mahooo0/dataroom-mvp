import { randomBytes } from 'node:crypto'
import { DataroomApiError, type Share, shareResponse, shareSchema } from '@dataroom/shared'
import { and, eq, isNull } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { env } from '@/config/env'
import { db } from '@/db/client'
import { dataroomShares } from '@/db/schema'
import { assertDataroomAccess } from '@/lib/ownership'

const dataroomParams = z.object({ id: z.string().uuid() })

type ShareRow = typeof dataroomShares.$inferSelect

function buildShareUrl(token: string): string {
  return `${env.PUBLIC_WEB_URL.replace(/\/$/, '')}/share/${token}`
}

function serialize(row: ShareRow): Share {
  return {
    id: row.id,
    dataroomId: row.dataroomId,
    token: row.token,
    createdAt: row.createdAt.toISOString(),
    shareUrl: buildShareUrl(row.token),
  }
}

function generateToken(): string {
  return randomBytes(24).toString('base64url')
}

export async function sharesRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.addHook('preHandler', (req) => app.requireAuth(req))

  server.get(
    '/datarooms/:id/share',
    {
      schema: {
        params: dataroomParams,
        response: { 200: shareResponse },
      },
    },
    async (req) => {
      await assertDataroomAccess(req.params.id, req.auth.userId)
      const row = await db.query.dataroomShares.findFirst({
        where: and(eq(dataroomShares.dataroomId, req.params.id), isNull(dataroomShares.revokedAt)),
      })
      return { share: row ? serialize(row) : null }
    },
  )

  server.post(
    '/datarooms/:id/share',
    {
      schema: {
        params: dataroomParams,
        response: { 200: shareSchema },
      },
    },
    async (req) => {
      await assertDataroomAccess(req.params.id, req.auth.userId)
      const existing = await db.query.dataroomShares.findFirst({
        where: and(eq(dataroomShares.dataroomId, req.params.id), isNull(dataroomShares.revokedAt)),
      })
      if (existing) return serialize(existing)

      const [row] = await db
        .insert(dataroomShares)
        .values({ dataroomId: req.params.id, token: generateToken() })
        .returning()
      if (!row) throw new DataroomApiError('INTERNAL_ERROR', 'Insert returned no row', 500)
      return serialize(row)
    },
  )

  server.delete(
    '/datarooms/:id/share',
    {
      schema: {
        params: dataroomParams,
        response: { 200: shareResponse },
      },
    },
    async (req) => {
      await assertDataroomAccess(req.params.id, req.auth.userId)
      const now = new Date()
      await db
        .update(dataroomShares)
        .set({ revokedAt: now })
        .where(and(eq(dataroomShares.dataroomId, req.params.id), isNull(dataroomShares.revokedAt)))
      return { share: null }
    },
  )
}
