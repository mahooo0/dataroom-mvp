import {
  createFolderInput,
  DataroomApiError,
  folderChildrenResponse,
  folderSchema,
  moveFolderInput,
  renameFolderInput,
} from '@dataroom/shared'
import { and, eq, inArray, isNull } from 'drizzle-orm'
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

type FolderRow = typeof folders.$inferSelect
interface FolderWithCounts extends FolderRow {
  childFolderCount?: number
  fileCount?: number
}

function serializeFolder(row: FolderWithCounts) {
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
      const descendantIds = await collectDescendantFolderIds(req.params.id)

      await db.transaction(async (tx) => {
        await tx
          .update(folders)
          .set({ deletedAt: now, updatedAt: now })
          .where(and(inArray(folders.id, descendantIds), isNull(folders.deletedAt)))
        await tx
          .update(files)
          .set({ deletedAt: now, updatedAt: now })
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

      const stamp = row.deletedAt
      await db.transaction(async (tx) => {
        await tx
          .update(folders)
          .set({ deletedAt: null, updatedAt: new Date() })
          .where(and(eq(folders.dataroomId, row.dataroomId), eq(folders.deletedAt, stamp)))
        await tx
          .update(files)
          .set({ deletedAt: null, updatedAt: new Date() })
          .where(eq(files.deletedAt, stamp))
      })

      const [updated] = await db.select().from(folders).where(eq(folders.id, req.params.id))
      if (!updated) throw new DataroomApiError('NOT_FOUND', 'Folder not found', 404)
      return serializeFolder(updated)
    },
  )
}
