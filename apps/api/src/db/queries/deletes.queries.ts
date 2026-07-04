import { sql } from 'drizzle-orm'
import { db } from '@/db/client'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Cascade soft-delete every folder + file inside a dataroom. Assumes the
 * caller has already stamped the dataroom itself. Skips rows already deleted.
 */
export async function cascadeSoftDeleteDataroom(
  tx: Tx,
  dataroomId: string,
  batchId: string,
  now: Date,
): Promise<void> {
  await tx.execute(sql`
    UPDATE folders
    SET deleted_at = ${now},
        updated_at = ${now},
        delete_batch_id = ${batchId},
        delete_root = false
    WHERE deleted_at IS NULL
      AND dataroom_id = ${dataroomId}
  `)
  await tx.execute(sql`
    UPDATE files
    SET deleted_at = ${now},
        updated_at = ${now},
        delete_batch_id = ${batchId},
        delete_root = false
    WHERE deleted_at IS NULL
      AND folder_id IN (SELECT id FROM folders WHERE dataroom_id = ${dataroomId})
  `)
}

export interface FolderDescendantCounts {
  folderCount: number
  fileCount: number
}

/**
 * Recursive count of live descendant folders (excluding self) + live ready
 * files. Used by the delete-folder confirmation dialog.
 */
export async function getFolderDescendantCounts(folderId: string): Promise<FolderDescendantCounts> {
  const rows = await db.execute<{
    folder_count: number
    file_count: number
  }>(sql`
    WITH RECURSIVE descendants AS (
      SELECT id FROM folders WHERE id = ${folderId} AND deleted_at IS NULL
      UNION ALL
      SELECT f.id FROM folders f
      INNER JOIN descendants d ON f.parent_id = d.id
      WHERE f.deleted_at IS NULL
    )
    SELECT
      ((SELECT COUNT(*) FROM descendants) - 1)::int AS folder_count,
      (SELECT COUNT(*) FROM files
        WHERE folder_id IN (SELECT id FROM descendants)
          AND deleted_at IS NULL
          AND status = 'ready'
      )::int AS file_count
  `)
  const r = rows[0]
  return {
    folderCount: Math.max(0, r?.folder_count ?? 0),
    fileCount: r?.file_count ?? 0,
  }
}
