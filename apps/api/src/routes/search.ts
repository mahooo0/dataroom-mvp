import {
  DATAROOM_ICON_KEYS,
  type DataroomIconKey,
  searchQuerySchema,
  searchResponse,
} from '@dataroom/shared'
import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { db } from '@/db/client'

const VALID_ICON_KEYS: ReadonlySet<string> = new Set(DATAROOM_ICON_KEYS)

function normalizeIconKey(raw: string | null): DataroomIconKey | null {
  return raw && VALID_ICON_KEYS.has(raw) ? (raw as DataroomIconKey) : null
}

const MAX_HITS = 12

export async function searchRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.addHook('preHandler', (req) => app.requireAuth(req))

  server.get(
    '/search',
    {
      schema: {
        querystring: searchQuerySchema,
        response: { 200: searchResponse },
      },
    },
    async (req) => {
      const q = (req.query.q ?? '').trim()
      const iconKey = req.query.iconKey ?? null
      const pattern = `%${q}%`
      const hasQuery = q.length > 0

      const dataroomRows = await db.execute<{
        id: string
        name: string
        icon_key: string | null
      }>(sql`
        SELECT id, name, icon_key
        FROM datarooms
        WHERE owner_id = ${req.auth.userId}
          AND deleted_at IS NULL
          AND (${!hasQuery}::boolean OR name ILIKE ${pattern})
          AND (${iconKey === null}::boolean OR icon_key = ${iconKey})
        ORDER BY updated_at DESC
        LIMIT ${MAX_HITS}
      `)

      const folderRows = await db.execute<{
        id: string
        name: string
        dataroom_id: string
        dataroom_name: string
      }>(sql`
        SELECT f.id, f.name, d.id AS dataroom_id, d.name AS dataroom_name
        FROM folders f
        INNER JOIN datarooms d ON d.id = f.dataroom_id
        WHERE d.owner_id = ${req.auth.userId}
          AND d.deleted_at IS NULL
          AND f.deleted_at IS NULL
          AND (${!hasQuery}::boolean OR f.name ILIKE ${pattern})
          AND (${iconKey === null}::boolean OR d.icon_key = ${iconKey})
        ORDER BY f.updated_at DESC
        LIMIT ${MAX_HITS}
      `)

      const fileRows = await db.execute<{
        id: string
        name: string
        folder_id: string
        folder_name: string
        dataroom_id: string
        dataroom_name: string
      }>(sql`
        SELECT fi.id, fi.name, fo.id AS folder_id, fo.name AS folder_name,
               d.id AS dataroom_id, d.name AS dataroom_name
        FROM files fi
        INNER JOIN folders fo ON fo.id = fi.folder_id
        INNER JOIN datarooms d ON d.id = fo.dataroom_id
        WHERE d.owner_id = ${req.auth.userId}
          AND d.deleted_at IS NULL
          AND fo.deleted_at IS NULL
          AND fi.deleted_at IS NULL
          AND fi.status = 'ready'
          AND (${!hasQuery}::boolean OR fi.name ILIKE ${pattern})
          AND (${iconKey === null}::boolean OR d.icon_key = ${iconKey})
        ORDER BY fi.updated_at DESC
        LIMIT ${MAX_HITS}
      `)

      return {
        datarooms: dataroomRows.map((r) => ({
          id: r.id,
          name: r.name,
          iconKey: normalizeIconKey(r.icon_key),
        })),
        folders: folderRows.map((r) => ({
          id: r.id,
          name: r.name,
          dataroomId: r.dataroom_id,
          dataroomName: r.dataroom_name,
        })),
        files: fileRows.map((r) => ({
          id: r.id,
          name: r.name,
          folderId: r.folder_id,
          dataroomId: r.dataroom_id,
          dataroomName: r.dataroom_name,
          folderName: r.folder_name,
        })),
      }
    },
  )
}
