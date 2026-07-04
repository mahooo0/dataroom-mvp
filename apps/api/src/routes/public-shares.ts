import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import {
  DATAROOM_ICON_KEYS,
  DataroomApiError,
  type DataroomIconKey,
  publicDataroomResponse,
  publicDownloadUrlResponse,
} from '@dataroom/shared'
import { and, asc, eq, isNull } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { db } from '@/db/client'
import { dataroomShares, datarooms, files, folders } from '@/db/schema'
import { BUCKET, s3ForPresign } from '@/services/storage.service'

const tokenParams = z.object({ token: z.string().min(16).max(64) })
const tokenFileParams = z.object({
  token: z.string().min(16).max(64),
  fileId: z.string().uuid(),
})

const DOWNLOAD_URL_TTL_SECONDS = 60 * 5

const VALID_ICON_KEYS: ReadonlySet<string> = new Set(DATAROOM_ICON_KEYS)

function normalizeIconKey(raw: string | null): DataroomIconKey | null {
  return raw && VALID_ICON_KEYS.has(raw) ? (raw as DataroomIconKey) : null
}

async function resolveActiveShareDataroomId(token: string): Promise<string> {
  const share = await db.query.dataroomShares.findFirst({
    where: and(eq(dataroomShares.token, token), isNull(dataroomShares.revokedAt)),
  })
  if (!share) throw new DataroomApiError('NOT_FOUND', 'Share not found or revoked', 404)
  return share.dataroomId
}

/**
 * Anonymous read routes for shared datarooms. NOTE: this router intentionally
 * does NOT install the Clerk requireAuth hook — anyone with a valid non-revoked
 * token gets read-only access to the dataroom's live (non-deleted) tree.
 */
export async function publicSharesRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get(
    '/public/share/:token',
    {
      schema: {
        params: tokenParams,
        response: { 200: publicDataroomResponse },
      },
    },
    async (req) => {
      const dataroomId = await resolveActiveShareDataroomId(req.params.token)

      const dataroom = await db.query.datarooms.findFirst({
        where: and(eq(datarooms.id, dataroomId), isNull(datarooms.deletedAt)),
      })
      if (!dataroom) throw new DataroomApiError('NOT_FOUND', 'Dataroom no longer available', 404)

      const [folderRows, fileRows] = await Promise.all([
        db
          .select({
            id: folders.id,
            parentId: folders.parentId,
            name: folders.name,
          })
          .from(folders)
          .where(and(eq(folders.dataroomId, dataroomId), isNull(folders.deletedAt)))
          .orderBy(asc(folders.name)),
        db
          .select({
            id: files.id,
            folderId: files.folderId,
            name: files.name,
            sizeBytes: files.sizeBytes,
            updatedAt: files.updatedAt,
            folderDeletedAt: folders.deletedAt,
            folderDataroomId: folders.dataroomId,
          })
          .from(files)
          .innerJoin(folders, eq(folders.id, files.folderId))
          .where(
            and(
              eq(folders.dataroomId, dataroomId),
              isNull(files.deletedAt),
              isNull(folders.deletedAt),
              eq(files.status, 'ready'),
            ),
          )
          .orderBy(asc(files.name)),
      ])

      return {
        dataroom: {
          id: dataroom.id,
          name: dataroom.name,
          iconKey: normalizeIconKey(dataroom.iconKey),
        },
        folders: folderRows,
        files: fileRows.map((r) => ({
          id: r.id,
          folderId: r.folderId,
          name: r.name,
          sizeBytes: r.sizeBytes,
          updatedAt: r.updatedAt.toISOString(),
        })),
      }
    },
  )

  server.get(
    '/public/share/:token/files/:fileId/download-url',
    {
      schema: {
        params: tokenFileParams,
        response: { 200: publicDownloadUrlResponse },
      },
    },
    async (req) => {
      const dataroomId = await resolveActiveShareDataroomId(req.params.token)

      const [row] = await db
        .select({ s3Key: files.s3Key, name: files.name, dataroomId: folders.dataroomId })
        .from(files)
        .innerJoin(folders, eq(folders.id, files.folderId))
        .where(
          and(
            eq(files.id, req.params.fileId),
            isNull(files.deletedAt),
            isNull(folders.deletedAt),
            eq(files.status, 'ready'),
          ),
        )
        .limit(1)

      if (!row || row.dataroomId !== dataroomId) {
        throw new DataroomApiError('NOT_FOUND', 'File not available in this share', 404)
      }

      const url = await getSignedUrl(
        s3ForPresign,
        new GetObjectCommand({
          Bucket: BUCKET,
          Key: row.s3Key,
          ResponseContentDisposition: `inline; filename="${encodeURIComponent(row.name)}"`,
        }),
        { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
      )

      return { url, expiresIn: DOWNLOAD_URL_TTL_SECONDS }
    },
  )
}
