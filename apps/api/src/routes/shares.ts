import { randomBytes } from 'node:crypto'
import {
  createShareInput,
  DataroomApiError,
  SHARE_TTL_OPTIONS,
  type Share,
  shareResponse,
  shareSchema,
} from '@dataroom/shared'
import { and, eq, gt, isNull } from 'drizzle-orm'
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
    expiresAt: row.expiresAt.toISOString(),
    allowDownload: row.allowDownload,
    shareUrl: buildShareUrl(row.token),
  }
}

function generateToken(): string {
  return randomBytes(24).toString('base64url')
}

function ttlToMs(key: string): number {
  const opt = SHARE_TTL_OPTIONS.find((o) => o.key === key)
  return opt ? opt.ms : SHARE_TTL_OPTIONS[1].ms
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
      const now = new Date()
      const row = await db.query.fileShares.findFirst({
        where: and(
          eq(fileShares.fileId, req.params.id),
          isNull(fileShares.revokedAt),
          gt(fileShares.expiresAt, now),
        ),
      })
      return { share: row ? serialize(row) : null }
    },
  )

  server.post(
    '/files/:id/share',
    {
      schema: {
        params: fileParams,
        body: createShareInput,
        response: { 200: shareSchema },
      },
    },
    async (req) => {
      await assertFileAccess(req.params.id, req.auth.userId)
      const now = new Date()
      const existing = await db.query.fileShares.findFirst({
        where: and(
          eq(fileShares.fileId, req.params.id),
          isNull(fileShares.revokedAt),
          gt(fileShares.expiresAt, now),
        ),
      })
      // Rotate on re-share so the owner can change TTL / download policy.
      if (existing) {
        await db.update(fileShares).set({ revokedAt: now }).where(eq(fileShares.id, existing.id))
      }

      const expiresAt = new Date(now.getTime() + ttlToMs(req.body.ttl))
      const [row] = await db
        .insert(fileShares)
        .values({
          fileId: req.params.id,
          token: generateToken(),
          expiresAt,
          allowDownload: req.body.allowDownload,
        })
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
