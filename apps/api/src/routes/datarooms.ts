import { randomUUID } from 'node:crypto'
import {
  createDataroomInput,
  DATAROOM_ICON_KEYS,
  DataroomApiError,
  type DataroomIconKey,
  dataroomListResponse,
  dataroomSchema,
  renameDataroomInput,
} from '@dataroom/shared'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { db } from '@/db/client'
import { datarooms, files, folders } from '@/db/schema'
import { assertDataroomAccess } from '@/lib/ownership'
import { mapUniqueViolation } from '@/lib/pg-errors'

const paramsSchema = z.object({ id: z.string().uuid() })

const VALID_ICON_KEYS: ReadonlySet<string> = new Set(DATAROOM_ICON_KEYS)

function normalizeIconKey(raw: string | null): DataroomIconKey | null {
  return raw && VALID_ICON_KEYS.has(raw) ? (raw as DataroomIconKey) : null
}

function serializeDataroom(row: typeof datarooms.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.ownerId,
    iconKey: normalizeIconKey(row.iconKey),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  }
}

export async function dataroomsRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.addHook('preHandler', (req) => app.requireAuth(req))

  server.get(
    '/datarooms',
    {
      schema: { response: { 200: dataroomListResponse } },
    },
    async (req) => {
      const rows = await db
        .select()
        .from(datarooms)
        .where(and(eq(datarooms.ownerId, req.auth.userId), isNull(datarooms.deletedAt)))
        .orderBy(desc(datarooms.updatedAt))
      return { datarooms: rows.map(serializeDataroom) }
    },
  )

  server.post(
    '/datarooms',
    {
      schema: {
        body: createDataroomInput,
        response: { 201: dataroomSchema },
      },
    },
    async (req, reply) => {
      try {
        const [row] = await db
          .insert(datarooms)
          .values({
            name: req.body.name,
            ownerId: req.auth.userId,
            iconKey: req.body.iconKey ?? null,
          })
          .returning()
        if (!row) throw new DataroomApiError('INTERNAL_ERROR', 'Insert returned no row', 500)
        reply.code(201)
        return serializeDataroom(row)
      } catch (err) {
        mapUniqueViolation(err, 'DATAROOM_NAME_TAKEN', 'A dataroom with that name already exists')
      }
    },
  )

  server.patch(
    '/datarooms/:id',
    {
      schema: {
        params: paramsSchema,
        body: renameDataroomInput,
        response: { 200: dataroomSchema },
      },
    },
    async (req) => {
      await assertDataroomAccess(req.params.id, req.auth.userId)
      const patch: { name?: string; iconKey?: string | null; updatedAt: Date } = {
        updatedAt: new Date(),
      }
      if (req.body.name !== undefined) patch.name = req.body.name
      if (req.body.iconKey !== undefined) patch.iconKey = req.body.iconKey
      try {
        const [row] = await db
          .update(datarooms)
          .set(patch)
          .where(eq(datarooms.id, req.params.id))
          .returning()
        if (!row) throw new DataroomApiError('NOT_FOUND', 'Dataroom not found', 404)
        return serializeDataroom(row)
      } catch (err) {
        if (err instanceof DataroomApiError) throw err
        mapUniqueViolation(err, 'DATAROOM_NAME_TAKEN', 'A dataroom with that name already exists')
      }
    },
  )

  server.delete(
    '/datarooms/:id',
    {
      schema: {
        params: paramsSchema,
        response: { 200: dataroomSchema },
      },
    },
    async (req) => {
      await assertDataroomAccess(req.params.id, req.auth.userId)
      const now = new Date()
      const batchId = randomUUID()

      await db.transaction(async (tx) => {
        await tx
          .update(datarooms)
          .set({
            deletedAt: now,
            updatedAt: now,
            deleteBatchId: batchId,
            deleteRoot: true,
          })
          .where(eq(datarooms.id, req.params.id))
        await tx
          .update(folders)
          .set({
            deletedAt: now,
            updatedAt: now,
            deleteBatchId: batchId,
            deleteRoot: false,
          })
          .where(and(eq(folders.dataroomId, req.params.id), isNull(folders.deletedAt)))
        await tx.execute(sql`
          UPDATE files
          SET deleted_at = ${now},
              updated_at = ${now},
              delete_batch_id = ${batchId},
              delete_root = false
          WHERE deleted_at IS NULL
            AND folder_id IN (SELECT id FROM folders WHERE dataroom_id = ${req.params.id})
        `)
      })

      const [row] = await db.select().from(datarooms).where(eq(datarooms.id, req.params.id))
      if (!row) throw new DataroomApiError('NOT_FOUND', 'Dataroom not found', 404)
      return serializeDataroom(row)
    },
  )

  server.post(
    '/datarooms/:id/restore',
    {
      schema: {
        params: paramsSchema,
        response: { 200: dataroomSchema },
      },
    },
    async (req) => {
      const row = await db.query.datarooms.findFirst({
        where: and(eq(datarooms.id, req.params.id), eq(datarooms.ownerId, req.auth.userId)),
      })
      if (!row) throw new DataroomApiError('NOT_FOUND', 'Dataroom not found', 404)
      if (!row.deletedAt) return serializeDataroom(row)

      const now = new Date()
      const batchId = row.deleteBatchId

      await db.transaction(async (tx) => {
        await tx
          .update(datarooms)
          .set({
            deletedAt: null,
            deleteBatchId: null,
            deleteRoot: false,
            updatedAt: now,
          })
          .where(eq(datarooms.id, req.params.id))
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
        }
      })

      const [updated] = await db.select().from(datarooms).where(eq(datarooms.id, req.params.id))
      if (!updated) throw new DataroomApiError('NOT_FOUND', 'Dataroom not found', 404)
      return serializeDataroom(updated)
    },
  )
}
