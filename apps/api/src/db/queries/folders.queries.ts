import { sql } from 'drizzle-orm'
import { db } from '@/db/client'

/**
 * Recursive CTE returning the given folder plus all live descendant folder IDs.
 * Used before soft-deleting a subtree so we can mark every descendant + its files
 * with the same `deletedAt` timestamp (batch-restorable).
 */
export async function collectDescendantFolderIds(rootId: string): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`
    WITH RECURSIVE descendants AS (
      SELECT id FROM folders WHERE id = ${rootId} AND deleted_at IS NULL
      UNION ALL
      SELECT f.id FROM folders f
      INNER JOIN descendants d ON f.parent_id = d.id
      WHERE f.deleted_at IS NULL
    )
    SELECT id FROM descendants
  `)
  return rows.map((r) => r.id)
}

/**
 * Returns true when `candidateId` sits anywhere in `ancestorId`'s subtree.
 * Used by folder move to reject cycles (moving A into A's descendant would orphan the subtree).
 */
export async function isFolderDescendantOf(
  candidateId: string,
  ancestorId: string,
): Promise<boolean> {
  if (candidateId === ancestorId) return true
  const rows = await db.execute<{ id: string }>(sql`
    WITH RECURSIVE descendants AS (
      SELECT id FROM folders WHERE id = ${ancestorId} AND deleted_at IS NULL
      UNION ALL
      SELECT f.id FROM folders f
      INNER JOIN descendants d ON f.parent_id = d.id
      WHERE f.deleted_at IS NULL
    )
    SELECT id FROM descendants WHERE id = ${candidateId} LIMIT 1
  `)
  return rows.length > 0
}

export interface FolderWithCountsRow {
  id: string
  dataroomId: string
  parentId: string | null
  name: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  deleteBatchId: string | null
  deleteRoot: boolean
  childFolderCount: number
  fileCount: number
}

/**
 * All live folders in a dataroom, each annotated with the number of live child folders
 * and ready files. Single query — cheaper than N+1 count roundtrips.
 */
export async function listDataroomFoldersWithCounts(
  dataroomId: string,
): Promise<FolderWithCountsRow[]> {
  const rows = await db.execute<{
    id: string
    dataroom_id: string
    parent_id: string | null
    name: string
    created_at: string
    updated_at: string
    deleted_at: string | null
    delete_batch_id: string | null
    delete_root: boolean
    child_folder_count: number
    file_count: number
  }>(sql`
    SELECT
      f.id,
      f.dataroom_id,
      f.parent_id,
      f.name,
      f.created_at,
      f.updated_at,
      f.deleted_at,
      f.delete_batch_id,
      f.delete_root,
      COALESCE(cf.count, 0)::int AS child_folder_count,
      COALESCE(ff.count, 0)::int AS file_count
    FROM folders f
    LEFT JOIN (
      SELECT parent_id, COUNT(*)::int AS count
      FROM folders
      WHERE deleted_at IS NULL
      GROUP BY parent_id
    ) cf ON cf.parent_id = f.id
    LEFT JOIN (
      SELECT folder_id, COUNT(*)::int AS count
      FROM files
      WHERE deleted_at IS NULL AND status = 'ready'
      GROUP BY folder_id
    ) ff ON ff.folder_id = f.id
    WHERE f.dataroom_id = ${dataroomId}
      AND f.deleted_at IS NULL
    ORDER BY f.name ASC
  `)

  return rows.map((r) => ({
    id: r.id,
    dataroomId: r.dataroom_id,
    parentId: r.parent_id,
    name: r.name,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
    deletedAt: r.deleted_at ? new Date(r.deleted_at) : null,
    deleteBatchId: r.delete_batch_id,
    deleteRoot: r.delete_root,
    childFolderCount: r.child_folder_count,
    fileCount: r.file_count,
  }))
}
