import {
  createDataroomInput,
  DataroomApiError,
  dataroomListResponse,
  dataroomSchema,
  renameDataroomInput,
} from '@dataroom/shared'
import { and, desc, eq, isNull } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { db } from '@/db/client'
import { datarooms } from '@/db/schema'
import { assertDataroomAccess } from '@/lib/ownership'
import { mapUniqueViolation } from '@/lib/pg-errors'

const paramsSchema = z.object({ id: z.string().uuid() })

function serializeDataroom(row: typeof datarooms.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.ownerId,
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
          .values({ name: req.body.name, ownerId: req.auth.userId })
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
      try {
        const [row] = await db
          .update(datarooms)
          .set({ name: req.body.name, updatedAt: new Date() })
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
      const [row] = await db
        .update(datarooms)
        .set({ deletedAt: now, updatedAt: now })
        .where(eq(datarooms.id, req.params.id))
        .returning()
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
      const [updated] = await db
        .update(datarooms)
        .set({ deletedAt: null, updatedAt: new Date() })
        .where(eq(datarooms.id, req.params.id))
        .returning()
      if (!updated) throw new DataroomApiError('NOT_FOUND', 'Dataroom not found', 404)
      return serializeDataroom(updated)
    },
  )
}
