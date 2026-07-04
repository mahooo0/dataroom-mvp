import { DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { DataroomApiError, trashItemKindSchema, trashListResponse } from '@dataroom/shared'
import { and, eq, isNotNull } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { db } from '@/db/client'
import {
  collectS3KeysForDataroom,
  collectS3KeysForFolder,
  listOwnerTrashDatarooms,
  listOwnerTrashFiles,
  listOwnerTrashFolders,
} from '@/db/queries'
import { datarooms, files, folders } from '@/db/schema'
import { BUCKET, s3ForServerOps } from '@/services/storage.service'

const trashParams = z.object({
  kind: trashItemKindSchema,
  id: z.string().uuid(),
})

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
        listOwnerTrashDatarooms(owner),
        listOwnerTrashFolders(owner),
        listOwnerTrashFiles(owner),
      ])

      const items = [
        ...dataroomRows.map((r) => ({
          kind: 'dataroom' as const,
          id: r.id,
          name: r.name,
          iconKey: r.iconKey,
          deletedAt: r.deletedAt,
          folderCount: r.folderCount,
          fileCount: r.fileCount,
        })),
        ...folderRows.map((r) => ({
          kind: 'folder' as const,
          id: r.id,
          name: r.name,
          dataroomId: r.dataroomId,
          dataroomName: r.dataroomName,
          deletedAt: r.deletedAt,
          folderCount: r.folderCount,
          fileCount: r.fileCount,
        })),
        ...fileRows.map((r) => ({
          kind: 'file' as const,
          id: r.id,
          name: r.name,
          folderId: r.folderId,
          dataroomId: r.dataroomId,
          dataroomName: r.dataroomName,
          folderName: r.folderName,
          sizeBytes: r.sizeBytes,
          deletedAt: r.deletedAt,
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
