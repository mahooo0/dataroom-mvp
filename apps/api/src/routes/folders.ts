import { randomUUID } from 'node:crypto'
import {
  createFolderInput,
  DataroomApiError,
  folderChildrenResponse,
  folderSchema,
  moveFolderInput,
  renameFolderInput,
} from '@dataroom/shared'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { db } from '@/db/client'
import {
  collectDescendantFolderIds,
  isFolderDescendantOf,
  listDataroomFoldersWithCounts,
} from '@/db/queries'
import { files, folders } from '@/db/schema'
import { assertDataroomAccess, assertFolderAccess } from '@/lib/ownership'
import { mapUniqueViolation } from '@/lib/pg-errors'

const dataroomParams = z.object({ dataroomId: z.string().uuid() })
const folderParams = z.object({ id: z.string().uuid() })

interface FolderShapeForSerialize {
  id: string
  dataroomId: string
  parentId: string | null
  name: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  childFolderCount?: number
  fileCount?: number
}

function serializeFolder(row: FolderShapeForSerialize) {
  return {
    id: row.id,
    dataroomId: row.dataroomId,
    parentId: row.parentId,
    name: row.name,
    childFolderCount: row.childFolderCount,
    fileCount: row.fileCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  }
}

export async function foldersRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.addHook('preHandler', (req) => app.requireAuth(req))

  server.get(
    '/datarooms/:dataroomId/folders',
    {
      schema: {
        params: dataroomParams,
        response: { 200: folderChildrenResponse },
      },
    },
    async (req) => {
      await assertDataroomAccess(req.params.dataroomId, req.auth.userId)
      const rows = await listDataroomFoldersWithCounts(req.params.dataroomId)
      return { folders: rows.map(serializeFolder) }
    },
  )

  server.post(
    '/folders',
    {
      schema: {
        body: createFolderInput,
        response: { 201: folderSchema },
      },
    },
    async (req, reply) => {
      await assertDataroomAccess(req.body.dataroomId, req.auth.userId)
      if (req.body.parentId) {
        const parent = await assertFolderAccess(req.body.parentId, req.auth.userId)
        if (parent.dataroomId !== req.body.dataroomId) {
          throw new DataroomApiError('VALIDATION_FAILED', 'Parent belongs to another dataroom', 400)
        }
      }
      try {
        const [row] = await db
          .insert(folders)
          .values({
            dataroomId: req.body.dataroomId,
            parentId: req.body.parentId,
            name: req.body.name,
          })
          .returning()
        if (!row) throw new DataroomApiError('INTERNAL_ERROR', 'Insert returned no row', 500)
        reply.code(201)
        return serializeFolder({ ...row, childFolderCount: 0, fileCount: 0 })
      } catch (err) {
        mapUniqueViolation(err, 'FOLDER_NAME_TAKEN', 'A folder with that name already exists here')
      }
    },
  )

  server.patch(
    '/folders/:id',
    {
      schema: {
        params: folderParams,
        body: renameFolderInput,
        response: { 200: folderSchema },
      },
    },
    async (req) => {
      await assertFolderAccess(req.params.id, req.auth.userId)
      try {
        const [row] = await db
          .update(folders)
          .set({ name: req.body.name, updatedAt: new Date() })
          .where(eq(folders.id, req.params.id))
          .returning()
        if (!row) throw new DataroomApiError('NOT_FOUND', 'Folder not found', 404)
        return serializeFolder(row)
      } catch (err) {
        if (err instanceof DataroomApiError) throw err
        mapUniqueViolation(err, 'FOLDER_NAME_TAKEN', 'A folder with that name already exists here')
      }
    },
  )

  server.patch(
    '/folders/:id/move',
    {
      schema: {
        params: folderParams,
        body: moveFolderInput,
        response: { 200: folderSchema },
      },
    },
    async (req) => {
      const folder = await assertFolderAccess(req.params.id, req.auth.userId)
      if (req.body.parentId) {
        const newParent = await assertFolderAccess(req.body.parentId, req.auth.userId)
        if (newParent.dataroomId !== folder.dataroomId) {
          throw new DataroomApiError('VALIDATION_FAILED', 'Cannot move across datarooms', 400)
        }
        if (await isFolderDescendantOf(req.body.parentId, req.params.id)) {
          throw new DataroomApiError(
            'VALIDATION_FAILED',
            'Cannot move a folder into its own descendant',
            400,
          )
        }
      }
      try {
        const [row] = await db
          .update(folders)
          .set({ parentId: req.body.parentId, updatedAt: new Date() })
          .where(eq(folders.id, req.params.id))
          .returning()
        if (!row) throw new DataroomApiError('NOT_FOUND', 'Folder not found', 404)
        return serializeFolder(row)
      } catch (err) {
        if (err instanceof DataroomApiError) throw err
        mapUniqueViolation(err, 'FOLDER_NAME_TAKEN', 'A folder with that name already exists here')
      }
    },
  )

  server.get(
    '/folders/:id/descendant-counts',
    {
      schema: {
        params: folderParams,
        response: {
          200: z.object({ folderCount: z.number().int(), fileCount: z.number().int() }),
        },
      },
    },
    async (req) => {
      await assertFolderAccess(req.params.id, req.auth.userId)
      const rows = await db.execute<{ folder_count: number; file_count: number }>(sql`
        WITH RECURSIVE descendants AS (
          SELECT id FROM folders WHERE id = ${req.params.id} AND deleted_at IS NULL
          UNION ALL
          SELECT f.id FROM folders f
          INNER JOIN descendants d ON f.parent_id = d.id
          WHERE f.deleted_at IS NULL
        )
        SELECT
          ((SELECT COUNT(*) FROM descendants) - 1)::int AS folder_count,
          (SELECT COUNT(*) FROM files WHERE folder_id IN (SELECT id FROM descendants) AND deleted_at IS NULL AND status = 'ready')::int AS file_count
      `)
      const r = rows[0]
      return {
        folderCount: Math.max(0, r?.folder_count ?? 0),
        fileCount: r?.file_count ?? 0,
      }
    },
  )

  server.delete(
    '/folders/:id',
    {
      schema: {
        params: folderParams,
        response: { 200: folderSchema },
      },
    },
    async (req) => {
      await assertFolderAccess(req.params.id, req.auth.userId)
      const now = new Date()
      const batchId = randomUUID()
      const descendantIds = await collectDescendantFolderIds(req.params.id)
      const descendantOnly = descendantIds.filter((id) => id !== req.params.id)

      await db.transaction(async (tx) => {
        await tx
          .update(folders)
          .set({
            deletedAt: now,
            updatedAt: now,
            deleteBatchId: batchId,
            deleteRoot: true,
          })
          .where(and(eq(folders.id, req.params.id), isNull(folders.deletedAt)))
        if (descendantOnly.length > 0) {
          await tx
            .update(folders)
            .set({
              deletedAt: now,
              updatedAt: now,
              deleteBatchId: batchId,
              deleteRoot: false,
            })
            .where(and(inArray(folders.id, descendantOnly), isNull(folders.deletedAt)))
        }
        await tx
          .update(files)
          .set({
            deletedAt: now,
            updatedAt: now,
            deleteBatchId: batchId,
            deleteRoot: false,
          })
          .where(and(inArray(files.folderId, descendantIds), isNull(files.deletedAt)))
      })

      const [row] = await db.select().from(folders).where(eq(folders.id, req.params.id))
      if (!row) throw new DataroomApiError('NOT_FOUND', 'Folder not found', 404)
      return serializeFolder(row)
    },
  )

  server.post(
    '/folders/:id/restore',
    {
      schema: {
        params: folderParams,
        response: { 200: folderSchema },
      },
    },
    async (req) => {
      const row = await db.query.folders.findFirst({
        where: eq(folders.id, req.params.id),
        with: { dataroom: true },
      })
      if (!row || row.dataroom.ownerId !== req.auth.userId) {
        throw new DataroomApiError('NOT_FOUND', 'Folder not found', 404)
      }
      if (!row.deletedAt) return serializeFolder(row)

      const now = new Date()
      const batchId = row.deleteBatchId

      await db.transaction(async (tx) => {
        if (batchId) {
          await tx
            .update(folders)
            .set({
              deletedAt: null,
              deleteBatchId: null,
              deleteRoot: false,
              updatedAt: now,
            })
            .where(eq(folders.deleteBatchId, batchId))
          await tx
            .update(files)
            .set({
              deletedAt: null,
              deleteBatchId: null,
              deleteRoot: false,
              updatedAt: now,
            })
            .where(eq(files.deleteBatchId, batchId))
        } else {
          await tx
            .update(folders)
            .set({
              deletedAt: null,
              deleteBatchId: null,
              deleteRoot: false,
              updatedAt: now,
            })
            .where(eq(folders.id, req.params.id))
        }
      })

      const [updated] = await db.select().from(folders).where(eq(folders.id, req.params.id))
      if (!updated) throw new DataroomApiError('NOT_FOUND', 'Folder not found', 404)
      return serializeFolder(updated)
    },
  )
}
