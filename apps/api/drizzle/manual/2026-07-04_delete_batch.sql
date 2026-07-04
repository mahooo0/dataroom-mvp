-- Add delete-batch tracking to datarooms/folders/files so folder & dataroom
-- restore can undo the exact set of rows it deleted (previous timestamp-based
-- match resurrected cross-batch rows deleted in the same millisecond).
--
-- Also drops `status='ready'` from the files unique index so name collisions
-- surface at /files/init (before we write to S3), not at /files/:id/complete
-- (which would leave an orphan MinIO object).
--
-- Safe to apply on live data: all new columns are nullable or default false.
-- Apply with:  pnpm --filter api db:push  (or hand-run in psql)

BEGIN;

ALTER TABLE datarooms
  ADD COLUMN IF NOT EXISTS delete_batch_id uuid,
  ADD COLUMN IF NOT EXISTS delete_root boolean NOT NULL DEFAULT false;

ALTER TABLE folders
  ADD COLUMN IF NOT EXISTS delete_batch_id uuid,
  ADD COLUMN IF NOT EXISTS delete_root boolean NOT NULL DEFAULT false;

ALTER TABLE files
  ADD COLUMN IF NOT EXISTS delete_batch_id uuid,
  ADD COLUMN IF NOT EXISTS delete_root boolean NOT NULL DEFAULT false;

-- Existing soft-deleted rows: treat every currently-deleted row as its own
-- delete-root so the Trash view surfaces it. Batch id stays NULL — restore
-- falls back to single-row restore for pre-migration rows.
UPDATE datarooms SET delete_root = true WHERE deleted_at IS NOT NULL AND delete_root = false;
UPDATE folders  SET delete_root = true WHERE deleted_at IS NOT NULL AND delete_root = false;
UPDATE files    SET delete_root = true WHERE deleted_at IS NOT NULL AND delete_root = false;

-- Files unique index: drop `status='ready'` predicate so name collisions
-- surface at init, not at complete.
DROP INDEX IF EXISTS files_unique_name_idx;
CREATE UNIQUE INDEX files_unique_name_idx ON files (folder_id, name)
  WHERE deleted_at IS NULL;

-- Trash query indexes.
CREATE INDEX IF NOT EXISTS datarooms_trash_idx ON datarooms (owner_id, delete_root)
  WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS folders_trash_idx ON folders (dataroom_id, delete_root)
  WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS files_trash_idx ON files (folder_id, delete_root)
  WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS folders_batch_idx ON folders (delete_batch_id);
CREATE INDEX IF NOT EXISTS files_batch_idx ON files (delete_batch_id);

COMMIT;
