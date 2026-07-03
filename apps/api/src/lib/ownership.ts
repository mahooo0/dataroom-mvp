import { DataroomApiError } from '@dataroom/shared'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/db/client'
import { datarooms, files, folders } from '@/db/schema'

export async function assertDataroomAccess(dataroomId: string, userId: string) {
  const row = await db.query.datarooms.findFirst({
    where: and(
      eq(datarooms.id, dataroomId),
      eq(datarooms.ownerId, userId),
      isNull(datarooms.deletedAt),
    ),
  })
  if (!row) throw new DataroomApiError('NOT_FOUND', 'Dataroom not found', 404)
  return row
}

export async function assertFolderAccess(folderId: string, userId: string) {
  const row = await db.query.folders.findFirst({
    where: and(eq(folders.id, folderId), isNull(folders.deletedAt)),
    with: { dataroom: true },
  })
  if (!row || row.dataroom.deletedAt || row.dataroom.ownerId !== userId) {
    throw new DataroomApiError('NOT_FOUND', 'Folder not found', 404)
  }
  return row
}

export async function assertFileAccess(fileId: string, userId: string) {
  const row = await db.query.files.findFirst({
    where: and(eq(files.id, fileId), isNull(files.deletedAt)),
    with: {
      folder: {
        with: { dataroom: true },
      },
    },
  })
  if (
    !row ||
    row.folder.deletedAt ||
    row.folder.dataroom.deletedAt ||
    row.folder.dataroom.ownerId !== userId
  ) {
    throw new DataroomApiError('NOT_FOUND', 'File not found', 404)
  }
  return row
}
