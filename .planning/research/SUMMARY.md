# Project Research Summary

**Project:** Dataroom MVP (Virtual Data Room / Google Drive-like SPA)
**Domain:** Document management SPA + presigned-URL upload service (M&A due-diligence framing)
**Researched:** 2026-07-03
**Confidence:** HIGH

## Executive Summary

This is a Drive-like document management app framed as an M&A data room, with a locked stack (Vite React SPA + FSD + TanStack Router/Query + Zustand + Clerk on the frontend; Fastify + Drizzle + Postgres + MinIO on the backend, presigned-URL uploads throughout). The high-level architecture is not up for debate — the four research files translate it into concrete pins, feature scope, module boundaries, and the specific traps that will burn the 4-6h nominal budget if not planned around. Everything below informs a roadmap where the vertical slice (auth → dataroom → folder → upload → viewer) is proven end-to-end before polish, and where the presigned-upload flow is the single highest-risk feature.

The recommended approach is: bootstrap infra + Clerk in phase 1, prove one full CRUD slice (datarooms) in phase 2 to establish the ownership/optimistic/error patterns, then build folder CRUD → upload → file CRUD → PDF viewer → recursive delete → drag-drop/polish → deploy. Optimistic UI is woven in from phase 2 rather than retrofit at the end; the upload flow is deliberately non-optimistic and gets its own phase because it carries the four highest-cost failure modes (Content-Type signature mismatch, internal-hostname leak, MinIO CORS, two-S3Client separation). Testing is Tier 1 only (Fastify `.inject()` contract tests + `tsc`) unless the user opts in to a single Playwright smoke test.

Key risks that must be embedded as prevention steps in each phase's plan: (1) the presigned PUT ceremony has ~5 distinct ways to silently break — dedicated risk-first phase, (2) `packages/shared` resolution on Vercel from a pnpm workspace bites at first deploy — validate in phase 1, (3) Dokploy wipes the workdir on redeploy so all state must be named Docker volumes — bake into compose author phase, (4) React Query optimistic mutations without `cancelQueries` flicker on slow networks — template enforced in phase 2 and reused for every CRUD, (5) `react-pdf` worker fails in Vite prod builds if `?url` import is missing — verify with `pnpm preview` before deploy.

## Key Findings

### Recommended Stack

The stack is 90% locked. Research validates every locked choice against July 2026 reality, pins live-verified versions, and fills the five gaps the user left open (fetch client, PDF renderer, migration tooling, Fastify plugins, testing tier). Full detail lives in `.planning/research/STACK.md`.

**Final version pins for bootstrap (lock into `package.json` on day 1):**

Frontend (`apps/web`):
- React `^19.2.7` + React DOM `^19.2.7`
- Vite `^8.1.3` (Rolldown default) + `@vitejs/plugin-react-swc@^4.3.1`
- TypeScript `^5.8.x` (NOT 6.x — ecosystem lag on peer ranges)
- Tailwind `^4.3.2` + `@tailwindcss/vite` (CSS-first config, no `tailwind.config.ts`)
- `@tanstack/react-router@^1.170.x` + `@tanstack/react-query@^5.101.x`
- Zustand `^5.0.14`
- `@clerk/react@^6.11.3` — NOT `@clerk/clerk-react` (Clerk Core 3 renamed it March 2026; `<SignedIn>`/`<Protect>` → `<Show>`)
- `ky@^2.0.2` (fetch client — see open decisions)
- `react-pdf@^10.4.1` (do NOT install `pdfjs-dist` explicitly — pinned transitively at `5.4.296`)
- `@dnd-kit/core@^6.3.1` + `@dnd-kit/sortable@^10.0.0`
- `react-hook-form@^7.80.0` + `@hookform/resolvers@^5.4.0` + `zod@^4.4.3`
- `sonner@^2.0.7`, `clsx@^2.1.1`, `tailwind-merge@^3.6.0`, `class-variance-authority@^0.7.1`

Backend (`apps/api`):
- `fastify@^5.9.0` (v4 will not work with the zod provider)
- `fastify-type-provider-zod@^7.0.0` (peers: Fastify ≥5.5, Zod ≥4.1.5)
- `@fastify/cors@^11.2.0`, `@fastify/sensible@^6.0.4`, `@fastify/helmet@^13.0.2`, `@fastify/rate-limit@^11.1.0` (optional)
- `@clerk/backend@^3.10.0`
- `drizzle-orm@^0.45.2` + `drizzle-kit@^0.31.10` + `postgres@^3.4.9` (postgres-js driver, NOT `pg`)
- `@aws-sdk/client-s3@^3.10xx` + `@aws-sdk/s3-request-presigner@^3.10xx`
- `zod@^4.4.3` (Zod 3 will not work)
- Dev: `tsx`, `pino-pretty@^13.1.3` (dev-only), `vitest@^4.1.9`

Infra pins:
- Postgres `postgres:16-alpine`
- MinIO: **`pgsty/minio:latest` (community fork)** — NOT `minio/minio` (archived Oct 2025 → Feb 2026, console removed). See open decisions.
- pnpm `^9` or `^10`, Turborepo `^2`, Biome `^2.5.2`

**Actively AVOID (will bite on this stack):** `axios`, `redux`/`@reduxjs/toolkit`, `swr`, `react-router`, `pdfjs-dist` (explicit), `@fastify/multipart`, `@fastify/jwt`, `express`, `prisma`, `nodemon`, `ts-node`, `dotenv` runtime, `@clerk/clerk-react` (v5 legacy), `minio/minio` Docker image, `formik`, `styled-components`/`emotion`, `moment`/`dayjs`, `next/*` imports left in copied shadcn primitives.

### Expected Features

Full breakdown in `.planning/research/FEATURES.md`. This section is the **REQUIREMENTS.md v1 seed list**.

**Must-have (table stakes — MUST be in REQUIREMENTS.md Active):**
- Clerk sign-in (magic-link demo mode; frontend `@clerk/react@^6`, backend `@clerk/backend@^3`)
- Datarooms list page + create / rename / delete dataroom (delete = type-to-confirm modal)
- Nested folders per dataroom with collapsible sidebar tree + click-to-expand
- Breadcrumbs reflecting current folder path (URL is source of truth via TanStack Router)
- Right-click context menu + row-hover three-dot menu (shadcn `ContextMenu` + `DropdownMenu`)
- Inline rename on double-click / F2 (Escape cancels, Enter commits, auto-select basename)
- Create folder (inline row in edit mode, not modal)
- Delete file / empty folder (no modal); delete non-empty folder (modal with descendant count); delete dataroom (type-to-confirm)
- File upload via drag-drop from desktop + button (direct-to-MinIO presigned PUT, three-step ceremony: init → PUT → complete)
- **Same-name conflict modal: Replace / Keep both / Cancel** (Dropbox pattern — TASK.md explicitly calls this edge case out)
- Upload progress bar per file (real XHR progress, not fake CSS), Retry button on failure, pending row survives errors
- In-app PDF viewer (`react-pdf` with custom toolbar: prev/next, jump-to-page, zoom levels, fit-width, download, fullscreen optional)
- File rename / delete / move
- Empty states for: no datarooms, empty dataroom, empty folder — each with primary CTA
- Skeleton loading for lists and viewer (NEVER a whole-view spinner)
- Error states for network / 5xx / 403 / 404 (shadcn `Alert` inline + `sonner` toast for mutations)
- Confirmation dialog for cascade delete (shows count of files/folders that will be removed)
- Optimistic UI for create/rename/delete/move (with `cancelQueries` + rollback); NOT for upload
- Baseline keyboard shortcuts: `Enter` (open), `F2` (rename), `Delete` (delete), `Escape` (cancel/close)
- Dark mode toggle (free from template)
- Deployed: frontend on Vercel, backend + Postgres + MinIO on Dokploy compose, LE certs via Traefik
- README with design decisions, live URL, sign-in flow, screenshots

**Should-have (differentiators, ranked by value/hour — ship if budget allows):**
1. Client-side filename filter (search box, 30 min)
2. Prefetch folder children on hover in tree
3. Drag files from desktop directly onto folder in tree
4. Sort by name / date / size (column header click)
5. Multi-file upload progress toast (Sonner custom content)
6. First-page PDF thumbnails on file rows (client-generated after upload) — see open questions
7. Keyboard shortcut cheat sheet (`?`)
8. Multi-select + bulk delete
9. Recently viewed / recently uploaded row

**Explicit anti-features / SKIP list (drives REQUIREMENTS.md "Out of Scope" section — DO NOT add these):**
- Multi-tenancy, sharing, invites, permissions, team collaboration
- Full-text search inside PDFs (client filename filter is enough)
- Non-PDF file types (mime enforced at `/files/init`)
- Watermarks / audit log / Q&A / expiration / DRM (multi-day VDR features)
- Trash / soft-delete with Undo (hard-delete with confirmation is more honest for MVP)
- Real-time / websockets (single-user scope)
- Onboarding tutorial / product tour
- Marquee (drag-select) multi-select
- First-letter navigation (Drive-style)
- Grid/list view toggle
- Folder emoji/color picker
- Duplicate file/folder actions
- SSR / SEO (content behind auth)
- Decorative route/page transitions (kills perceived speed — TASK.md scoring priority #1)
- Global spinner overlay on mutations (breaks optimistic UX)
- Modal for rename or create folder (inline is table stakes)
- Server-rendered PDF thumbnails (only client-side lazy generation is on the table)
- Native `alert()` / `confirm()` / `prompt()` anywhere in the app
- Preview panel for non-PDF files
- Password reset / email verification UI (Clerk owns these)
- Theme preset picker (dark/light only)
- Custom `@fastify/multipart` upload path (bytes never touch Fastify)

### Architecture Approach

Full detail in `.planning/research/ARCHITECTURE.md`. The high-level shape is locked in `PROJECT.md`; the research file supplies the concrete FSD boundaries, Fastify module split, upload state machine, and build order.

**Major components:**

1. **`apps/web/` — Vite SPA with FSD layers**
   - `app/` — providers + router + global styles
   - `pages/` — thin route components (params → widgets)
   - `widgets/` — `<DataroomHeader>`, `<FolderTree>`, `<FileGrid>`, `<FileViewer>`, `<UploadDropZone>`, `<Breadcrumbs>`
   - `features/` — one user use case per folder: `create-dataroom`, `delete-dataroom`, `create-folder`, `rename-folder`, `delete-folder`, `move-folder`, `upload-file`, `rename-file`, `delete-file`, `move-file`
   - `entities/` — `dataroom`, `folder`, `file` — React Query **queries** live here (mutations live in features)
   - `shared/` — `ui/` (46 shadcn primitives, Next-isms stripped), `api/` (ky wrapper + `ApiError` + XHR upload helper), `lib/`, `hooks/`, `config/` (Zod-validated `env`, `queryClient` factory), `errors/`

2. **`apps/api/` — Fastify with plugin/route/service/db split**
   - `plugins/` — `clerk-auth`, `zod-provider` (validator AND serializer), `cors`, `error-handler`
   - `hooks/` — `ownership` factory (`assertOwnsFolder(paramName)`) attached as `preHandler` on mutating routes
   - `routes/` — grouped by resource: `datarooms/`, `folders/`, `files/` (~15 endpoints in 9 files)
   - `services/` — `dataroom.service`, `folder.service` (incl. `deleteFolderCascade`), `file.service`, `ownership.service`, **`storage.service` (owns both S3Clients — internal + public)**
   - `db/` — `client.ts` (drizzle singleton), `schema.ts` (single file), `queries/` (typed query fns; recursive CTE for cascade delete)
   - `config/env.ts` — Zod-validated env at boot

3. **`packages/shared/` — Zod schemas + inferred DTOs + typed error codes**
   - `schemas/` — `dataroom.ts`, `folder.ts`, `file.ts`, `common.ts`
   - `errors.ts` — `ErrorCode` string-literal union, `ApiErrorShape`
   - **Source-only exports** (`"exports": { ".": "./src/index.ts" }`) — no build step; Vite bundles it. Add `"workspace:*"` reference in both apps' `package.json`. Vercel config: Root Directory `apps/web`, install/build via `cd ../.. && pnpm ...`.

4. **Data flow — the four critical paths**
   - Upload three-step: `/files/init` (validate + insert pending row + presign PUT via **public** S3Client) → browser XHR PUT direct to MinIO with progress → `/files/{id}/complete` (`HeadObject` via **internal** S3Client + set status='ready')
   - Folder tree render: `GET /datarooms/:id/tree` returns root-level stubs with `childFolderCount`; expand fires `useFolderChildren(id)`; prefetch on hover
   - Recursive delete: recursive CTE collects descendant `s3_key`s first → `DELETE FROM folders` (FK CASCADE removes rows) → best-effort `deleteObjectsBatch` (log MinIO failures, don't fail HTTP)
   - State ownership: React Query = server state (datarooms, folders, files); Zustand = client-only (selection, active uploads keyed by fileId, tree expand state per dataroom, theme); component `useState` = dialog open flags; TanStack Router = route params

### Critical Pitfalls

Full catalog of 27 pitfalls in `.planning/research/PITFALLS.md`. These are the ones with highest recovery cost or most-frequent occurrence — they MUST be embedded as prevention steps in each phase's plan.

1. **MinIO presigned PUT 403 SignatureDoesNotMatch on Content-Type mismatch** (upload phase). Pick ONE strategy: sign without `ContentType` AND omit it on PUT, OR sign with `application/pdf` AND set exact `Content-Type: application/pdf` on XHR. Same rule for `ContentLength` and any `x-amz-meta-*` header. Bake into `storage.service.ts` + `xhr-upload.ts` together.

2. **Presigned URL leaks internal Docker hostname (`http://minio:9000`) to the browser** (backend + upload phases). Two `S3Client` instances from day 1 (`s3ForPresign` public, `s3ForServerOps` internal); enforce that only `publicS3` is exported for `getSignedUrl`. `forcePathStyle: true` on both. In dev both endpoints point at `localhost:9000` — same code path.

3. **MinIO CORS misconfigured** (deploy phase, but dev variant in P1). MinIO ignores AWS-style bucket `cors.xml`. Set `MINIO_API_CORS_ALLOW_ORIGIN` on the server container in BOTH `docker-compose.dev.yml` and `docker-compose.prod.yml`. Test with `curl -X OPTIONS` before writing UI code. Expose `ETag`. Pin the MinIO tag (see open decisions).

4. **Fastify Zod serializer missing** (backend phase). `setValidatorCompiler` alone silently accepts extra response fields. Must also `setSerializerCompiler` AND `withTypeProvider<ZodTypeProvider>()`. Every route declares `body`/`params`/`querystring` AND `response: { 200: ... }`. Avoid `.transform()` in response schemas — map in handler.

5. **Drizzle FK missing `{ onDelete: 'cascade' }`** (backend schema phase). `references(() => folders.id)` alone does NOT create ON DELETE CASCADE. Must pass `{ onDelete: 'cascade' }` explicitly (folder→file, dataroom→folder, self-ref folders.parentId). Verify generated SQL contains `ON DELETE CASCADE`.

6. **Optimistic mutation race without `cancelQueries`** (CRUD phase). Standard template MUST be `await queryClient.cancelQueries` FIRST, then snapshot, then set cache, then rollback on error, then invalidate on settled. Enforced identically across all four CRUD features (rename, delete, create, move) — establish once in phase 2.

7. **TanStack Router loader misuse** (frontend shell phase). `ensureQueryData` only fetches if cache empty — does NOT revalidate on navigation. Wire `context={{ queryClient }}` at router creation, parallelize loader fetches with `Promise.all`, use the SAME query options factory in loader and component's `useSuspenseQuery`, invalidate via `queryClient.invalidateQueries` after mutations (not `router.invalidate()`), set `defaultPreload: 'intent'`.

8. **Unstable React Query key** (frontend shell phase). Enforce key factory pattern with primitives only. No inline objects, no `new Date()`, no computed identity. React Query devtools in dev.

9. **`packages/shared` fails to resolve on Vercel** (bootstrap + deploy phases). Source-only exports pattern, `"workspace:*"` in both apps, Vercel Root Directory = `apps/web`, install/build = `cd ../.. && pnpm --filter web build`. Verify with `rm -rf node_modules && pnpm install && pnpm --filter web build` locally before first deploy.

10. **`react-pdf` worker fails in Vite prod build** (viewer phase). Configure at module top level: `import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'; pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker`. Do NOT wrap the viewer file in `React.lazy` initially. Test with `pnpm --filter web build && pnpm --filter web preview` BEFORE Vercel deploy — this bug only surfaces in prod build.

11. **Cached Clerk token → 401 after 60s** (frontend shell phase). Session tokens are 60s. `getToken()` MUST be called fresh on every API request. Never store in Zustand. Wrap ky in a hook that closes over `useAuth().getToken`. On 401, refresh + retry once.

12. **Dokploy wipes workdir on redeploy** (deploy phase). All stateful services (Postgres, MinIO) MUST use **named Docker volumes**, never bind mounts to workdir. All env goes through Dokploy UI. Verify with `docker volume ls` after first redeploy.

13. **Upload cancel leaks pending DB rows + MinIO orphans** (upload phase). Cancel button must abort XHR + DELETE `/files/:fileId` + remove UI row. Backend `DELETE` silently succeeds on `HeadObject` 404 for pending rows. Partial unique index `WHERE status = 'ready'` on `(folderId, name)` so pending rows don't block reuploads.

14. **Race on `UNIQUE(folderId, name)` for concurrent same-name uploads** (upload phase). Backend catches PG error code `23505` → 409 `FILE_NAME_TAKEN`. Frontend routes 409 into the same rename/overwrite dialog as the "already exists" case.

15. **`VITE_` prefix forgotten** (bootstrap phase). Every client env var is `VITE_*`. Zod-validate `import.meta.env` at boot in `shared/config/env.ts`. Static access only (never dynamic key).

## Implications for Roadmap

Phase decomposition is driven by ARCHITECTURE.md's build order plus PITFALLS.md's prevention-phase mapping. **Vertical slice first, then breadth, then polish.** The critical anti-recommendation: do NOT build the full backend first, then the frontend — if a CORS/presign/JWT bug surfaces at hour 4, there is no polish time left. Prove the critical path in phase 1, prove the ownership+optimistic template in phase 2, then repeat the shape across folders/files/upload/viewer.

### Phase 1: Bootstrap + Critical Path

**Rationale:** Every downstream phase assumes monorepo boots, compose is up, Clerk auth works end-to-end, and `packages/shared` resolves in Vite. Proving these in phase 1 (before feature work) de-risks pitfalls #9, #11, #12, #15 up front.
**Delivers:** Monorepo (pnpm + Turborepo + Biome) with `apps/web`, `apps/api`, `packages/shared`. Vite SPA boots with Clerk provider + TanStack Router shell + Zod-validated env. Fastify boots with Clerk plugin, zod-provider (validator AND serializer), CORS, error handler. `docker-compose.dev.yml` runs Postgres + MinIO (CORS pre-configured for `http://localhost:5173`). `GET /health` returns `userId` when called with a signed-in browser token. Empty datarooms list page renders behind auth guard.
**Uses:** All version pins locked from STACK.md. Source-only `packages/shared` exports.
**Prevents (from PITFALLS):** #9 Vercel resolution (dry-run local build), #11 Clerk token freshness (ky wrapper hook), #12 Dokploy workdir (not yet touched — but compose author already knows named volumes), #15 VITE_ prefix (Zod boot check).

### Phase 2: Dataroom CRUD (first vertical slice — establishes patterns)

**Rationale:** Cheapest end-to-end proof of the ownership hook + typed error codes + optimistic mutation template + shared Zod schemas + React Query key factory. Every downstream CRUD feature is a repeat of this shape, so getting the template correct here is highest leverage.
**Delivers:** Drizzle schema for `Dataroom` (owner FK to Clerk userId). `POST /datarooms`, `GET /datarooms`, `PATCH /datarooms/:id`, `DELETE /datarooms/:id`. Ownership `preHandler` factory. Frontend datarooms list page + create dialog + rename inline + delete-with-type-to-confirm. Optimistic create/rename/delete with rollback template (`cancelQueries` → snapshot → set → onError rollback → onSettled invalidate). `sonner` toasts on error only.
**Uses:** `drizzle-orm@^0.45.2`, `drizzle-kit@^0.31.10` (push mode for solo prototyping — see architecture), `fastify-type-provider-zod@^7`, `@clerk/backend@^3.10`, `ky@^2.0.2`, TanStack Query mutations from features/, queries from entities/.
**Prevents:** #4 Zod serializer (route response schemas from day 1), #6 optimistic race (template with `cancelQueries`), #8 unstable key (factory pattern), pitfall #22 (all confirmations use shadcn `AlertDialog`, no `alert()`).

### Phase 3: Folder CRUD + Tree + Breadcrumbs

**Rationale:** Files need folders to live in. Folder tree must render before files can be shown. Repeats the optimistic template from phase 2.
**Delivers:** Drizzle schema for `Folder` with `parentId` self-ref (BOTH FKs use `{ onDelete: 'cascade' }`). `POST/PATCH/DELETE /folders`, `GET /folders/:id/children`, `GET /folders/:id/breadcrumb`, `GET /datarooms/:id/tree` (root children only, with `childFolderCount`). `<FolderTree>` widget with lazy-expand + prefetch-on-hover. `<Breadcrumbs>` widget. `<FileGrid>` renders folder rows only (no files yet). Inline create/rename, delete-non-empty modal (with descendant count preview).
**Uses:** TanStack Router file-based routes for `/datarooms/$dataroomId/folders/$folderId?`, folder tree expand state in Zustand (persisted per dataroom).
**Prevents:** #5 missing FK cascade (verified in generated SQL), #10 folder tree N+1 (flat-list + client-side tree build for MVP), #7 stale after mutation (invalidate + `useSuspenseQuery` factory shared with loader).

### Phase 4: Upload Path — the risky one (Phase-of-highest-risk)

**Rationale:** This is the single highest-risk feature. Four of the five critical pitfalls concentrate here. If CORS/presign/hostname/Content-Type fails, must uncover it now, not at hour 5. Do BEFORE the viewer and BEFORE recursive delete.
**Delivers:** `POST /files/init` (validate mime = `application/pdf`, size ≤ 50 MB, insert pending row, presign PUT via `publicS3` with 15-min TTL). `POST /files/:id/complete` (`HeadObject` via `internalS3`, set status='ready', idempotent with 3× exponential-backoff retry from client). `File` schema with partial unique index `WHERE status = 'ready'` on `(folderId, name)`. `storage.service.ts` with two S3Clients (`s3ForPresign` + `s3ForServerOps`), `forcePathStyle: true`. `xhr-upload.ts` wrapper with real progress events. `<UploadDropZone>` widget (page-level drop overlay). Per-row pending UX in Zustand (never in React Query cache). Retry button on failure. Cancel button (abort XHR + DELETE row + best-effort S3 delete). **Same-name conflict modal (Replace / Keep both / Cancel)** — Dropbox pattern; 409 from init flows into same dialog. MinIO CORS configured in `docker-compose.dev.yml` (verified with `curl -X OPTIONS` before writing UI).
**Uses:** `@aws-sdk/client-s3@^3.10xx` + `@aws-sdk/s3-request-presigner@^3.10xx`.
**Prevents:** #1 Content-Type sig mismatch (pick strategy, pin), #2 hostname leak (two clients enforced by import), #3 CORS (dev compose + curl verify), #4 URL expiry (15 min TTL), #13 cancel orphans (full abort/delete flow), #14 concurrent same-name (23505 → 409 → dialog).

### Phase 5: File CRUD (rename, delete, move, download-url)

**Rationale:** Symmetric with folder CRUD. Reuses the optimistic template established in phase 2. Independent of viewer — can run in parallel with phase 6 mentally, but files need to exist for the viewer.
**Delivers:** `PATCH /files/:id`, `DELETE /files/:id`, `GET /files/:id/download-url` (1h TTL). File row three-dot menu + right-click context menu. Optimistic rename/delete/move. Confirmation modal for delete? — NO for file (immediate hard delete with toast), YES for non-empty folder (already in phase 3).
**Uses:** Same patterns as phase 2/3.
**Prevents:** #6 (reused template), reviewer traps #22 (AlertDialog only, no native prompts).

### Phase 6: PDF Viewer

**Rationale:** Depends on files existing. Isolated from other flows. Has its own concentrated pitfall set (worker config, memory leaks).
**Delivers:** `<FileViewer>` widget using `react-pdf@^10.4.1` (do NOT install `pdfjs-dist` explicitly). Worker configured at module top level with `?url` import. Custom toolbar: prev/next page, jump-to-page, zoom presets (50-200% + fit-width + fit-page), download button, fullscreen (optional). Route-panel or modal — recommend modal for closing back to file grid without route replace. Page-at-a-time render (NOT continuous scroll — matches Drive/Adobe). Text layer + selection ON by default. Stable memoized `file` prop.
**Uses:** `react-pdf@^10.4.1`.
**Prevents:** #10 worker fail in prod build (module-top config + `pnpm preview` verification), #14 memory leak (explicit `PDFDocumentProxy.destroy()` on unmount + page-at-a-time rendering + QA check with 5 PDFs).

### Phase 7: Recursive Folder Delete + Cascade Cleanup

**Rationale:** Depends on files existing (cascade must clean up their MinIO objects). Not on critical UX flow, so lands after upload+viewer.
**Delivers:** `folder.service.deleteCascade()` with `WITH RECURSIVE` CTE that collects descendant `s3_key`s FIRST, then `DELETE FROM folders` (FK CASCADE removes rows), then best-effort `deleteObjectsBatch` on MinIO (log failures, don't fail HTTP). Confirmation modal shows real count of descendants ("Delete 'Q3 Financials' and its 12 files and 3 folders?"). Move endpoint validates target is not descendant of source (cycle prevention). DnD `canDrop` runs same check for immediate visual feedback.
**Uses:** Raw Drizzle SQL for the recursive CTE.
**Prevents:** #15 recursive tree crash (backend validation + tree depth cap + `Set`-based visited check).

### Phase 8: Move (drag-and-drop) + Client-Side Name Filter

**Rationale:** Nice-to-have polish. Optimistic move (frontend widget + `@dnd-kit`). Filename filter is 30 min for zero-latency perceived speed. Low risk, high polish value.
**Delivers:** `@dnd-kit` drop targets on tree nodes and folder rows. Optimistic move-folder + move-file mutations. Drag ghost via `DragOverlay`. Client-side filename filter input in `<DataroomHeader>` (Fuse or naive `includes`).
**Uses:** `@dnd-kit/core@^6.3.1`, `@dnd-kit/sortable@^10` (if row reorder shipped).
**Prevents:** UX pitfalls #24 (drag ghost visible), #15 (cycle guard on move).

### Phase 9: Polish + README + Deploy

**Rationale:** Deploy last so the final hour is polish, not env-var debugging on a live host. Every reviewer trap (pitfalls #21–27) is audited here even though patterns were established earlier.
**Delivers:** Skeleton audit (no whole-view spinners anywhere), empty state audit (every list has one), error state audit (every route has `errorComponent`, every widget has inline error card + Retry, global error boundary), keyboard nav audit (Tab, arrow, Escape all work; dialogs trap focus), seed script with realistic M&A data ("Project Nightingale — Acme × Hooli", "01 Financial Statements", etc. — NOT "test folder 1"), README with design decisions + live URL + setup + sign-in flow for reviewer + screenshots. Vercel deploy (Root Directory `apps/web`, install/build `cd ../.. && pnpm ...`, env `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_URL`). Dokploy deploy of `docker-compose.prod.yml` (named volumes for Postgres + MinIO, Traefik LE certs, MinIO CORS with prod origin). Cloudflare A-records grey-cloud for LE HTTP-01, optionally proxied after certs stable.
**Uses:** All pinned versions unchanged.
**Prevents:** #12 Dokploy state wipe (named volumes), #3 prod CORS (mirror dev config with prod origin), #10 `react-pdf` prod build (`pnpm preview` before deploy), and all reviewer traps #21-#27.

### Phase Ordering Rationale

- **Vertical slice before breadth:** Phase 1 proves infra, phase 2 proves patterns end-to-end — every downstream phase repeats phase 2's shape (schema → route → service → hook → optimistic mutation → view). Establishing the template correctly is worth its own phase.
- **Upload before viewer:** Upload carries 4 of the 5 highest-risk pitfalls (Content-Type, hostname, CORS, expiry) — must uncover in phase 4, not at hour 5. Viewer has its own concentrated pitfall set but can only be built once files exist.
- **Recursive delete after viewer:** Cascade cleanup needs files to exist. Not on critical UX path (single file delete works after phase 5), so lands after viewer.
- **Move + filter before deploy:** These are polish that live behind existing routes; deploying with them included is the same as deploying without. Better to add during phase 8 while still in dev.
- **Deploy LAST:** Every deploy pitfall (#3 CORS, #9 shared package, #10 react-pdf prod, #12 Dokploy state) is easier to fix in dev; verify local build with `pnpm preview` before Vercel push.

### Research Flags

Phases likely needing deeper research via `/gsd:research-phase` during planning:

- **Phase 1 (Bootstrap):** LOW research need. Standard scaffolding; STACK.md pins are exhaustive. Only flag: verify Clerk `@clerk/react@^6` Vite integration snippets in the current quickstart docs (Clerk Core 3 is <4 months old as of research date).
- **Phase 4 (Upload):** HIGH research need. Content-Type strategy pin, MinIO CORS syntax variants across image tags, XHR wrapper edge cases (abort semantics, progress event throttling), presigned URL header order. Recommend `/gsd:research-phase` to verify the chosen fork's CORS env vars and the `@aws-sdk/s3-request-presigner` signed-header behavior against a working test upload.
- **Phase 6 (PDF Viewer):** MEDIUM research need. `react-pdf@10` + Vite worker config has moved between minor versions — verify current `?url` import path against react-pdf 10.4.x source. Memory leak mitigation via explicit `.destroy()` needs verification against current API.
- **Phase 9 (Deploy):** MEDIUM research need. Vercel monorepo config for pnpm workspaces has drifted; Turborepo Vercel integration might handle it automatically. Dokploy compose-mode env var handling. MinIO fork's compose env vars vs upstream.

Phases with standard patterns (skip research-phase):

- **Phase 2 (Dataroom CRUD):** Standard React Query optimistic template + Fastify + Drizzle. All patterns documented in ARCHITECTURE.md.
- **Phase 3 (Folder CRUD):** Same as phase 2 plus flat-list-to-tree pattern (documented).
- **Phase 5 (File CRUD):** Same patterns as phase 2/3.
- **Phase 7 (Recursive Delete):** Recursive CTE is a well-known pattern; example query is in ARCHITECTURE.md.
- **Phase 8 (DnD + Filter):** Standard `@dnd-kit` patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions live-verified against npm registry on 2026-07-03; peer ranges cross-checked; four locked-in choices validated against July 2026 reality; four gap-fills chosen with explicit alternative comparison. |
| Features | HIGH | Drive/Dropbox/Box UX conventions are well-documented and personally-used; VDR-specific features explicitly identified as SKIP (backed by TASK.md scope reading); same-name behavior surveyed across 6 products. MEDIUM sub-confidence on enterprise VDR baseline (Firmex/Datasite) — used marketing sites, not personal use, but this only affected the anti-features list which is aligned with the user's scope. |
| Architecture | HIGH | High-level shape locked in `PROJECT.md`; research supplies concrete FSD boundaries, Fastify module split, and upload state machine — all verified against AWS presigner docs, Drizzle CTE guidance, TanStack Router + Query integration docs, and Clerk Fastify plugin reference. |
| Pitfalls | HIGH | 27 pitfalls each cited against official docs or upstream GitHub issues; 4 reviewer-taste items marked MEDIUM (they are opinion territory, but consistent across senior-frontend feedback patterns). Phase-mapping matrix at end of PITFALLS.md is unambiguous. |

**Overall confidence:** HIGH.

### Gaps to Address (Open Decisions & Questions)

**Open decisions from STACK.md — block phase planning; need user confirmation before Phase 1 finalization:**

1. **Clerk package name.** Confirm switch to `@clerk/react@^6` (Core 3, March 2026) instead of legacy `@clerk/clerk-react@v5`. Recommended: yes — greenfield project, no migration cost, `<Show>` component is the new pattern.
2. **MinIO Docker image.** Confirm `pgsty/minio:latest` (community fork with restored console) instead of pinning `minio/minio:RELEASE.2025-09-07T16-13-09Z` (last stable before archive). Recommended: `pgsty/minio` for a real product path; pinned upstream acceptable if fork feels risky.
3. **Fetch client.** Confirm `ky@^2.0.2` (recommended) vs `@better-fetch/fetch` (Zod-inferred response types, smaller ecosystem). Recommended: `ky` for MVP maturity.
4. **Testing tier.** Tier 1 only (`tsc` + Fastify `.inject()` contract tests — ownership rejects cross-user, UNIQUE → 409, recursive delete, upload state machine, ~30 min total) vs Tier 1 + Tier 2 (add one Playwright smoke test, ~45 min).

**Open questions from PITFALLS.md — verify during execution:**

1. `@dnd-kit` drag performance under many rows — verify Phase 8 with realistic seed data.
2. MinIO tag pinning strategy — verify Phase 9 deploy; don't use `latest` in prod.
3. Clerk magic-link on custom domain `dataroom.holy-water.app` — verify Phase 9.
4. `react-pdf` + `pdfjs-dist` version pair drift — verify before Phase 6 build.

**Open questions from FEATURES.md — need user confirmation:**

1. Trash / soft-delete vs hard-delete with confirmation. Recommendation: hard-delete + confirmation modal for cascade only.
2. PDF thumbnails on file rows. Recommendation: skip for v1, add if budget allows.
3. File viewer route vs modal. Recommendation: modal (preserves scroll position).
4. Multi-file same-name conflict UI (Explorer-style "Apply to all"). Recommendation: single-file case only for v1.

## Sources

Primary (HIGH confidence): live npm registry (2026-07-03), Clerk Core 3 changelog + docs, TanStack Router + Query official docs, TkDodo blog, MinIO GitHub releases + issues, react-pdf npm + issues, AWS SDK v3 docs + AWS re:Post, Drizzle docs, Fastify docs, Vite docs, Vercel monorepo docs, project's own `PROJECT.md` + `CLAUDE.md` + `TASK.md`.

Secondary (MEDIUM confidence): pgsty/minio blog + DevPro alternatives writeup, MinIO CORS GitHub issues, react-pdf worker+Vite issues, VDR marketing sites (Firmex/Datasite/Orangedox — used only to identify anti-features), NN/g breadcrumbs, Google Drive shortcut docs, Frontend Joy React red flags.

Tertiary (LOW confidence): `@better-fetch/fetch` maturity, Dokploy compose semantics beyond user's operational notes.

---
*Research completed: 2026-07-03*
*Ready for roadmap: yes*
