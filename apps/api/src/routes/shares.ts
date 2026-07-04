import { randomBytes } from 'node:crypto'
import { DataroomApiError, type Share, shareResponse, shareSchema } from '@dataroom/shared'
import { and, eq, isNull } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { env } from '@/config/env'
import { db } from '@/db/client'
import { fileShares } from '@/db/schema'
import { assertFileAccess } from '@/lib/ownership'

const fileParams = z.object({ id: z.string().uuid() })

type ShareRow = typeof fileShares.$inferSelect

function buildShareUrl(token: string): string {
  return `${env.PUBLIC_WEB_URL.replace(/\/$/, '')}/share/${token}`
}

function serialize(row: ShareRow): Share {
  return {
    id: row.id,
    fileId: row.fileId,
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
    '/files/:id/share',
    {
      schema: {
        params: fileParams,
        response: { 200: shareResponse },
      },
    },
    async (req) => {
      await assertFileAccess(req.params.id, req.auth.userId)
      const row = await db.query.fileShares.findFirst({
        where: and(eq(fileShares.fileId, req.params.id), isNull(fileShares.revokedAt)),
      })
      return { share: row ? serialize(row) : null }
    },
  )

  server.post(
    '/files/:id/share',
    {
      schema: {
        params: fileParams,
        response: { 200: shareSchema },
      },
    },
    async (req) => {
      await assertFileAccess(req.params.id, req.auth.userId)
      const existing = await db.query.fileShares.findFirst({
        where: and(eq(fileShares.fileId, req.params.id), isNull(fileShares.revokedAt)),
      })
      if (existing) return serialize(existing)

      const [row] = await db
        .insert(fileShares)
        .values({ fileId: req.params.id, token: generateToken() })
        .returning()
      if (!row) throw new DataroomApiError('INTERNAL_ERROR', 'Insert returned no row', 500)
      return serialize(row)
    },
  )

  server.delete(
    '/files/:id/share',
    {
      schema: {
        params: fileParams,
        response: { 200: shareResponse },
      },
    },
    async (req) => {
      await assertFileAccess(req.params.id, req.auth.userId)
      const now = new Date()
      await db
        .update(fileShares)
        .set({ revokedAt: now })
        .where(and(eq(fileShares.fileId, req.params.id), isNull(fileShares.revokedAt)))
      return { share: null }
    },
  )
}
