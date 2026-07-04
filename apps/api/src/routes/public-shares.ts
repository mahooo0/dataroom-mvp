import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { DataroomApiError, publicFileResponse } from '@dataroom/shared'
import { and, eq, gt, isNull } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { db } from '@/db/client'
import { datarooms, fileShares, files, folders } from '@/db/schema'
import { BUCKET, s3ForPresign } from '@/services/storage.service'

const tokenParams = z.object({ token: z.string().min(16).max(64) })

const DOWNLOAD_URL_TTL_SECONDS = 60 * 5

/**
 * Anonymous read route for a single shared file. NOTE: this router intentionally
 * does NOT install the Clerk requireAuth hook — anyone with a valid non-revoked
 * token gets a presigned download URL to view/download the PDF.
 */
export async function publicSharesRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get(
    '/public/share/:token',
    {
      config: {
        rateLimit: { max: 60, timeWindow: '1 minute' },
      },
      schema: {
        params: tokenParams,
        response: { 200: publicFileResponse },
      },
    },
    async (req, reply) => {
      reply.header('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
      const now = new Date()
      const share = await db.query.fileShares.findFirst({
        where: and(
          eq(fileShares.token, req.params.token),
          isNull(fileShares.revokedAt),
          gt(fileShares.expiresAt, now),
        ),
      })
      if (!share) throw new DataroomApiError('NOT_FOUND', 'Share not found or expired', 404)

      const [row] = await db
        .select({
          id: files.id,
          name: files.name,
          sizeBytes: files.sizeBytes,
          s3Key: files.s3Key,
          updatedAt: files.updatedAt,
        })
        .from(files)
        .innerJoin(folders, eq(folders.id, files.folderId))
        .innerJoin(datarooms, eq(datarooms.id, folders.dataroomId))
        .where(
          and(
            eq(files.id, share.fileId),
            eq(files.status, 'ready'),
            isNull(files.deletedAt),
            isNull(folders.deletedAt),
            isNull(datarooms.deletedAt),
          ),
        )
        .limit(1)

      if (!row) throw new DataroomApiError('NOT_FOUND', 'File no longer available', 404)

      // Force response to be treated as PDF regardless of what the browser thinks.
      // Combined with `%PDF-` magic-check at upload complete, this is defense-in-depth
      // against a caller trying to serve mislabeled content from a shared link.
      const downloadUrl = await getSignedUrl(
        s3ForPresign,
        new GetObjectCommand({
          Bucket: BUCKET,
          Key: row.s3Key,
          ResponseContentType: 'application/pdf',
          ResponseContentDisposition: `inline; filename="${encodeURIComponent(row.name)}"`,
        }),
        { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
      )

      return {
        file: {
          id: row.id,
          name: row.name,
          sizeBytes: row.sizeBytes,
          updatedAt: row.updatedAt.toISOString(),
        },
        downloadUrl,
        expiresIn: DOWNLOAD_URL_TTL_SECONDS,
        allowDownload: share.allowDownload,
        expiresAt: share.expiresAt.toISOString(),
      }
    },
  )
}
