import { DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { DataroomApiError, trashItemKindSchema, trashListResponse } from '@dataroom/shared'
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { db } from '@/db/client'
import { datarooms, files, folders } from '@/db/schema'
import { BUCKET, s3ForServerOps } from '@/services/storage.service'

const trashParams = z.object({
  kind: trashItemKindSchema,
  id: z.string().uuid(),
})

async function collectS3KeysForFolder(folderId: string): Promise<string[]> {
  const rows = await db.execute<{ s3_key: string }>(sql`
    WITH RECURSIVE descendants AS (
      SELECT id FROM folders WHERE id = ${folderId}
      UNION ALL
      SELECT f.id FROM folders f
      INNER JOIN descendants d ON f.parent_id = d.id
    )
    SELECT s3_key FROM files WHERE folder_id IN (SELECT id FROM descendants)
  `)
  return rows.map((r) => r.s3_key)
}

async function collectS3KeysForDataroom(dataroomId: string): Promise<string[]> {
  const rows = await db.execute<{ s3_key: string }>(sql`
    SELECT s3_key FROM files
    WHERE folder_id IN (SELECT id FROM folders WHERE dataroom_id = ${dataroomId})
  `)
  return rows.map((r) => r.s3_key)
}

async function bestEffortDeleteObjects(
  keys: string[],
  logger: import('fastify').FastifyBaseLogger,
): Promise<void> {
  if (keys.length === 0) return
  const CHUNK = 1000
  for (let i = 0; i < keys.length; i += CHUNK) {
    const slice = keys.slice(i, i + CHUNK)
    try {
      await s3ForServerOps.send(
        new DeleteObjectsCommand({
          Bucket: BUCKET,
          Delete: { Objects: slice.map((Key) => ({ Key })), Quiet: true },
        }),
      )
    } catch (err) {
      logger.warn({ err, count: slice.length }, 'best-effort S3 batch delete failed')
    }
  }
}

export async function trashRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.addHook('preHandler', (req) => app.requireAuth(req))

  server.get(
    '/trash',
    {
      schema: {
        response: { 200: trashListResponse },
      },
    },
    async (req) => {
      const owner = req.auth.userId

      const [dataroomRows, folderRows, fileRows] = await Promise.all([
        db.execute<{
          id: string
          name: string
          icon_key: string | null
          deleted_at: string
          folder_count: number
          file_count: number
        }>(sql`
          SELECT
            d.id,
            d.name,
            d.icon_key,
            d.deleted_at,
            COALESCE((SELECT COUNT(*)::int FROM folders WHERE dataroom_id = d.id AND delete_batch_id = d.delete_batch_id), 0) AS folder_count,
            COALESCE((
              SELECT COUNT(*)::int FROM files f
              INNER JOIN folders fo ON fo.id = f.folder_id
              WHERE fo.dataroom_id = d.id AND f.delete_batch_id = d.delete_batch_id
            ), 0) AS file_count
          FROM datarooms d
          WHERE d.owner_id = ${owner}
            AND d.deleted_at IS NOT NULL
            AND d.delete_root = true
          ORDER BY d.deleted_at DESC
        `),
        db.execute<{
          id: string
          name: string
          dataroom_id: string
          dataroom_name: string
          deleted_at: string
          folder_count: number
          file_count: number
        }>(sql`
          SELECT
            fo.id,
            fo.name,
            fo.dataroom_id,
            d.name AS dataroom_name,
            fo.deleted_at,
            COALESCE((SELECT COUNT(*)::int FROM folders WHERE delete_batch_id = fo.delete_batch_id AND id != fo.id), 0) AS folder_count,
            COALESCE((SELECT COUNT(*)::int FROM files WHERE delete_batch_id = fo.delete_batch_id), 0) AS file_count
          FROM folders fo
          INNER JOIN datarooms d ON d.id = fo.dataroom_id
          WHERE d.owner_id = ${owner}
            AND fo.deleted_at IS NOT NULL
            AND fo.delete_root = true
          ORDER BY fo.deleted_at DESC
        `),
        db.execute<{
          id: string
          name: string
          folder_id: string
          dataroom_id: string
          dataroom_name: string
          folder_name: string
          size_bytes: string
          deleted_at: string
        }>(sql`
          SELECT
            fi.id,
            fi.name,
            fi.folder_id,
            fo.dataroom_id,
            d.name AS dataroom_name,
            fo.name AS folder_name,
            fi.size_bytes::text AS size_bytes,
            fi.deleted_at
          FROM files fi
          INNER JOIN folders fo ON fo.id = fi.folder_id
          INNER JOIN datarooms d ON d.id = fo.dataroom_id
          WHERE d.owner_id = ${owner}
            AND fi.deleted_at IS NOT NULL
            AND fi.delete_root = true
          ORDER BY fi.deleted_at DESC
        `),
      ])

      const items = [
        ...dataroomRows.map((r) => ({
          kind: 'dataroom' as const,
          id: r.id,
          name: r.name,
          iconKey: r.icon_key,
          deletedAt: new Date(r.deleted_at).toISOString(),
          folderCount: Number(r.folder_count),
          fileCount: Number(r.file_count),
        })),
        ...folderRows.map((r) => ({
          kind: 'folder' as const,
          id: r.id,
          name: r.name,
          dataroomId: r.dataroom_id,
          dataroomName: r.dataroom_name,
          deletedAt: new Date(r.deleted_at).toISOString(),
          folderCount: Number(r.folder_count),
          fileCount: Number(r.file_count),
        })),
        ...fileRows.map((r) => ({
          kind: 'file' as const,
          id: r.id,
          name: r.name,
          folderId: r.folder_id,
          dataroomId: r.dataroom_id,
          dataroomName: r.dataroom_name,
          folderName: r.folder_name,
          sizeBytes: Number(r.size_bytes),
          deletedAt: new Date(r.deleted_at).toISOString(),
        })),
      ].sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1))

      return { items }
    },
  )

  server.delete(
    '/trash/:kind/:id',
    {
      schema: {
        params: trashParams,
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (req) => {
      const { kind, id } = req.params
      const owner = req.auth.userId

      if (kind === 'file') {
        const row = await db.query.files.findFirst({
          where: eq(files.id, id),
          with: { folder: { with: { dataroom: true } } },
        })
        if (!row || row.folder.dataroom.ownerId !== owner || !row.deletedAt) {
          throw new DataroomApiError('NOT_FOUND', 'File not found in trash', 404)
        }
        await bestEffortDeleteObjects([row.s3Key], req.log)
        await db.delete(files).where(eq(files.id, id))
        return { ok: true as const }
      }

      if (kind === 'folder') {
        const row = await db.query.folders.findFirst({
          where: eq(folders.id, id),
          with: { dataroom: true },
        })
        if (!row || row.dataroom.ownerId !== owner || !row.deletedAt) {
          throw new DataroomApiError('NOT_FOUND', 'Folder not found in trash', 404)
        }
        const keys = await collectS3KeysForFolder(id)
        await bestEffortDeleteObjects(keys, req.log)
        await db.delete(folders).where(eq(folders.id, id))
        return { ok: true as const }
      }

      // kind === 'dataroom'
      const row = await db.query.datarooms.findFirst({
        where: and(
          eq(datarooms.id, id),
          eq(datarooms.ownerId, owner),
          isNotNull(datarooms.deletedAt),
        ),
      })
      if (!row) throw new DataroomApiError('NOT_FOUND', 'Dataroom not found in trash', 404)
      const keys = await collectS3KeysForDataroom(id)
      await bestEffortDeleteObjects(keys, req.log)
      await db.delete(datarooms).where(eq(datarooms.id, id))
      return { ok: true as const }
    },
  )
}
