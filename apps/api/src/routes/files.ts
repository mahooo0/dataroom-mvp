import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import {
  ACCEPTED_MIME,
  DataroomApiError,
  downloadUrlResponse,
  fileSchema,
  MAX_FILE_SIZE_BYTES,
  moveFileInput,
  renameFileInput,
  uploadCompleteResponse,
  uploadInitInput,
  uploadInitResponse,
} from '@dataroom/shared'
import { and, desc, eq, isNull } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { db } from '@/db/client'
import { files } from '@/db/schema'
import { assertFileAccess, assertFolderAccess } from '@/lib/ownership'
import { mapUniqueViolation } from '@/lib/pg-errors'
import { BUCKET, s3ForPresign, s3ForServerOps } from '@/services/storage.service'

const folderParams = z.object({ folderId: z.string().uuid() })
const fileParams = z.object({ id: z.string().uuid() })

const UPLOAD_URL_TTL_SECONDS = 15 * 60
const DOWNLOAD_URL_TTL_SECONDS = 60 * 60

type FileRow = typeof files.$inferSelect

function serializeFile(row: FileRow) {
  return {
    id: row.id,
    folderId: row.folderId,
    name: row.name,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    s3Key: row.s3Key,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  }
}

function makeS3Key(ownerId: string, dataroomId: string, fileId: string) {
  return `${ownerId}/${dataroomId}/${fileId}.pdf`
}

export async function filesRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.addHook('preHandler', (req) => app.requireAuth(req))

  server.get(
    '/folders/:folderId/files',
    {
      schema: {
        params: folderParams,
        response: {
          200: z.object({ files: z.array(fileSchema) }),
        },
      },
    },
    async (req) => {
      await assertFolderAccess(req.params.folderId, req.auth.userId)
      const rows = await db
        .select()
        .from(files)
        .where(
          and(
            eq(files.folderId, req.params.folderId),
            isNull(files.deletedAt),
            eq(files.status, 'ready'),
          ),
        )
        .orderBy(desc(files.updatedAt))
      return { files: rows.map(serializeFile) }
    },
  )

  server.post(
    '/files/init',
    {
      schema: {
        body: uploadInitInput,
        response: { 200: uploadInitResponse },
      },
    },
    async (req) => {
      if (req.body.mimeType !== ACCEPTED_MIME) {
        throw new DataroomApiError('INVALID_MIME_TYPE', 'Only PDF files are supported', 400)
      }
      if (req.body.sizeBytes > MAX_FILE_SIZE_BYTES) {
        throw new DataroomApiError('FILE_TOO_LARGE', 'File exceeds 50 MB limit', 400)
      }

      const folder = await assertFolderAccess(req.body.folderId, req.auth.userId)

      let row: FileRow | undefined
      try {
        const inserted = await db
          .insert(files)
          .values({
            folderId: req.body.folderId,
            name: req.body.name,
            mimeType: req.body.mimeType,
            sizeBytes: req.body.sizeBytes,
            s3Key: 'pending',
            status: 'pending',
          })
          .returning()
        row = inserted[0]
      } catch (err) {
        mapUniqueViolation(err, 'FILE_NAME_TAKEN', 'A file with that name already exists')
      }
      if (!row) throw new DataroomApiError('INTERNAL_ERROR', 'Insert returned no row', 500)

      const s3Key = makeS3Key(req.auth.userId, folder.dataroomId, row.id)
      const [updated] = await db
        .update(files)
        .set({ s3Key })
        .where(eq(files.id, row.id))
        .returning()
      if (!updated) throw new DataroomApiError('NOT_FOUND', 'File vanished mid-init', 500)

      const uploadUrl = await getSignedUrl(
        s3ForPresign,
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: s3Key,
          ContentType: ACCEPTED_MIME,
          ContentLength: req.body.sizeBytes,
        }),
        { expiresIn: UPLOAD_URL_TTL_SECONDS },
      )

      return {
        fileId: updated.id,
        uploadUrl,
        s3Key,
        expiresIn: UPLOAD_URL_TTL_SECONDS,
      }
    },
  )

  server.post(
    '/files/:id/complete',
    {
      schema: {
        params: fileParams,
        response: { 200: uploadCompleteResponse },
      },
    },
    async (req) => {
      const file = await db.query.files.findFirst({
        where: eq(files.id, req.params.id),
        with: { folder: { with: { dataroom: true } } },
      })
      if (!file || file.folder.dataroom.ownerId !== req.auth.userId) {
        throw new DataroomApiError('NOT_FOUND', 'File not found', 404)
      }
      if (file.status === 'ready') {
        return { file: serializeFile(file) }
      }

      try {
        await s3ForServerOps.send(new HeadObjectCommand({ Bucket: BUCKET, Key: file.s3Key }))
      } catch {
        throw new DataroomApiError(
          'UPLOAD_INCOMPLETE',
          'Upload was not completed. Please retry.',
          400,
        )
      }

      try {
        const [updated] = await db
          .update(files)
          .set({ status: 'ready', updatedAt: new Date() })
          .where(eq(files.id, req.params.id))
          .returning()
        if (!updated) throw new DataroomApiError('NOT_FOUND', 'File not found', 404)
        return { file: serializeFile(updated) }
      } catch (err) {
        if (err instanceof DataroomApiError) throw err
        mapUniqueViolation(err, 'FILE_NAME_TAKEN', 'A file with that name already exists')
      }
    },
  )

  server.get(
    '/files/:id/download-url',
    {
      schema: {
        params: fileParams,
        response: { 200: downloadUrlResponse },
      },
    },
    async (req) => {
      const file = await assertFileAccess(req.params.id, req.auth.userId)
      const url = await getSignedUrl(
        s3ForPresign,
        new GetObjectCommand({
          Bucket: BUCKET,
          Key: file.s3Key,
          ResponseContentDisposition: `inline; filename="${encodeURIComponent(file.name)}"`,
        }),
        { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
      )
      return { url, expiresIn: DOWNLOAD_URL_TTL_SECONDS }
    },
  )

  server.patch(
    '/files/:id',
    {
      schema: {
        params: fileParams,
        body: renameFileInput,
        response: { 200: fileSchema },
      },
    },
    async (req) => {
      await assertFileAccess(req.params.id, req.auth.userId)
      try {
        const [row] = await db
          .update(files)
          .set({ name: req.body.name, updatedAt: new Date() })
          .where(eq(files.id, req.params.id))
          .returning()
        if (!row) throw new DataroomApiError('NOT_FOUND', 'File not found', 404)
        return serializeFile(row)
      } catch (err) {
        if (err instanceof DataroomApiError) throw err
        mapUniqueViolation(err, 'FILE_NAME_TAKEN', 'A file with that name already exists')
      }
    },
  )

  server.patch(
    '/files/:id/move',
    {
      schema: {
        params: fileParams,
        body: moveFileInput,
        response: { 200: fileSchema },
      },
    },
    async (req) => {
      const file = await assertFileAccess(req.params.id, req.auth.userId)
      const targetFolder = await assertFolderAccess(req.body.folderId, req.auth.userId)
      if (targetFolder.dataroomId !== file.folder.dataroomId) {
        throw new DataroomApiError('VALIDATION_FAILED', 'Cannot move across datarooms', 400)
      }
      try {
        const [row] = await db
          .update(files)
          .set({ folderId: req.body.folderId, updatedAt: new Date() })
          .where(eq(files.id, req.params.id))
          .returning()
        if (!row) throw new DataroomApiError('NOT_FOUND', 'File not found', 404)
        return serializeFile(row)
      } catch (err) {
        if (err instanceof DataroomApiError) throw err
        mapUniqueViolation(err, 'FILE_NAME_TAKEN', 'A file with that name already exists')
      }
    },
  )

  server.delete(
    '/files/:id',
    {
      schema: {
        params: fileParams,
        response: { 200: fileSchema },
      },
    },
    async (req) => {
      const file = await assertFileAccess(req.params.id, req.auth.userId)
      const now = new Date()

      if (file.status === 'pending') {
        try {
          await s3ForServerOps.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: file.s3Key }))
        } catch (err) {
          req.log.warn({ err, fileId: file.id }, 'Failed to remove pending upload object')
        }
        await db.delete(files).where(eq(files.id, req.params.id))
        return serializeFile({ ...file, deletedAt: now })
      }

      const [row] = await db
        .update(files)
        .set({ deletedAt: now, updatedAt: now })
        .where(eq(files.id, req.params.id))
        .returning()
      if (!row) throw new DataroomApiError('NOT_FOUND', 'File not found', 404)
      return serializeFile(row)
    },
  )

  server.post(
    '/files/:id/restore',
    {
      schema: {
        params: fileParams,
        response: { 200: fileSchema },
      },
    },
    async (req) => {
      const file = await db.query.files.findFirst({
        where: eq(files.id, req.params.id),
        with: { folder: { with: { dataroom: true } } },
      })
      if (!file || file.folder.dataroom.ownerId !== req.auth.userId) {
        throw new DataroomApiError('NOT_FOUND', 'File not found', 404)
      }
      if (!file.deletedAt) return { ...serializeFile(file) }
      const [row] = await db
        .update(files)
        .set({ deletedAt: null, updatedAt: new Date() })
        .where(eq(files.id, req.params.id))
        .returning()
      if (!row) throw new DataroomApiError('NOT_FOUND', 'File not found', 404)
      return serializeFile(row)
    },
  )
}
