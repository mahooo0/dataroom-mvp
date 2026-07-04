import { sql } from 'drizzle-orm'
import { db } from '@/db/client'

export interface TrashDataroomRow {
  id: string
  name: string
  iconKey: string | null
  deletedAt: string
  folderCount: number
  fileCount: number
}

export interface TrashFolderRow {
  id: string
  name: string
  dataroomId: string
  dataroomName: string
  deletedAt: string
  folderCount: number
  fileCount: number
}

export interface TrashFileRow {
  id: string
  name: string
  folderId: string
  dataroomId: string
  dataroomName: string
  folderName: string
  sizeBytes: number
  deletedAt: string
}

const TRASH_LIMIT = 200

export async function listOwnerTrashDatarooms(ownerId: string): Promise<TrashDataroomRow[]> {
  const rows = await db.execute<{
    id: string
    name: string
    icon_key: string | null
    deleted_at: string
    folder_count: number
    file_count: number
  }>(sql`
    SELECT
      d.id,
      d.name,
      d.icon_key,
      d.deleted_at,
      COALESCE((
        SELECT COUNT(*)::int FROM folders
        WHERE dataroom_id = d.id AND delete_batch_id = d.delete_batch_id
      ), 0) AS folder_count,
      COALESCE((
        SELECT COUNT(*)::int FROM files f
        INNER JOIN folders fo ON fo.id = f.folder_id
        WHERE fo.dataroom_id = d.id AND f.delete_batch_id = d.delete_batch_id
      ), 0) AS file_count
    FROM datarooms d
    WHERE d.owner_id = ${ownerId}
      AND d.deleted_at IS NOT NULL
      AND d.delete_root = true
    ORDER BY d.deleted_at DESC
    LIMIT ${TRASH_LIMIT}
  `)
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    iconKey: r.icon_key,
    deletedAt: new Date(r.deleted_at).toISOString(),
    folderCount: Number(r.folder_count),
    fileCount: Number(r.file_count),
  }))
}

export async function listOwnerTrashFolders(ownerId: string): Promise<TrashFolderRow[]> {
  const rows = await db.execute<{
    id: string
    name: string
    dataroom_id: string
    dataroom_name: string
    deleted_at: string
    folder_count: number
    file_count: number
  }>(sql`
    SELECT
      fo.id,
      fo.name,
      fo.dataroom_id,
      d.name AS dataroom_name,
      fo.deleted_at,
      COALESCE((
        SELECT COUNT(*)::int FROM folders
        WHERE delete_batch_id = fo.delete_batch_id AND id != fo.id
      ), 0) AS folder_count,
      COALESCE((
        SELECT COUNT(*)::int FROM files
        WHERE delete_batch_id = fo.delete_batch_id
      ), 0) AS file_count
    FROM folders fo
    INNER JOIN datarooms d ON d.id = fo.dataroom_id
    WHERE d.owner_id = ${ownerId}
      AND fo.deleted_at IS NOT NULL
      AND fo.delete_root = true
    ORDER BY fo.deleted_at DESC
    LIMIT ${TRASH_LIMIT}
  `)
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    dataroomId: r.dataroom_id,
    dataroomName: r.dataroom_name,
    deletedAt: new Date(r.deleted_at).toISOString(),
    folderCount: Number(r.folder_count),
    fileCount: Number(r.file_count),
  }))
}

export async function listOwnerTrashFiles(ownerId: string): Promise<TrashFileRow[]> {
  const rows = await db.execute<{
    id: string
    name: string
    folder_id: string
    dataroom_id: string
    dataroom_name: string
    folder_name: string
    size_bytes: string
    deleted_at: string
  }>(sql`
    SELECT
      fi.id,
      fi.name,
      fi.folder_id,
      fo.dataroom_id,
      d.name AS dataroom_name,
      fo.name AS folder_name,
      fi.size_bytes::text AS size_bytes,
      fi.deleted_at
    FROM files fi
    INNER JOIN folders fo ON fo.id = fi.folder_id
    INNER JOIN datarooms d ON d.id = fo.dataroom_id
    WHERE d.owner_id = ${ownerId}
      AND fi.deleted_at IS NOT NULL
      AND fi.delete_root = true
    ORDER BY fi.deleted_at DESC
    LIMIT ${TRASH_LIMIT}
  `)
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    folderId: r.folder_id,
    dataroomId: r.dataroom_id,
    dataroomName: r.dataroom_name,
    folderName: r.folder_name,
    sizeBytes: Number(r.size_bytes),
    deletedAt: new Date(r.deleted_at).toISOString(),
  }))
}

export async function collectS3KeysForFolder(folderId: string): Promise<string[]> {
  const rows = await db.execute<{ s3_key: string }>(sql`
    WITH RECURSIVE descendants AS (
      SELECT id FROM folders WHERE id = ${folderId}
      UNION ALL
      SELECT f.id FROM folders f
      INNER JOIN descendants d ON f.parent_id = d.id
    )
    SELECT s3_key FROM files WHERE folder_id IN (SELECT id FROM descendants)
  `)
  return rows.map((r) => r.s3_key)
}

export async function collectS3KeysForDataroom(dataroomId: string): Promise<string[]> {
  const rows = await db.execute<{ s3_key: string }>(sql`
    SELECT s3_key FROM files
    WHERE folder_id IN (SELECT id FROM folders WHERE dataroom_id = ${dataroomId})
  `)
  return rows.map((r) => r.s3_key)
}
