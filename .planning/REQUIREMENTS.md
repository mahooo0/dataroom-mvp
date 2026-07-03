# Requirements: Dataroom MVP

**Defined:** 2026-07-03
**Core Value:** A user can create a dataroom, upload a PDF into the right folder, and immediately view it — the create → upload → view flow must feel instantaneous and never lose a file.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases in Traceability.

### Authentication

- [ ] **AUTH-01**: User can sign in via Clerk-hosted magic-link flow (no shared demo account required for reviewer)
- [ ] **AUTH-02**: Session persists across page refresh (Clerk `useAuth` bootstrap)
- [ ] **AUTH-03**: Signed-out users are redirected to sign-in from any protected route
- [ ] **AUTH-04**: Backend rejects any mutating request without a valid Clerk-signed JWT (`@clerk/backend` verify)
- [ ] **AUTH-05**: Every mutation runs an ownership check — user can only modify resources they own

### Dataroom CRUD

- [ ] **DR-01**: User can create a new dataroom from the datarooms list (dialog with name input, single field)
- [ ] **DR-02**: User can see all their datarooms in a grid/list on the home page with a card for each
- [ ] **DR-03**: User can rename a dataroom inline (double-click / F2 → edit → Enter commits, Escape cancels)
- [ ] **DR-04**: User can soft-delete a dataroom via type-to-confirm modal (matches name for irreversible-looking actions)
- [ ] **DR-05**: Create/rename/delete use optimistic UI (React Query `cancelQueries` template) with toast on error

### Folder CRUD

- [ ] **FOLD-01**: Inside a dataroom, user sees a collapsible sidebar folder tree + main file grid for the current folder
- [ ] **FOLD-02**: User can create a folder inline (row appears in edit mode, not modal) at any nesting level
- [ ] **FOLD-03**: User can rename a folder inline (F2 or double-click)
- [ ] **FOLD-04**: User can soft-delete an empty folder immediately (no modal, optimistic + toast)
- [ ] **FOLD-05**: User can soft-delete a non-empty folder via modal showing "delete N files and M folders?" (real descendant count)
- [ ] **FOLD-06**: Folder tree lazy-expands (children fetched on click) with prefetch-on-hover
- [ ] **FOLD-07**: Breadcrumbs reflect the current path and are clickable to jump to any ancestor
- [ ] **FOLD-08**: Duplicate folder name within the same parent returns 409; frontend shows inline error on the input
- [ ] **FOLD-09**: Deleting a folder cascades to all descendant folders and files (soft-delete via `deletedAt` propagation)

### File Upload (highest-risk phase)

- [ ] **FILE-01**: User can upload PDFs by drag-drop from desktop onto the file area (page-level drop overlay)
- [ ] **FILE-02**: User can upload PDFs via a visible "Upload" button that opens a file picker
- [ ] **FILE-03**: Only `application/pdf` accepted; other mimes rejected client-side and server-side (defense in depth)
- [ ] **FILE-04**: Max file size 50 MB enforced client-side and server-side (defense in depth)
- [ ] **FILE-05**: Upload goes browser → MinIO directly via presigned PUT URL (backend never receives bytes)
- [ ] **FILE-06**: Real upload progress (XHR events) shown in a per-file pending row with progress bar
- [ ] **FILE-07**: On upload failure, the pending row shows an error state with a Retry button; user data is preserved
- [ ] **FILE-08**: User can cancel a mid-upload via Cancel button (aborts XHR + deletes pending row + best-effort S3 cleanup)
- [ ] **FILE-09**: Same-name conflict (existing ready file with the same name in the same folder) shows a modal with three actions: **Replace**, **Keep both** (auto-suffix), or **Cancel** — Dropbox pattern
- [ ] **FILE-10**: Upload UX is NOT optimistic — pending rows only reflect real backend confirmation; no phantom files if network drops

### File CRUD

- [ ] **FILE-11**: User can rename a file inline (F2 or double-click; auto-selects basename, not extension)
- [ ] **FILE-12**: User can soft-delete a file immediately (no modal, optimistic + toast)
- [ ] **FILE-13**: User can move a file to a different folder via drag-drop from file grid onto folder tree node
- [ ] **FILE-14**: File CRUD uses the same optimistic template as folder/dataroom CRUD

### PDF Viewer

- [ ] **VIEW-01**: Clicking a file opens an in-app PDF viewer (modal, not new route — preserves file grid scroll)
- [ ] **VIEW-02**: Viewer shows current page number + total pages + prev/next navigation
- [ ] **VIEW-03**: Viewer supports zoom presets (50%, 75%, 100%, 125%, 150%, 200%, fit-width, fit-page)
- [ ] **VIEW-04**: Viewer has a download button that fetches a presigned GET URL and triggers browser download
- [ ] **VIEW-05**: Text layer enabled — user can select text on the current page
- [ ] **VIEW-06**: Viewer renders page-at-a-time (not continuous scroll) for memory hygiene on large PDFs
- [ ] **VIEW-07**: Presigned GET URL has 1h TTL; on 403 (expired), viewer refetches and retries silently

### Trash & Undo

- [ ] **TRASH-01**: Soft-delete of any resource (dataroom, folder, file) sets `deletedAt` timestamp instead of removing the row
- [ ] **TRASH-02**: All list/tree/grid queries filter out `deletedAt IS NOT NULL` rows by default
- [ ] **TRASH-03**: After any delete mutation, a sonner toast shows "Deleted [name]" with an **Undo** button active for 5 seconds
- [ ] **TRASH-04**: Undo restores `deletedAt = NULL` on the exact resource; cascade undo for folders restores descendants deleted in the same operation
- [ ] **TRASH-05**: Trash view (accessible from datarooms list or dataroom header) lists all soft-deleted items with **Restore** and **Delete permanently** actions
- [ ] **TRASH-06**: "Delete permanently" removes the DB row AND deletes the underlying MinIO objects (best-effort batch)

### UX States (polish sweep)

- [ ] **UX-01**: Every list (datarooms, folders, files, trash) has a designed empty state with a primary CTA
- [ ] **UX-02**: Every route has a designed error state (network / 5xx / 403 / 404) with Retry action
- [ ] **UX-03**: Loading uses skeleton components — never a full-view spinner
- [ ] **UX-04**: Every mutation error shows a sonner toast; no silent failures
- [ ] **UX-05**: All confirmation dialogs use shadcn `AlertDialog` — no `window.confirm` / `window.alert` / `window.prompt` anywhere in the app
- [ ] **UX-06**: Focus management: dialogs trap focus, restore focus to trigger on close; keyboard nav works throughout
- [ ] **UX-07**: Keyboard shortcuts: `Enter` opens, `F2` renames, `Delete` deletes, `Escape` cancels/closes
- [ ] **UX-08**: Dark mode toggle in header (`next-themes` equivalent for Vite, or CSS-var swap)
- [ ] **UX-09**: Seed data is realistic M&A framing ("Project Nightingale — Acme × Hooli / 01 Financial Statements / Q3-2025-Balance-Sheet.pdf"), not "test folder 1"

### Deployment & Documentation

- [ ] **DEPLOY-01**: Frontend deployed to Vercel from monorepo (Root Directory `apps/web`, install/build `cd ../.. && pnpm --filter web build`)
- [ ] **DEPLOY-02**: Backend + Postgres + MinIO deployed via single Dokploy compose to `api.dataroom.holy-water.app` + `minio.dataroom.holy-water.app`
- [ ] **DEPLOY-03**: Postgres and MinIO use named Docker volumes (survive Dokploy workdir wipes)
- [ ] **DEPLOY-04**: Traefik LE certs issued for both subdomains before Cloudflare proxying is enabled
- [ ] **DEPLOY-05**: MinIO CORS allows the deployed frontend origin (verified via `curl -X OPTIONS` before UI regression check)
- [ ] **DEPLOY-06**: README documents: design decisions summary, live URL, sign-in flow for reviewer, local dev setup (docker-compose + pnpm dev), and screenshots of key flows

### Contract Tests (Tier 1)

- [ ] **TEST-01**: Backend integration test — ownership hook rejects cross-user access with 403
- [ ] **TEST-02**: Backend integration test — duplicate folder/file name returns 409 with typed `FILE_NAME_TAKEN` code
- [ ] **TEST-03**: Backend integration test — cascade delete removes all descendant folder/file rows and marks them soft-deleted correctly
- [ ] **TEST-04**: Backend integration test — full upload state machine (init → HeadObject → complete) transitions cleanly and reports errors typed

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Search & Discovery

- **V2-SEARCH-01**: Full-text search inside PDF content (embedding + vector store, or pg_trgm + pdftotext extraction)
- **V2-SEARCH-02**: Advanced filters (by owner, size, upload date)
- **V2-SEARCH-03**: Recently viewed / recently uploaded row on datarooms list

### Collaboration

- **V2-COLLAB-01**: Share dataroom with another user (view-only or edit)
- **V2-COLLAB-02**: Q&A / comments on files (VDR-standard workflow)
- **V2-COLLAB-03**: Audit log of who viewed / downloaded / modified what

### Enterprise VDR features

- **V2-VDR-01**: Watermark PDFs on view/download
- **V2-VDR-02**: Time-boxed link expiration
- **V2-VDR-03**: DRM / prevent-download modes

### File types

- **V2-FILE-01**: Support DOCX, XLSX, PPTX, images, plaintext
- **V2-FILE-02**: Server-side thumbnail generation for grid preview

### Polish & Differentiators

- **V2-POLISH-01**: Client-generated PDF thumbnails on file rows (pdf.js on client, cache in IndexedDB)
- **V2-POLISH-02**: Multi-select + bulk operations (bulk delete, bulk move)
- **V2-POLISH-03**: Sort by name / date / size (column header click)
- **V2-POLISH-04**: Keyboard shortcut cheat sheet (`?`)
- **V2-POLISH-05**: Multi-file same-name conflict UI with "Apply to all" (Explorer pattern)
- **V2-POLISH-06**: Grid vs list view toggle
- **V2-POLISH-07**: Folder emoji / color picker
- **V2-POLISH-08**: Onboarding tour for first-time users

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multi-tenancy / team workspaces | TASK.md scope is single-user; adds auth complexity without evaluation upside |
| Real-time / websockets | Single-user scope — no concurrent editing to sync |
| Server-side PDF thumbnails | Adds Node PDF processing service; client-side lazy generation is the only path (deferred to v2) |
| Non-PDF file types | TASK.md explicit limit; mime enforcement is defense-in-depth |
| Password reset / email verification UI | Clerk owns these behind its default flows |
| Theme preset picker | Dark/light toggle is enough; multi-preset adds noise for zero evaluation upside |
| Global search across datarooms | Not in TASK.md; client-side filename filter within a dataroom is enough |
| SSR / SEO | All content behind Clerk auth — no indexable surface |
| Decorative route/page transitions | Data Room must feel FAST (TASK.md priority #1); animations hurt perceived speed |
| Global spinner overlay on mutations | Breaks optimistic-UI perception; skeletons/toasts are better |
| Rename/create as modal | Inline edit is table stakes for Drive-like UX |
| `alert()` / `confirm()` / `prompt()` | Native dialogs are unstyled and jarring — always shadcn `AlertDialog` |
| Custom multipart upload on backend | Presigned PUT directly to MinIO is faster and simpler; backend must never touch bytes |
| Continuous PDF scroll | Page-at-a-time renders match Drive/Adobe defaults and avoids memory bloat with large PDFs |
| Marquee (drag-select) multi-select | Advanced UX pattern; not table stakes for MVP |
| First-letter navigation (Drive-style) | Advanced UX pattern; not table stakes |

## Traceability

Which phases cover which requirements. Filled by roadmapper.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1: Bootstrap & Auth | Pending |
| AUTH-02 | Phase 1: Bootstrap & Auth | Pending |
| AUTH-03 | Phase 1: Bootstrap & Auth | Pending |
| AUTH-04 | Phase 1: Bootstrap & Auth | Pending |
| AUTH-05 | Phase 1: Bootstrap & Auth | Pending |
| DR-01 | Phase 2: Datarooms CRUD | Pending |
| DR-02 | Phase 2: Datarooms CRUD | Pending |
| DR-03 | Phase 2: Datarooms CRUD | Pending |
| DR-04 | Phase 2: Datarooms CRUD | Pending |
| DR-05 | Phase 2: Datarooms CRUD | Pending |
| FOLD-01 | Phase 3: Folder Tree & Breadcrumbs | Pending |
| FOLD-02 | Phase 3: Folder Tree & Breadcrumbs | Pending |
| FOLD-03 | Phase 3: Folder Tree & Breadcrumbs | Pending |
| FOLD-04 | Phase 3: Folder Tree & Breadcrumbs | Pending |
| FOLD-05 | Phase 7: Recursive Delete & Trash/Undo | Pending |
| FOLD-06 | Phase 3: Folder Tree & Breadcrumbs | Pending |
| FOLD-07 | Phase 3: Folder Tree & Breadcrumbs | Pending |
| FOLD-08 | Phase 3: Folder Tree & Breadcrumbs | Pending |
| FOLD-09 | Phase 7: Recursive Delete & Trash/Undo | Pending |
| FILE-01 | Phase 4: Upload Path | Pending |
| FILE-02 | Phase 4: Upload Path | Pending |
| FILE-03 | Phase 4: Upload Path | Pending |
| FILE-04 | Phase 4: Upload Path | Pending |
| FILE-05 | Phase 4: Upload Path | Pending |
| FILE-06 | Phase 4: Upload Path | Pending |
| FILE-07 | Phase 4: Upload Path | Pending |
| FILE-08 | Phase 4: Upload Path | Pending |
| FILE-09 | Phase 4: Upload Path | Pending |
| FILE-10 | Phase 4: Upload Path | Pending |
| FILE-11 | Phase 5: File CRUD | Pending |
| FILE-12 | Phase 5: File CRUD | Pending |
| FILE-13 | Phase 8: Drag-Drop Move & Filter | Pending |
| FILE-14 | Phase 5: File CRUD | Pending |
| VIEW-01 | Phase 6: PDF Viewer | Pending |
| VIEW-02 | Phase 6: PDF Viewer | Pending |
| VIEW-03 | Phase 6: PDF Viewer | Pending |
| VIEW-04 | Phase 6: PDF Viewer | Pending |
| VIEW-05 | Phase 6: PDF Viewer | Pending |
| VIEW-06 | Phase 6: PDF Viewer | Pending |
| VIEW-07 | Phase 6: PDF Viewer | Pending |
| TRASH-01 | Phase 7: Recursive Delete & Trash/Undo | Pending |
| TRASH-02 | Phase 7: Recursive Delete & Trash/Undo | Pending |
| TRASH-03 | Phase 7: Recursive Delete & Trash/Undo | Pending |
| TRASH-04 | Phase 7: Recursive Delete & Trash/Undo | Pending |
| TRASH-05 | Phase 7: Recursive Delete & Trash/Undo | Pending |
| TRASH-06 | Phase 7: Recursive Delete & Trash/Undo | Pending |
| UX-01 | Phase 9: Polish & Deploy | Pending |
| UX-02 | Phase 9: Polish & Deploy | Pending |
| UX-03 | Phase 9: Polish & Deploy | Pending |
| UX-04 | Phase 9: Polish & Deploy | Pending |
| UX-05 | Phase 9: Polish & Deploy | Pending |
| UX-06 | Phase 9: Polish & Deploy | Pending |
| UX-07 | Phase 9: Polish & Deploy | Pending |
| UX-08 | Phase 1: Bootstrap & Auth | Pending |
| UX-09 | Phase 9: Polish & Deploy | Pending |
| DEPLOY-01 | Phase 9: Polish & Deploy | Pending |
| DEPLOY-02 | Phase 9: Polish & Deploy | Pending |
| DEPLOY-03 | Phase 9: Polish & Deploy | Pending |
| DEPLOY-04 | Phase 9: Polish & Deploy | Pending |
| DEPLOY-05 | Phase 9: Polish & Deploy | Pending |
| DEPLOY-06 | Phase 9: Polish & Deploy | Pending |
| TEST-01 | Phase 2: Datarooms CRUD | Pending |
| TEST-02 | Phase 5: File CRUD | Pending |
| TEST-03 | Phase 7: Recursive Delete & Trash/Undo | Pending |
| TEST-04 | Phase 4: Upload Path | Pending |

**Coverage:**
- v1 requirements: 65 total (5 AUTH + 5 DR + 9 FOLD + 10 FILE-upload + 4 FILE-CRUD + 7 VIEW + 6 TRASH + 9 UX + 6 DEPLOY + 4 TEST)
- Mapped to phases: 65/65 ✓
- Unmapped: 0

**Phase distribution:**
- Phase 1 (Bootstrap & Auth): 6 REQs (AUTH-01..05, UX-08)
- Phase 2 (Datarooms CRUD): 6 REQs (DR-01..05, TEST-01)
- Phase 3 (Folder Tree & Breadcrumbs): 7 REQs (FOLD-01, FOLD-02, FOLD-03, FOLD-04, FOLD-06, FOLD-07, FOLD-08)
- Phase 4 (Upload Path): 11 REQs (FILE-01..10, TEST-04)
- Phase 5 (File CRUD): 4 REQs (FILE-11, FILE-12, FILE-14, TEST-02)
- Phase 6 (PDF Viewer): 7 REQs (VIEW-01..07)
- Phase 7 (Recursive Delete & Trash/Undo): 9 REQs (FOLD-05, FOLD-09, TRASH-01..06, TEST-03)
- Phase 8 (Drag-Drop Move & Filter): 1 REQ (FILE-13)
- Phase 9 (Polish & Deploy): 14 REQs (UX-01..07, UX-09, DEPLOY-01..06)

---
*Requirements defined: 2026-07-03; Traceability populated: 2026-07-03*
