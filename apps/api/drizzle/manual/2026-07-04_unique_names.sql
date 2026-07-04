-- Close two collision holes in the name-uniqueness indexes.
--
-- 1. datarooms_unique_name_idx: previously missing entirely — code throws
--    DATAROOM_NAME_TAKEN on 23505 but the constraint never existed, so
--    duplicate dataroom names silently succeeded on rename.
--
-- 2. folders_unique_name_idx: the old (dataroomId, parentId, name) index
--    treated parentId=NULL as distinct (Postgres UNIQUE with NULL), so two
--    root folders in the same dataroom could share a name. COALESCE
--    normalizes NULL → sentinel UUID so the constraint fires at the root
--    too.
--
-- Safe to apply on live data as long as there are no existing duplicates.
-- Run duplicate-checks first if the DB has real user data.

BEGIN;

-- Datarooms: per-owner name uniqueness for live rows.
CREATE UNIQUE INDEX IF NOT EXISTS datarooms_unique_name_idx
  ON datarooms (owner_id, name)
  WHERE deleted_at IS NULL;

-- Folders: rebuild the partial unique with COALESCE so root-level dupes are blocked.
DROP INDEX IF EXISTS folders_unique_name_idx;
CREATE UNIQUE INDEX folders_unique_name_idx
  ON folders (
    dataroom_id,
    COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    name
  )
  WHERE deleted_at IS NULL;

COMMIT;
