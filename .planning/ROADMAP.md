# Roadmap: Dataroom MVP

## Overview

A user signs in with Clerk, creates a dataroom, organizes PDFs into nested folders, uploads them direct-to-MinIO via presigned URLs, and views them in an in-app react-pdf viewer — all deployed to Vercel + Dokploy. The journey starts by proving the critical path (monorepo boots, Clerk auth works end-to-end, `packages/shared` resolves) in Phase 1, then establishes the ownership + optimistic-mutation template with Dataroom CRUD in Phase 2 — every downstream phase repeats that shape. Folder tree lands next (Phase 3) so files have a home; upload gets its own dedicated phase (Phase 4) because it carries 4 of the 5 highest-cost failure modes (Content-Type sig mismatch, internal-hostname leak, MinIO CORS, expiry). Then file CRUD (5), PDF viewer (6), the destructive-and-reversible flows — recursive cascade delete with Trash/Undo (7), then differentiator polish drag-drop + filter (8), and finally the polish sweep + deploy (9). Deploy lands last so the final hour is UX polish, not env-var debugging on a live host.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Bootstrap & Auth** - Monorepo boots, Clerk sign-in works end-to-end, empty datarooms list renders behind auth guard
- [ ] **Phase 2: Datarooms CRUD** - User creates/renames/deletes datarooms with optimistic UI; ownership hook + typed error template established
- [ ] **Phase 3: Folder Tree & Breadcrumbs** - User navigates a nested folder tree with lazy-expand, prefetch-on-hover, and clickable breadcrumbs
- [ ] **Phase 4: Upload Path** - User drops or picks PDFs and watches them upload direct-to-MinIO via presigned PUT with real progress, retry, cancel, and conflict resolution
- [ ] **Phase 5: File CRUD** - User renames/deletes files inline with optimistic UI; duplicate-name 409 flows into the conflict dialog
- [ ] **Phase 6: PDF Viewer** - User opens any file in an in-app react-pdf viewer with page nav, zoom presets, text selection, and download
- [ ] **Phase 7: Recursive Delete & Trash/Undo** - User cascade-deletes non-empty folders, undoes any delete via toast, and manages a Trash view for permanent deletion
- [ ] **Phase 8: Drag-Drop Move & Filter** - User moves files between folders via drag-drop and filters visible files by filename
- [ ] **Phase 9: Polish & Deploy** - UX audit (empty/error/skeleton states, focus, keyboard, dark mode, M&A seed data) plus Vercel + Dokploy deploy with README

## Phase Details

### Phase 1: Bootstrap & Auth
**Goal**: Monorepo boots, Clerk sign-in works end-to-end, and an empty datarooms list renders behind an auth guard.
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, UX-08
**Success Criteria** (what must be TRUE):
  1. User can sign in via Clerk magic-link and land on an authenticated `/datarooms` page.
  2. Refreshing a protected page keeps the user signed in; signing out redirects to sign-in.
  3. A signed-out user hitting any protected URL is redirected to sign-in and returned to their intended destination after auth.
  4. Backend `GET /health` returns the caller's Clerk userId when hit with a valid signed browser token, and rejects unsigned requests with 401.
  5. Dark/light theme toggle in the header persists across refreshes.
**Key risks**: Pitfall #9 (`packages/shared` fails to resolve on Vercel), #11 (Cached Clerk `getToken()` → 401 after 60s), #12 (`VITE_` env prefix forgotten), #18 (Clerk token caching in a variable), #19 (`@clerk/backend` header parsing case-sensitivity).
**Plans**: TBD
**UI hint**: yes

### Phase 2: Datarooms CRUD
**Goal**: User can create, rename, and delete their own datarooms with optimistic UI; the ownership hook and typed-error contract are established as the template every downstream CRUD reuses.
**Depends on**: Phase 1
**Requirements**: DR-01, DR-02, DR-03, DR-04, DR-05, TEST-01
**Success Criteria** (what must be TRUE):
  1. User can create a dataroom from a single-field dialog and immediately see it in the list.
  2. User can inline-rename a dataroom (double-click / F2 → Enter commits, Escape cancels) with instant UI feedback.
  3. User can delete a dataroom via type-to-confirm modal (types the exact name) and it disappears from the list.
  4. Create/rename/delete feel instant — the UI updates before the server responds, and rolls back with a toast if the server rejects.
  5. A backend integration test proves the ownership hook rejects cross-user access with 403.
**Key risks**: Pitfall #4 (Fastify Zod serializer missing — response fields leak), #6 (Optimistic race without `cancelQueries` causes flicker), #8 (Unstable React Query key spawns duplicate cache entries), #22 (`window.confirm` used instead of shadcn `AlertDialog`).
**Plans**: TBD
**UI hint**: yes

### Phase 3: Folder Tree & Breadcrumbs
**Goal**: User can navigate a nested folder tree with lazy-expand, prefetch-on-hover, and clickable breadcrumbs — the shell files will live in.
**Depends on**: Phase 2
**Requirements**: FOLD-01, FOLD-02, FOLD-03, FOLD-04, FOLD-06, FOLD-07, FOLD-08
**Success Criteria** (what must be TRUE):
  1. User sees a collapsible sidebar folder tree next to a main pane for the current folder inside any dataroom.
  2. User can create a folder inline at any nesting level (row appears in edit mode, not a modal) and rename it inline (F2/double-click).
  3. Hovering a folder in the tree prefetches its children so clicking to expand feels instant.
  4. Clicking any breadcrumb segment jumps to that ancestor and updates the URL.
  5. Trying to create a folder with a name already used by a sibling shows an inline error on the input (no toast).
  6. User can delete an empty folder immediately with a toast (no confirmation modal).
**Key risks**: Pitfall #5 (Drizzle FK missing `{ onDelete: 'cascade' }` on `parentId` self-ref), #7 (TanStack Router loader vs `useSuspenseQuery` cache identity — stale after mutation), #10 (N+1 on nested folder fetch), #17 (Duplicate folder name race → PG 23505 must map to 409 `FOLDER_NAME_TAKEN`).
**Plans**: TBD
**UI hint**: yes

### Phase 4: Upload Path
**Goal**: User can upload PDFs by drag-drop or file picker directly to MinIO via presigned PUT with real progress, retry-on-failure, cancel, and same-name conflict resolution — the highest-risk phase, proven before the viewer or cascade delete.
**Depends on**: Phase 3
**Requirements**: FILE-01, FILE-02, FILE-03, FILE-04, FILE-05, FILE-06, FILE-07, FILE-08, FILE-09, FILE-10, TEST-04
**Success Criteria** (what must be TRUE):
  1. User can drag PDFs from their desktop onto the file area or pick them via an Upload button, and see a per-file pending row with real progress.
  2. Non-PDF drops and files >50 MB are rejected with a clear inline error before the PUT is attempted (defense-in-depth on server too).
  3. On upload failure, the pending row stays with a Retry button — the file selection is not lost.
  4. Cancel button aborts the XHR, deletes the pending DB row, and removes the UI row; no orphan pending state after cancel.
  5. Uploading a file with a name that already exists shows a Replace / Keep both / Cancel modal; both duplicate-name races and pre-existing conflicts route through the same dialog.
  6. A backend integration test proves the full upload state machine (init → HeadObject → complete) transitions cleanly with typed error codes on failure.
**Key risks**: Pitfall #1 (Content-Type signature mismatch on presigned PUT — 403 SignatureDoesNotMatch), #2 (Presigned URL leaks internal Docker hostname `minio:9000` to the browser), #3 (MinIO CORS misconfigured — silent PUT block), #4 upload variant (Presigned URL expiry too short for 50 MB on slow line), #13 (Cancel leaks pending DB rows + MinIO orphans), #14 (Concurrent same-name race on UNIQUE constraint).
**Plans**: TBD
**UI hint**: yes

### Phase 5: File CRUD
**Goal**: User can rename and delete files inline with the same optimistic template as datarooms/folders, and duplicate-name 409s flow into the conflict dialog.
**Depends on**: Phase 4
**Requirements**: FILE-11, FILE-12, FILE-14, TEST-02
**Success Criteria** (what must be TRUE):
  1. User can inline-rename a file (F2 / double-click auto-selects the basename, not the `.pdf` extension) with optimistic UI.
  2. User can delete a file immediately with a toast (no confirmation modal); the file disappears from the grid instantly.
  3. Renaming a file to a name that already exists in the same folder rolls back the optimistic update and opens the same conflict dialog as upload.
  4. A backend integration test proves the UNIQUE `(folderId, name)` constraint returns typed 409 `FILE_NAME_TAKEN` for both file and folder duplicates.
**Key risks**: Pitfall #6 (Optimistic rename rollback on 409 must land in conflict dialog, not a generic error toast), #17 (Same-name conflict UX must match upload's Replace/Keep both/Cancel pattern), reviewer trap #22 (delete file must not use `window.confirm`).
**Plans**: TBD
**UI hint**: yes

### Phase 6: PDF Viewer
**Goal**: User can open any file in an in-app react-pdf viewer with page navigation, zoom presets, text selection, and download — page-at-a-time render for memory hygiene.
**Depends on**: Phase 5
**Requirements**: VIEW-01, VIEW-02, VIEW-03, VIEW-04, VIEW-05, VIEW-06, VIEW-07
**Success Criteria** (what must be TRUE):
  1. Clicking any file row opens a modal viewer that renders the PDF and preserves the underlying file-grid scroll position on close.
  2. User can navigate pages (prev/next + current/total page indicator) and zoom via presets (50-200% + fit-width + fit-page).
  3. User can select and copy text from the current page (text layer enabled).
  4. Download button fetches a presigned GET URL and triggers a browser download of the original file.
  5. If the presigned URL expires mid-session, the viewer refetches and retries silently — the user sees no error.
  6. Opening five different PDFs in a session does not leak memory (tab stays under a healthy footprint).
**Key risks**: Pitfall #10 (`react-pdf` worker fails in Vite prod build if `?url` import is missing — only surfaces in `pnpm preview`), #14 (Memory leak from not destroying `PDFDocumentProxy` on unmount / doc switch), rendering all pages at once (must stay page-at-a-time).
**Plans**: TBD
**UI hint**: yes

### Phase 7: Recursive Delete & Trash/Undo
**Goal**: User can cascade-delete non-empty folders with a real descendant preview, undo any delete via a 5-second toast, and manage a Trash view for permanent deletion — the "safety net for destructive actions" phase.
**Depends on**: Phase 6
**Requirements**: FOLD-05, FOLD-09, TRASH-01, TRASH-02, TRASH-03, TRASH-04, TRASH-05, TRASH-06, TEST-03
**Success Criteria** (what must be TRUE):
  1. Deleting a non-empty folder opens a modal showing the real count ("Delete 'Q3 Financials' and its 12 files and 3 folders?") before proceeding.
  2. Every delete (dataroom / folder / file) sets a `deletedAt` timestamp instead of removing the row; deleted items disappear from all lists, trees, and grids.
  3. After any delete, a toast appears with an Undo button active for 5 seconds; clicking Undo restores the exact resource (and its descendants for cascade deletes).
  4. A Trash view lists all soft-deleted items with Restore and "Delete permanently" actions; permanent delete removes the DB row AND the underlying MinIO objects best-effort.
  5. A backend integration test proves cascade delete marks all descendant folders and files as soft-deleted (and permanent delete removes them + their S3 objects).
**Key risks**: Pitfall #5 (Missing `ON DELETE CASCADE` on FK when doing hard-delete via permanent-delete path), recursive CTE bugs (must collect descendant `s3_key`s BEFORE deleting rows), orphaned MinIO objects on permanent delete (best-effort batch with logged failures), soft-delete filter must be applied to every list/tree/grid query (miss one → deleted items reappear).
**Plans**: TBD
**UI hint**: yes

### Phase 8: Drag-Drop Move & Filter
**Goal**: User can drag files onto folder tree nodes to move them between folders, and filter the visible file list by filename with zero-latency client-side search.
**Depends on**: Phase 7
**Requirements**: FILE-13
**Success Criteria** (what must be TRUE):
  1. User can drag a file from the file grid onto any folder in the tree; a styled drag ghost follows the cursor and the drop target highlights.
  2. On drop, the file disappears from the source folder and appears in the target folder instantly (optimistic), rolling back with a toast if the server rejects.
  3. Dropping a file onto its current folder is a no-op; dropping onto a folder where the same filename already exists opens the conflict dialog.
  4. A filter input in the dataroom header narrows the file/folder list to matches as the user types, with no network calls.
**Key risks**: Pitfall #7 (Optimistic move without `cancelQueries` snaps back), #15 (Move cycle prevention — DnD `canDrop` must reject move into descendant, mirroring server validation), UX pitfall (drag ghost invisible or unstyled), duplicate-name 409 on move must land in conflict dialog (not a raw error toast).
**Plans**: TBD
**UI hint**: yes

### Phase 9: Polish & Deploy
**Goal**: Full UX audit sweep (empty states, error states, skeletons, focus, keyboard shortcuts, M&A seed data) plus Vercel + Dokploy deploy with LE certs, MinIO CORS, and a reviewer-friendly README.
**Depends on**: Phase 8
**Requirements**: UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-09, DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05, DEPLOY-06
**Success Criteria** (what must be TRUE):
  1. Every list (datarooms, folders, files, trash) has a designed empty state with a primary CTA; every route has a designed error state with a Retry action; loading uses skeletons everywhere (no whole-view spinners).
  2. Every mutation error shows a sonner toast; no confirmation dialog uses `window.confirm/alert/prompt`; keyboard shortcuts (`Enter`, `F2`, `Delete`, `Escape`) work throughout the app.
  3. Dialogs trap focus and restore focus to the trigger on close; Tab navigation works end-to-end.
  4. First sign-in seeds a realistic M&A dataset ("Project Nightingale — Acme × Hooli / 01 Financial Statements / ...") — no "test folder 1".
  5. Frontend is live at the deployed Vercel URL; backend + Postgres + MinIO run under Dokploy with LE certs on both api and minio subdomains, Postgres and MinIO data survive redeploys (named volumes).
  6. README documents design decisions, live URL, sign-in flow for the reviewer, local dev setup, and screenshots of key flows.
**Key risks**: Pitfall #3 (MinIO CORS in prod — `curl -X OPTIONS` verify BEFORE UI regression), #10 (`react-pdf` worker in prod build — `pnpm preview` before Vercel push), #12 (Dokploy wipes workdir — named volumes only), #9 (`packages/shared` on Vercel — verify with local `rm -rf node_modules && pnpm install && pnpm --filter web build`), all reviewer traps (#21-#27: spinners, alerts, empty states, error states, keyboard nav, fake data, over-engineering without polish).
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Bootstrap & Auth | 0/TBD | Not started | - |
| 2. Datarooms CRUD | 0/TBD | Not started | - |
| 3. Folder Tree & Breadcrumbs | 0/TBD | Not started | - |
| 4. Upload Path | 0/TBD | Not started | - |
| 5. File CRUD | 0/TBD | Not started | - |
| 6. PDF Viewer | 0/TBD | Not started | - |
| 7. Recursive Delete & Trash/Undo | 0/TBD | Not started | - |
| 8. Drag-Drop Move & Filter | 0/TBD | Not started | - |
| 9. Polish & Deploy | 0/TBD | Not started | - |
