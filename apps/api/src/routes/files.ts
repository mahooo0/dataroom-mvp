import { createHash, randomUUID } from 'node:crypto'
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
  fileListResponse,
  fileSchema,
  MAX_FILE_SIZE_BYTES,
  moveFileInput,
  renameFileInput,
  uploadCompleteResponse,
  uploadInitInput,
  uploadInitResponse,
} from '@dataroom/shared'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { env } from '@/config/env'
import { db } from '@/db/client'
import { files } from '@/db/schema'
import { assertFileAccess, assertFolderAccess } from '@/lib/ownership'
import { mapUniqueViolation } from '@/lib/pg-errors'
import { BUCKET, s3ForPresign, s3ForServerOps } from '@/services/storage.service'

const folderParams = z.object({ folderId: z.string().uuid() })
const fileParams = z.object({ id: z.string().uuid() })

const UPLOAD_URL_TTL_SECONDS = 15 * 60
const DOWNLOAD_URL_TTL_SECONDS = 60 * 60
const PENDING_SWEEP_MAX_AGE_MS = 60 * 60 * 1000
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]) // %PDF-

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

/**
 * s3Key layout: `{ownerHash}/{dataroomId}/{fileId}.pdf`. The owner segment is
 * a 12-char SHA-256 prefix of the Clerk userId — enough for tenant isolation
 * inside the bucket without leaking the raw Clerk ID via public-share URLs.
 */
function makeS3Key(ownerId: string, dataroomId: string, fileId: string) {
  const ownerHash = createHash('sha256').update(ownerId).digest('hex').slice(0, 12)
  return `${ownerHash}/${dataroomId}/${fileId}.pdf`
}

/**
 * Verify the first 5 bytes match `%PDF-`. SigV4 does NOT bind the request body,
 * so a client can PUT anything to a presigned upload URL — HTML, JS, a rebranded
 * ZIP. Without this check a shared "PDF" could serve stored-XSS. Cheap ranged GET.
 */
async function verifyPdfMagic(s3Key: string): Promise<boolean> {
  try {
    const res = await s3ForServerOps.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: s3Key, Range: 'bytes=0-4' }),
    )
    const body = res.Body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined
    const bytes = body?.transformToByteArray ? await body.transformToByteArray() : new Uint8Array()
    if (bytes.length < 5) return false
    return Buffer.from(bytes).slice(0, 5).equals(PDF_MAGIC)
  } catch {
    return false
  }
}

/**
 * Opportunistic garbage collection of abandoned uploads. Runs inside the quota
 * transaction so it never races an in-flight init. Prevents pending rows from
 * silently eating the user's quota when a browser tab dies mid-upload.
 */
async function sweepAbandonedPending(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ownerId: string,
  logger: import('fastify').FastifyBaseLogger,
) {
  const cutoff = new Date(Date.now() - PENDING_SWEEP_MAX_AGE_MS)
  const stale = await tx.execute<{ id: string; s3_key: string }>(sql`
    SELECT f.id, f.s3_key
    FROM files f
    INNER JOIN folders fo ON fo.id = f.folder_id
    INNER JOIN datarooms d ON d.id = fo.dataroom_id
    WHERE d.owner_id = ${ownerId}
      AND f.status = 'pending'
      AND f.created_at < ${cutoff}
  `)
  const rows = Array.isArray(stale) ? stale : ((stale as unknown as { rows: unknown[] }).rows ?? [])
  if (rows.length === 0) return
  const ids: string[] = []
  const keys: string[] = []
  for (const r of rows as Array<{ id: string; s3_key: string }>) {
    ids.push(r.id)
    keys.push(r.s3_key)
  }
  await tx.delete(files).where(and(inArray(files.id, ids), eq(files.status, 'pending')))
  // Fire-and-forget S3 cleanup after the tx commits — orphan objects are
  // acceptable; blocking the init call is not.
  setImmediate(async () => {
    for (const Key of keys) {
      try {
        await s3ForServerOps.send(new DeleteObjectCommand({ Bucket: BUCKET, Key }))
      } catch (err) {
        logger.warn({ err, key: Key }, 'sweep: failed to delete abandoned S3 object')
      }
    }
  })
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
          200: fileListResponse,
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
        .limit(1000)
      return { files: rows.map(serializeFile) }
    },
  )

  server.post(
    '/files/init',
    {
      config: {
        rateLimit: { max: 60, timeWindow: '1 minute' },
      },
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

      const fileId = randomUUID()
      const s3Key = makeS3Key(req.auth.userId, folder.dataroomId, fileId)

      let row: FileRow | undefined
      try {
        row = await db.transaction(async (tx) => {
          // Serialize concurrent init calls per owner so the quota check
          // cannot race itself. Lock is released at commit/rollback.
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${req.auth.userId}))`)

          // Reclaim quota from tabs that init'd but never completed.
          await sweepAbandonedPending(tx, req.auth.userId, req.log)

          const [usage] = await tx.execute<{ used: string | number | null }>(sql`
            SELECT COALESCE(SUM(f.size_bytes), 0)::bigint AS used
            FROM files f
            INNER JOIN folders fo ON fo.id = f.folder_id
            INNER JOIN datarooms d ON d.id = fo.dataroom_id
            WHERE d.owner_id = ${req.auth.userId}
              AND d.deleted_at IS NULL
              AND fo.deleted_at IS NULL
              AND f.deleted_at IS NULL
              AND f.status IN ('ready', 'pending')
          `)
          const usedBytes = Number(usage?.used ?? 0)
          if (usedBytes + req.body.sizeBytes > env.USER_QUOTA_BYTES) {
            throw new DataroomApiError(
              'QUOTA_EXCEEDED',
              'Storage limit reached. Delete files or upgrade to add more.',
              413,
              { usedBytes, quotaBytes: env.USER_QUOTA_BYTES, attemptedBytes: req.body.sizeBytes },
            )
          }

          const [inserted] = await tx
            .insert(files)
            .values({
              id: fileId,
              folderId: req.body.folderId,
              name: req.body.name,
              mimeType: req.body.mimeType,
              sizeBytes: req.body.sizeBytes,
              s3Key,
              status: 'pending',
            })
            .returning()
          return inserted
        })
      } catch (err) {
        if (err instanceof DataroomApiError) throw err
        mapUniqueViolation(err, 'FILE_NAME_TAKEN', 'A file with that name already exists')
      }
      if (!row) throw new DataroomApiError('INTERNAL_ERROR', 'Insert returned no row', 500)

      const uploadUrl = await getSignedUrl(
        s3ForPresign,
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: s3Key,
          ContentType: ACCEPTED_MIME,
        }),
        { expiresIn: UPLOAD_URL_TTL_SECONDS },
      )

      return {
        fileId: row.id,
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

      let head: { ContentLength?: number }
      try {
        head = await s3ForServerOps.send(new HeadObjectCommand({ Bucket: BUCKET, Key: file.s3Key }))
      } catch {
        throw new DataroomApiError(
          'UPLOAD_INCOMPLETE',
          'Upload was not completed. Please retry.',
          400,
        )
      }
      const actualSize = head.ContentLength ?? 0
      if (actualSize !== file.sizeBytes) {
        try {
          await s3ForServerOps.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: file.s3Key }))
        } catch (err) {
          req.log.warn({ err, fileId: file.id }, 'Failed to remove mismatched upload object')
        }
        await db.delete(files).where(eq(files.id, req.params.id))
        throw new DataroomApiError(
          'UPLOAD_INCOMPLETE',
          `Uploaded size (${actualSize}) does not match declared size (${file.sizeBytes}).`,
          400,
        )
      }

      // Content sniff — the presigned PUT does not bind the request body, so
      // the client could have uploaded any bytes. If it isn't actually a PDF,
      // wipe it before it ever gets exposed via a share link.
      if (!(await verifyPdfMagic(file.s3Key))) {
        try {
          await s3ForServerOps.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: file.s3Key }))
        } catch (err) {
          req.log.warn({ err, fileId: file.id }, 'Failed to remove non-PDF upload object')
        }
        await db.delete(files).where(eq(files.id, req.params.id))
        throw new DataroomApiError('INVALID_MIME_TYPE', 'Uploaded file is not a valid PDF.', 400)
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

      const batchId = randomUUID()
      const [row] = await db
        .update(files)
        .set({
          deletedAt: now,
          updatedAt: now,
          deleteBatchId: batchId,
          deleteRoot: true,
        })
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
        .set({
          deletedAt: null,
          deleteBatchId: null,
          deleteRoot: false,
          updatedAt: new Date(),
        })
        .where(eq(files.id, req.params.id))
        .returning()
      if (!row) throw new DataroomApiError('NOT_FOUND', 'File not found', 404)
      return serializeFile(row)
    },
  )
}
