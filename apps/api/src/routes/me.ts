import { usageResponse } from '@dataroom/shared'
import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { env } from '@/config/env'
import { db } from '@/db/client'

export async function meRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.addHook('preHandler', (req) => app.requireAuth(req))

  server.get('/me/usage', { schema: { response: { 200: usageResponse } } }, async (req) => {
    const rows = await db.execute<{
      dataroom_id: string
      name: string
      bytes: string | number | null
    }>(sql`
        SELECT
          d.id AS dataroom_id,
          d.name AS name,
          COALESCE(SUM(f.size_bytes), 0)::bigint AS bytes
        FROM datarooms d
        LEFT JOIN folders fo
          ON fo.dataroom_id = d.id AND fo.deleted_at IS NULL
        LEFT JOIN files f
          ON f.folder_id = fo.id
          AND f.status = 'ready'
          AND f.deleted_at IS NULL
        WHERE d.owner_id = ${req.auth.userId}
          AND d.deleted_at IS NULL
        GROUP BY d.id, d.name
        ORDER BY d.created_at DESC
      `)

    const perDataroom = rows.map((r) => ({
      dataroomId: r.dataroom_id,
      name: r.name,
      bytes: Number(r.bytes ?? 0),
    }))
    const usedBytes = perDataroom.reduce((sum, d) => sum + d.bytes, 0)

    return {
      usedBytes,
      quotaBytes: env.USER_QUOTA_BYTES,
      perDataroom,
    }
  })
}
