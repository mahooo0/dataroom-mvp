# Dataroom MVP

Take-home coding challenge from Acme Corp. Build a Data Room (Google Drive / Dropbox-like) for M&A due diligence: securely store and organize PDF documents in a virtual repository.

Full spec: `TASK.md`

---

## Priorities (from TASK.md, in strict order)

1. **UX and functionality** — intuitive flows, all edge cases, error states
2. **Design and polish** — clean, no unimplemented features surfaced in UI
3. **Code quality and readability**

Every architectural decision is weighed against: *does this improve UX, or does it eat time we could spend on polish?*

---

## Repo layout (monorepo)

```
dataroom-mvp/
├── .reference/                              ← gitignored, template clone for UI copy-paste
│   └── next-shadcn-admin-dashboard/         ← https://github.com/mahooo0/next-shadcn-admin-dashboard
│
├── apps/
│   ├── web/                                 ← Next.js frontend → Vercel
│   └── api/                                 ← Fastify backend → Dokploy VPS
│
├── packages/
│   └── shared/                              ← Zod schemas + inferred TS types (DTOs, models)
│
├── docker/
│   └── docker-compose.dev.yml               ← local Postgres + MinIO
│
├── docker-compose.prod.yml                  ← Dokploy deploys this
├── pnpm-workspace.yaml
├── turbo.json
└── TASK.md
```

**Package manager:** pnpm. **Build orchestrator:** Turborepo.

---

## Stack

### Frontend (`apps/web`) — deploy: Vercel

- **Vite + React 19 + TypeScript.** Pure SPA. No Next.js, no SSR, no RSC. All data behind Clerk auth so SEO is irrelevant.
- **TanStack Router** — type-safe routing, native prefetch integration with React Query cache.
- Tailwind 4 + shadcn/ui (46 primitives copied from `.reference/`)
- Animate UI — **selective use only** (drag/drop feedback, tree expand). NOT a decorative motion layer. Data Room is a productivity tool; it must FEEL fast, not animated.
- `@tanstack/react-query` — all server state
- Zustand — client-only state (UI selections, drag session, preferences). Never store server data here.
- `@clerk/react@^6` — Clerk Core 3 (March 2026 rename). NOT `@clerk/clerk-react` (v5 legacy). Use `<Show when="...">` instead of the deprecated `<SignedIn>`/`<SignedOut>`/`<Protect>`. Demo mode uses magic-link so reviewer can sign in without a pre-shared account.
- `ky@^2` — fetch client. Throws on non-2xx (plays well with React Query). Wrap in a hook that injects `useAuth().getToken()` per request (never cache the token — 60s TTL).
- `react-pdf@^10` (pdf.js) — in-app PDF viewer. Do NOT install `pdfjs-dist` directly — it is transitively pinned. Worker via `?url` import at module top.
- `@dnd-kit` — file/folder drag and drop, drop-zone uploads
- `react-hook-form` + `zod@^4` — dialogs (rename, create folder, upload). Zod 4 required by `fastify-type-provider-zod@7`.
- `sonner` — toasts for mutation errors; also hosts the 5-second Undo pattern for soft-deletes.
- Biome — lint + format (already configured in template)

**Build:** `vite build` → static `dist/`. Vercel serves it from global edge.

### Backend (`apps/api`) — deploy: Dokploy Docker compose on VPS

- `fastify@^5` + TypeScript. NOT v4 — `fastify-type-provider-zod@7` requires ≥5.5.
- `@clerk/backend@^3` — JWT verification middleware on protected routes
- `drizzle-orm@^0.45` + `drizzle-kit@^0.31` — Postgres schema + migrations. Use `push` for solo prototyping, `generate`+`migrate` after first prod deploy. Postgres driver: `postgres@^3` (postgres-js), NOT `pg`.
- `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` — MinIO client (S3 API compatible)
- Zod schemas from `packages/shared` for request/response validation via `fastify-type-provider-zod@^7`. Must configure BOTH validator AND serializer compilers, and `withTypeProvider<ZodTypeProvider>()`.
- Pino logs (Fastify default). `pino-pretty` dev-only.

### Data layer

- **Postgres 16** — metadata store, container in same compose. Not exposed externally.
- **MinIO** — file bytes, container in same compose. Exposed via `minio.dataroom.holy-water.app`. Image = **`pgsty/minio`** community fork (upstream `minio/minio` was archived Oct 2025 → Feb 2026 and console removed). Pin to a specific tag, never `latest` in prod.
- **Local dev:** `docker-compose.dev.yml` spins both up on one command; identical S3 API in dev and prod.

---

## Data model

```
Dataroom(id, name, ownerId /* Clerk user */, createdAt, deletedAt nullable)
Folder(id, dataroomId, parentId nullable, name, createdAt, updatedAt, deletedAt nullable)
  UNIQUE(dataroomId, parentId, name) WHERE deletedAt IS NULL
File(id, folderId, name, mimeType, sizeBytes, s3Key, status, createdAt, updatedAt, deletedAt nullable)
  UNIQUE(folderId, name) WHERE status = 'ready' AND deletedAt IS NULL
  status ∈ {pending, ready, failed}
```

- **Soft-delete via `deletedAt`**. Hard-delete happens only on "Delete permanently" from Trash view. All list/tree/grid queries filter `WHERE deletedAt IS NULL` by default.
- FK CASCADE (`{ onDelete: 'cascade' }` on every Drizzle relation) covers the hard-delete path from Trash; cascade soft-delete is implemented in service code by walking descendants and stamping `deletedAt` in a transaction.
- Every FK Drizzle relation MUST pass `{ onDelete: 'cascade' }` explicitly — `references(() => folders.id)` alone does NOT create ON DELETE CASCADE.
- **Partial unique index** — pending upload rows must not block a re-upload with the same name, and soft-deleted rows must not block name reuse.
- UNIQUE conflict on Folder or File returns HTTP 409 with typed error code (`FOLDER_NAME_TAKEN` / `FILE_NAME_TAKEN`); frontend shows the Replace / Keep both / Cancel modal.
- `parentId IS NULL` means the folder sits at the root of the dataroom.
- `s3Key` format: `{ownerId}/{dataroomId}/{fileId}.pdf` — deterministic, prevents path traversal.

## Delete UX (soft-delete + Trash + Undo)

- Every delete (dataroom, folder, file) is soft — stamps `deletedAt`.
- Immediately after any delete mutation, a `sonner` toast shows `Deleted [name]` with an **Undo** button active for 5 seconds. Undo restores `deletedAt = NULL` on the exact resource; for folder deletes, cascade undo restores all descendants deleted in the same operation (batch by `deletedAt` timestamp).
- A **Trash view** (linked from datarooms list header and dataroom header) lists soft-deleted items with **Restore** and **Delete permanently** actions. "Delete permanently" removes the DB row (FK CASCADE takes descendants) AND deletes the underlying MinIO objects (best-effort batch — log failures, don't fail HTTP).
- Confirmation dialogs (shadcn `AlertDialog`) still gate: (a) delete non-empty folder — modal shows real descendant count preview; (b) delete dataroom — type-to-confirm modal. All other deletes are single-click optimistic + Undo.

---

## Upload / download flow (critical to get right)

**Upload — direct-to-MinIO via presigned PUT:**

1. `POST /files/init` `{ folderId, name, mimeType, size }` → Fastify validates ownership, mime = `application/pdf`, size ≤ 50 MB. Inserts File row `status='pending'`. Returns `{ fileId, uploadUrl, s3Key }`. **TTL of `uploadUrl` = 15 min** (long enough for big files on slow connections).
2. Browser `PUT uploadUrl` with the file bytes directly to MinIO — via XHR for real progress events (fetch has no upload progress). Cancel button aborts XHR + `DELETE /files/:id`.
3. `POST /files/{fileId}/complete` → Fastify `HeadObject` verifies the blob exists, updates `status='ready'`, returns final file record. Client retries this endpoint 3× with exponential backoff (idempotent).

**Download / preview — presigned GET:**

1. `GET /files/{fileId}/download-url` → Fastify returns `{ url }`, TTL 1h.
2. Browser hits URL directly, react-pdf renders from it. If it 403s (expired), refetch and retry.

**Backend must NEVER handle file bytes.** Only metadata.

**Two S3 endpoints in production:**
- `S3_ENDPOINT_INTERNAL=http://minio:9000` — Fastify internal ops (HeadObject, DeleteObject) via Docker network.
- `S3_ENDPOINT_PUBLIC=https://minio.dataroom.holy-water.app` — hostname baked into presigned URLs the browser hits.

Two `S3Client` instances in code. In dev both point at `localhost:9000`.

**MinIO CORS (configure once):** allow origins = frontend URLs (`http://localhost:3000`, `https://*.vercel.app`, prod domain). Methods = `GET`, `PUT`, `HEAD`. Headers = `*`. Expose `ETag`. Forget this and you get "CORS error" in browser console — fastest way to lose an hour.

---

## Frontend architecture — Feature-Sliced Design (FSD)

Layers (upper may import lower, never reverse; no cross-imports inside a layer):

```
apps/web/src/
├── app/         ← FSD app-init: providers, TanStack Router setup, global styles
├── pages/       ← FSD pages layer. One page per route. No Next collision — we're plain React.
├── widgets/     ← Composite UI blocks (file-tree, file-grid, file-viewer, header, upload-zone)
├── features/    ← One user use-case each (create-folder, upload-file, rename-file, ...)
├── entities/    ← Domain objects (dataroom, folder, file) — queries + entity-specific UI
└── shared/      ← ui/ (shadcn primitives), api/ (fetch client), lib/, config/, hooks/
```

**Import alias:** `@/*` → `src/*`.

**Router config lives in `app/router.tsx`** (TanStack Router route tree). Each route points to a page component from `pages/`.

```tsx
// app/router.tsx (sketch)
const dataroomRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/datarooms/$dataroomId',
  component: () => <DataroomPage />,
})

// pages/dataroom/DataroomPage.tsx
export function DataroomPage() {
  const { dataroomId } = Route.useParams()  // type-safe
  ...
}
```

**Auth guard:** wrap protected routes in a `<RequireAuth>` component that checks Clerk state, redirects to `/sign-in` if signed out. Public routes (sign-in, sign-up, magic-link landing) sit outside the guard.

### Feature anatomy

```
features/<name>/
├── model/use-<name>.ts          ← React Query mutation, optimistic updates, error toasts
├── ui/<Name>.view.tsx           ← Pure JSX. Props in, JSX out. No queries/mutations.
├── ui/<Name>.tsx                ← Container. Calls hook. Passes results to view.
└── index.ts                     ← Public API of the feature
```

### Entity anatomy

```
entities/<name>/
├── model/use-<name>.ts          ← React Query queries (NOT mutations)
├── model/types.ts               ← Re-exports from packages/shared
├── ui/<Name>Card.view.tsx       ← Entity-specific presentation
└── index.ts
```

---

## Frontend rules (non-negotiable)

**1. All meaningful logic lives in hooks.** Components receive props. This includes React Query — no `useQuery`/`useMutation` inside a component that renders JSX.

**2. Container/Presenter split — pragmatic, not dogmatic:**
- If the feature has a single trivial hook call → one file is fine, call the hook directly in the component.
- If the presentational component is reusable, testable, or Storybook-worthy → split into `.view.tsx` (pure) and `.tsx` (container).
- Local UI-only state (dropdown open, hover) stays in the view. Don't extract it.

**3. React Query — server state only. Zustand — client state only. Never both.**
- If it comes from `/api/...`, it lives in React Query cache.
- If it's "which row is selected", "is the sidebar collapsed", it's in Zustand or component state.

**4. Optimistic mutations — MUST follow the same 5-step template:**

```
onMutate:  await queryClient.cancelQueries(key)
           const prev = queryClient.getQueryData(key)
           queryClient.setQueryData(key, next)
           return { prev }
onError:   queryClient.setQueryData(key, ctx.prev)
           toast.error(...)
onSettled: queryClient.invalidateQueries(key)
```

- `rename` folder/file/dataroom → optimistic ✓
- `delete` folder/file/dataroom → optimistic ✓ (soft-delete + Undo toast for 5s)
- `create` folder / dataroom → optimistic ✓
- `move` folder/file → optimistic ✓
- `upload` file → **NOT** optimistic. Show a pending row with progress bar; on failure keep the row with a Retry button. Never mark upload as success before backend confirms.

**Missing `cancelQueries`** = flicker on slow networks when in-flight refetches collide with the optimistic write. Never skip it.

**5. React Query cache keys** — factory pattern:
```ts
export const folderKeys = {
  all: ['folders'] as const,
  children: (parentId: string) => [...folderKeys.all, 'children', parentId] as const,
  detail: (id: string) => [...folderKeys.all, 'detail', id] as const,
}
```

**6. Perceived speed defaults:**
- `staleTime: 5 * 60_000` (5 min) for entity queries
- Prefetch folder children on hover in file tree
- Skeletons, not spinners
- `keepPreviousData` on folder navigation

**7. Do NOT copy from the template `.reference/`** anything except the 46 shadcn primitives (`src/components/ui/*`) and their shadcn config (`components.json`, tailwind base). No preferences store, no theme presets, no sidebar nav config, no dashboard routes, no mock data.

**8. When copying shadcn primitives, replace Next-isms.** Template is Next.js; some UI files import `next/link`, `next/navigation`, `next/image`. Replace:
- `import Link from 'next/link'` → `import { Link } from '@tanstack/react-router'` (or plain `<a>` for external)
- `useRouter()` / `usePathname()` from `next/navigation` → TanStack Router hooks (`useRouter`, `useLocation`)
- `next/image` → plain `<img>` (we have no image optimization needs)

Affected files usually: `pagination.tsx`, `sidebar.tsx`, `breadcrumb.tsx` — grep for `next/` before copying.

---

## Backend rules

**1. Every mutating route** goes through Clerk JWT middleware and an ownership check (does the authenticated user own the resource being modified?). No exceptions.

**2. Validate at the boundary.** Every route uses a Zod schema from `packages/shared` for both input and output. Don't validate internal function args.

**3. Byte streams never touch Fastify.** If you find yourself parsing multipart uploads in Fastify, stop — you missed the presigned URL path.

**4. Database access via Drizzle only.** No raw SQL scattered through route handlers; queries live in a `db/queries/` module.

**5. Errors are typed.** Shared `packages/shared/errors.ts` defines error codes (`FOLDER_NAME_TAKEN`, `NOT_FOUND`, `FORBIDDEN`, `UPLOAD_INCOMPLETE`, etc). Fastify maps them to HTTP status. Frontend switches on codes, not string matching.

**6. Two `S3Client` instances:** one internal (`http://minio:9000`), one public (`https://minio.dataroom...`) for presigning. Never accidentally sign with the internal one — the browser can't resolve it.

---

## Deployment

### Frontend → Vercel

- Vercel project root: `apps/web`
- Build command: `pnpm --filter web build` (Vite build)
- Output directory: `apps/web/dist`
- Env (prefixed `VITE_` since Vite only exposes those to client bundle):
  - `VITE_CLERK_PUBLISHABLE_KEY`
  - `VITE_API_URL=https://api.dataroom.holy-water.app`
- SPA fallback: Vercel handles this automatically for Vite projects (all unknown routes → `index.html`).

### Backend + Postgres + MinIO → Dokploy compose

- Server: Contabo VPS `62.171.189.125`
- Dokploy dashboard: `https://dokploy.holy-water.app/dashboard/projects`
- SSH alias: `ssh holy-water`
- Compose file: `docker-compose.prod.yml` at repo root
- Services & domains:
  - `api` → `api.dataroom.holy-water.app` (Fastify, port 3001)
  - `postgres` → internal only
  - `minio` → `minio.dataroom.holy-water.app` (S3 API on 9000, console on 9001)

### First-deploy checklist

1. Cloudflare A-records: `api.dataroom.holy-water.app`, `minio.dataroom.holy-water.app` → `62.171.189.125`, `proxied:false` (LE HTTP-01 needs grey cloud).
2. Dokploy → new project `dataroom` → new Compose service, git repo.
3. Fill ALL env vars before first deploy (Dokploy re-clones repo every deploy — reading `.env.example` after deploy is the correct sequence).
4. First deploy → wait for Traefik to issue LE certs → verify `curl -I https://api.dataroom.holy-water.app`.
5. Configure MinIO CORS via `mc admin` or console (allow frontend origins).
6. Create initial MinIO bucket (`dataroom-files`).
7. (Optional, only after certs stable) Cloudflare → `proxied:true` + SSL mode Full(strict).

### Deployment gotchas

- Dokploy wipes the workdir on every deploy — don't store state in `/etc/dokploy/compose/dataroom/code/`. All persistent data goes into Docker volumes.
- Never enable Cloudflare proxy before LE cert is issued — burns rate-limit quota.
- Postgres volume MUST be a named Docker volume, not a bind mount to the workdir.

### Local dev

```bash
docker-compose -f docker/docker-compose.dev.yml up -d   # Postgres + MinIO
pnpm install
pnpm --filter api db:migrate
pnpm dev                                                # turbo runs web + api
```

MinIO console: `http://localhost:9001` (login from `.env`). Postgres: `postgres://dev:dev@localhost:5432/dataroom`.

---

## Development conventions

- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`). Feature scope in parens: `feat(upload): direct-to-minio presigned flow`.
- **Branches:** `feat/<short>`, `fix/<short>`. Merge to `main` via squash.
- **Formatting/lint:** Biome (`pnpm check:fix` before commit — husky pre-commit already runs it).
- **No comments explaining WHAT the code does.** Names should say that. Only WHY when non-obvious.
- **No planning docs in repo unless explicitly requested.** Work from conversation context.
- **README** is for reviewers: design decisions, setup instructions, live URL, screenshots. Written last.

---

## What NOT to do

- Do not build multi-tenant, multi-workspace, or team-collaboration features. Each user has their own datarooms — that is the scope.
- Do not add full-text PDF search unless explicitly requested (extra credit, expensive to do right).
- Do not add auth flows beyond Clerk's default (no password reset UI, no email verification screens — Clerk handles it).
- Do not build a global theme switcher UI. Light/dark only via a small toggle in the header. No preset picker.
- Do not proxy uploads through Fastify. Direct-to-MinIO or nothing.
- Do not put React Query calls inside JSX-rendering components.
- Do not store server data in Zustand.
- Do not commit anything from `.reference/` — it is gitignored on purpose.
- Do not reintroduce Next.js. The frontend is a Vite SPA. If you feel tempted (SSR for SEO, image optimization, server actions) — none of these matter for a Data Room behind auth.
- Do not copy shadcn primitives from `.reference/` without stripping `next/link`, `next/navigation`, `next/image` imports.

---

## Working style

- **Consultation before code.** When architectural questions come up, discuss trade-offs and ask before implementing.
- **GSD workflow.** This project runs through `/gsd:*` commands (new-project, plan-phase, execute-phase). Do not do freeform coding sessions.
- **When answering questions,** be direct about trade-offs and honest when there's no clean win. Do not oversell any technology.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Dataroom MVP**

A virtual Data Room web app — a Google Drive / Dropbox-like repository where a user can create datarooms, organize PDF documents into nested folders, and view them in-browser. Built as a take-home coding challenge for Acme Corp's engineering evaluation, framed around an M&A due-diligence use case.

**Core Value:** A user can create a dataroom, upload a PDF into the right folder, and immediately view it — the create → upload → view flow must feel instantaneous and never lose a file.

### Constraints

- **Tech stack**: React SPA on Vite (no Next.js), Fastify backend, Postgres + MinIO — locked in during scoping conversation. Deviations require explicit re-scoping.
- **Timeline**: TASK.md nominal 4-6h. Real budget is elastic but every hour on infra is an hour not spent on UX polish, which is the #1 scored dimension.
- **Deployment**: Dokploy on Contabo VPS (backend + storage + DB) + Vercel (frontend). Predefined domains under `holy-water.app`.
- **Storage protocol**: S3-compatible API only. This unlocks direct-to-storage upload via presigned URLs and preserves the option to swap MinIO for R2/S3 later with an env var change.
- **Frontend architecture**: FSD layers with strict layer-direction rules. All React Query calls live in hooks; components receive props. React Query owns server state; Zustand owns client state; no overlap.
- **File support**: PDF only (TASK.md limit); UNIQUE `(folderId, name)` at DB layer; ownership check on every backend mutation.
- **Auth**: Clerk-hosted; no custom auth flows.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

Full pinned versions, alternatives considered, and sources → `.planning/research/STACK.md`. The `## Stack` section above covers the day-to-day decisions.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
