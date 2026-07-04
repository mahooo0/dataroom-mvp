-- Share links now expire and can be flagged view-only.
--
-- Before this migration:
--   - file_shares had no expiresAt; a forgotten revoke = a permanent link
--   - all shares implicitly allowed download; a "view only" mode wasn't expressible
--
-- After this migration:
--   - `expires_at` is required going forward. Backfill existing rows to +7 days
--     from now so the migration is non-breaking for links already in the wild.
--   - `allow_download` defaults to false — the safer default for M&A material.
--     Existing links keep the previous behaviour (download allowed) so we don't
--     surprise anyone who was already sharing.
--
-- Safe to apply on live data.
-- Apply with:  pnpm --filter api db:push  (or hand-run in psql)

BEGIN;

ALTER TABLE file_shares
  ADD COLUMN IF NOT EXISTS allow_download boolean NOT NULL DEFAULT false;

-- Preserve historical behaviour for links that already exist.
UPDATE file_shares SET allow_download = true WHERE revoked_at IS NULL;

ALTER TABLE file_shares
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE file_shares
  SET expires_at = now() + interval '7 days'
  WHERE expires_at IS NULL;

ALTER TABLE file_shares
  ALTER COLUMN expires_at SET NOT NULL;

COMMIT;
