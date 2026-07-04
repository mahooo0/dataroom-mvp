import { sql } from 'drizzle-orm'
import { db } from '@/db/client'

const MAX_HITS = 12

export interface DataroomHitRow {
  id: string
  name: string
  iconKey: string | null
}

export interface FolderHitRow {
  id: string
  name: string
  dataroomId: string
  dataroomName: string
}

export interface FileHitRow {
  id: string
  name: string
  folderId: string
  folderName: string
  dataroomId: string
  dataroomName: string
}

export interface SearchFilters {
  ownerId: string
  pattern: string | null
  iconKey: string | null
}

/**
 * The trio of search queries below share a shape: match the owner, filter out
 * soft-deleted rows, optional name ILIKE, optional iconKey. Kept as three
 * separate queries (not one UNION) so each result set can be capped
 * independently and typed with distinct row shapes.
 */

export async function searchDatarooms(f: SearchFilters): Promise<DataroomHitRow[]> {
  const hasQuery = f.pattern !== null
  const noIcon = f.iconKey === null
  const rows = await db.execute<{ id: string; name: string; icon_key: string | null }>(sql`
    SELECT id, name, icon_key
    FROM datarooms
    WHERE owner_id = ${f.ownerId}
      AND deleted_at IS NULL
      AND (${!hasQuery}::boolean OR name ILIKE ${f.pattern})
      AND (${noIcon}::boolean OR icon_key = ${f.iconKey})
    ORDER BY updated_at DESC
    LIMIT ${MAX_HITS}
  `)
  return rows.map((r) => ({ id: r.id, name: r.name, iconKey: r.icon_key }))
}

export async function searchFolders(f: SearchFilters): Promise<FolderHitRow[]> {
  const hasQuery = f.pattern !== null
  const noIcon = f.iconKey === null
  const rows = await db.execute<{
    id: string
    name: string
    dataroom_id: string
    dataroom_name: string
  }>(sql`
    SELECT f.id, f.name, d.id AS dataroom_id, d.name AS dataroom_name
    FROM folders f
    INNER JOIN datarooms d ON d.id = f.dataroom_id
    WHERE d.owner_id = ${f.ownerId}
      AND d.deleted_at IS NULL
      AND f.deleted_at IS NULL
      AND (${!hasQuery}::boolean OR f.name ILIKE ${f.pattern})
      AND (${noIcon}::boolean OR d.icon_key = ${f.iconKey})
    ORDER BY f.updated_at DESC
    LIMIT ${MAX_HITS}
  `)
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    dataroomId: r.dataroom_id,
    dataroomName: r.dataroom_name,
  }))
}

export async function searchFiles(f: SearchFilters): Promise<FileHitRow[]> {
  const hasQuery = f.pattern !== null
  const noIcon = f.iconKey === null
  const rows = await db.execute<{
    id: string
    name: string
    folder_id: string
    folder_name: string
    dataroom_id: string
    dataroom_name: string
  }>(sql`
    SELECT fi.id, fi.name, fo.id AS folder_id, fo.name AS folder_name,
           d.id AS dataroom_id, d.name AS dataroom_name
    FROM files fi
    INNER JOIN folders fo ON fo.id = fi.folder_id
    INNER JOIN datarooms d ON d.id = fo.dataroom_id
    WHERE d.owner_id = ${f.ownerId}
      AND d.deleted_at IS NULL
      AND fo.deleted_at IS NULL
      AND fi.deleted_at IS NULL
      AND fi.status = 'ready'
      AND (${!hasQuery}::boolean OR fi.name ILIKE ${f.pattern})
      AND (${noIcon}::boolean OR d.icon_key = ${f.iconKey})
    ORDER BY fi.updated_at DESC
    LIMIT ${MAX_HITS}
  `)
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    folderId: r.folder_id,
    folderName: r.folder_name,
    dataroomId: r.dataroom_id,
    dataroomName: r.dataroom_name,
  }))
}
