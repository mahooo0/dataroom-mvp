import { sql } from 'drizzle-orm'
import { db } from '@/db/client'

/**
 * Sum of ready + pending file bytes for an owner. Pending counts because a live
 * presigned upload will convert to ready — allowing the quota to be exceeded
 * while the client is mid-upload would break the guarantee.
 */
export async function getOwnerUsedBytes(ownerId: string): Promise<number> {
  const [row] = await db.execute<{ used: string | number | null }>(sql`
    SELECT COALESCE(SUM(f.size_bytes), 0)::bigint AS used
    FROM files f
    INNER JOIN folders fo ON fo.id = f.folder_id
    INNER JOIN datarooms d ON d.id = fo.dataroom_id
    WHERE d.owner_id = ${ownerId}
      AND d.deleted_at IS NULL
      AND fo.deleted_at IS NULL
      AND f.deleted_at IS NULL
      AND f.status IN ('ready', 'pending')
  `)
  return Number(row?.used ?? 0)
}

export interface DataroomUsageRow {
  dataroomId: string
  name: string
  bytes: number
}

/**
 * Ready-file bytes per dataroom for an owner. Used by /me/usage — pending
 * uploads deliberately excluded so the meter reflects committed state, not
 * transient reservations.
 */
export async function getUsagePerDataroom(ownerId: string): Promise<DataroomUsageRow[]> {
  const rows = await db.execute<{
    dataroom_id: string
    name: string
    bytes: string | number | null
  }>(sql`
    SELECT
      d.id AS dataroom_id,
      d.name AS name,
      COALESCE(SUM(f.size_bytes), 0)::bigint AS bytes
    FROM datarooms d
    LEFT JOIN folders fo
      ON fo.dataroom_id = d.id AND fo.deleted_at IS NULL
    LEFT JOIN files f
      ON f.folder_id = fo.id
      AND f.status = 'ready'
      AND f.deleted_at IS NULL
    WHERE d.owner_id = ${ownerId}
      AND d.deleted_at IS NULL
    GROUP BY d.id, d.name
    ORDER BY d.created_at DESC
  `)
  return rows.map((r) => ({
    dataroomId: r.dataroom_id,
    name: r.name,
    bytes: Number(r.bytes ?? 0),
  }))
}
