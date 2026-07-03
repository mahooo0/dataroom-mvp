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

## Scope of This Document
## Executive Summary — 4 Things That Changed The Plan
## Recommended Stack
### Core Technologies (locked-in choices, validated)
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | `^19.2.7` | UI runtime | Stable since Dec 2024; React Query, TanStack Router, Clerk all peer-support it. No known gotchas in a pure Vite SPA context. |
| TypeScript | `^5.8.x` (recommend pinning `5.8`, not chasing 6.x) | Type system | 6.0.3 was released April 2026 but ecosystem lag means many libs still declare `<5.9` peers; TS 5.8 is the safest currently-widely-supported line. |
| Vite | `^8.1.3` | Build tool + dev server | Vite 8 stable since March 2026. Rolldown is the default bundler now, meaningfully faster than Vite 7's Rollup. React SPA with TanStack Router is a first-class use case. |
| @vitejs/plugin-react-swc | `^4.3.1` | React Fast Refresh via SWC | Prefer SWC plugin over Babel plugin — 3-5× faster HMR, no config drift. |
| Tailwind CSS | `^4.3.2` | Styling | v4 stable since Jan 2025 (18 months of production use). New CSS-first config (`@theme` in CSS, no `tailwind.config.ts`). shadcn/ui v2 supports Tailwind 4 natively. |
| shadcn/ui | copy from `.reference/next-shadcn-admin-dashboard` (already 46 primitives) | Component primitives | Copy-in, not installed. Note the `next/link` / `next/navigation` / `next/image` swap step already documented in `CLAUDE.md`. |
| TanStack Router | `^1.170.x` | Type-safe routing | v1 stable since Dec 2023 (2.5 years in production). File-based routing works well with FSD's `pages/` layer if you use it as a route-tree source. Auth context integrates cleanly with Clerk via `context.auth` on the root route. |
| @tanstack/react-query | `^5.101.x` | Server state cache | Same author as Router, cache integration is first-party. `staleTime`, optimistic mutations, `keepPreviousData` all match the perceived-speed strategy in `PROJECT.md`. |
| Zustand | `^5.0.14` | Client-only state | v5 requires React 18+, no gotchas with React 19. Keep it exclusively for UI-only state per project rule. |
| @clerk/react | `^6.11.3` (NOT `@clerk/clerk-react`) | Auth (frontend) | Core 3 rename. Handles Vite env-var detection automatically. Magic-link flow is the default in Development instances. |
| @clerk/backend | `^3.10.0` | JWT verification (backend) | Package name unchanged in Core 3. Framework-agnostic — used inside a Fastify preHandler hook. |
| Fastify | `^5.9.0` | HTTP server | v5 stable since Sept 2024, node ≥20 required. Peer of `fastify-type-provider-zod@7`. Do NOT install v4 — the type-provider integration was rewritten for v5. |
| fastify-type-provider-zod | `^7.0.0` | Zod-first request/response validation | Schema-first API contract. Requires Zod ≥ 4.1.5 and Fastify ≥ 5.5. |
| Drizzle ORM | `^0.45.2` | Postgres client + query builder | Still on 0.x (1.0 is in beta). API is stable in practice; 0.45 is the current production release. Kysely and Prisma both viable alternatives but locked in — not re-litigating. |
| drizzle-kit | `^0.31.10` | Migrations + introspection CLI | See migration workflow below. Kit and ORM have separate versioning — that is intentional, not a bug. |
| @aws-sdk/client-s3 | `^3.10xx` (latest 3.x) | MinIO client (S3 API) | Modular AWS SDK v3. Only pull `client-s3` and `s3-request-presigner`, not the umbrella. Bundle-cost concern is backend-only, so it doesn't matter. |
| @aws-sdk/s3-request-presigner | `^3.10xx` | Generate presigned PUT/GET URLs | Required for the direct-to-MinIO upload flow. |
| Postgres | `16.x` (Docker image `postgres:16-alpine`) | Metadata store | Postgres 17 exists but 16 is the LTS-feel default for Docker composes; Drizzle supports both. |
| MinIO server | image `pgsty/minio:latest` (community fork), NOT `minio/minio` | S3-compatible object store | See "Executive Summary #2" — official images are archived. `pgsty/minio` is drop-in compatible with `@aws-sdk/client-s3` and restores the admin console. |
| Zod | `^4.4.3` | Schema validation | v4 required by `fastify-type-provider-zod@7`. Breaking changes from v3 mostly in error formatting; write schemas v4-native, do not port v3 patterns. |
### Filled Gaps — Newly Recommended Choices
| Library | Version | Purpose | Why This One |
|---------|---------|---------|--------------|
| **`ky`** | `^2.0.2` | Browser fetch client (`apps/web` → API) | See "Fetch client comparison" below. Fits Vite SPA better than the alternatives. |
| **`react-pdf`** | `^10.4.1` | In-app PDF viewer | Already locked. Confirmed as still the best choice. Do NOT also install `pdfjs-dist` explicitly — let react-pdf pin its own (5.4.296). |
| **`@fastify/cors`** | `^11.2.0` | CORS for `apps/api` | Official Fastify plugin. Simpler config than roll-your-own. |
| **`@fastify/sensible`** | `^6.0.4` | HTTP error helpers (`reply.notFound()`, etc.) + typed errors | Small, official, saves boilerplate around the `packages/shared/errors.ts` mapping. |
| **`@fastify/helmet`** | `^13.0.2` | Basic security headers | 10-minute setup, prevents a reviewer nit about missing CSP/HSTS. |
| **`@fastify/rate-limit`** | `^11.1.0` | Rate limit `/files/init` and `/files/*/complete` | Optional but cheap. Adds one line in the README under "production considerations." |
| **`pino-pretty`** | `^13.1.3` (dev-only) | Human-readable logs in local dev | Fastify's default Pino logger emits JSON; pipe through `pino-pretty` in dev. Do NOT ship in prod (parse cost). |
| **`react-hook-form`** | `^7.80.0` | Form state (rename dialog, create folder, upload) | Locked. Still the standard. |
| **`@hookform/resolvers`** | `^5.4.0` | Wire Zod schemas into react-hook-form | Required companion. |
| **`sonner`** | `^2.0.7` | Toast notifications | Locked. Ships with shadcn/ui. |
| **`@dnd-kit/core`** | `^6.3.1` | Drag/drop | Locked. |
| **`@dnd-kit/sortable`** | `^10.0.0` | Sortable lists (file tree reordering, if needed) | Only if you enable reorder; not required for MVP. |
| **`clsx`** | `^2.1.1` | Class merging | Comes with shadcn utils. |
| **`tailwind-merge`** | `^3.6.0` | Tailwind class deduping | Comes with shadcn utils. |
| **`class-variance-authority`** | `^0.7.1` | Variant-typed component styles | Comes with shadcn primitives. |
### Development Tools
| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| pnpm | `^9` or `^10` | Package manager + workspaces | Locked. `pnpm-workspace.yaml` in repo root. |
| Turborepo | `^2` | Task orchestration across workspaces | Locked. Cache `build`, `check`, `test`. |
| Biome | `^2.5.2` | Lint + format | Locked from template. Config already tuned for React + TS. |
| Vitest | `^4.1.9` | Unit + component test runner | See "Testing stack" section. |
| @testing-library/react | `^16.3.2` | Component testing DOM helpers | Only if you write component tests (see budget note). |
| @testing-library/user-event | `^14.6.1` | Realistic user interactions in tests | Pairs with RTL. |
| jsdom | `^29.1.1` | DOM for Vitest environment | Alternative: `happy-dom` (faster but less complete). |
| @playwright/test | `^1.61.1` | E2E if you want a smoke test | See testing budget note. |
| tsx | latest | Run TS files directly (Drizzle migrations, seed scripts) | Prefer over `ts-node`. |
## Fetch Client — Comparison and Pick
| Option | Bundle Size (min+gz) | Typing | React Query fit | Verdict |
|--------|---------------------|--------|-----------------|---------|
| **`ky`** | ~4 KB | Solid, generic-based | Excellent — throws on non-2xx, matches React Query's error contract | ✅ Recommended |
| Native `fetch` + tiny wrapper | 0 KB baseline + ~30 lines | You write the types | Fine but you rewrite ky yourself, worse than nothing | ❌ Reinventing |
| `axios` | ~13 KB + XHR-based | Solid but old-school | Fine, but bloated + XHR interceptors are anachronistic in 2026 | ❌ Skip |
| `@better-fetch/fetch` | ~3 KB | Excellent (built for Zod inference) | Excellent, but the ecosystem is small (~1.5 years old, low download count) | ⚠️ Great if you want Zod-inferred client types, otherwise ky is the safer bet |
- Throws `HTTPError` on non-2xx by default → React Query's `useQuery`/`useMutation` `onError` gets a real exception, not a `{ok:false}` object.
- `beforeRequest` hook is the natural place to attach `Authorization: Bearer ${clerkToken}` from `getToken()`.
- Retries with backoff are one option flag.
- Timeouts are one option flag.
- No XHR baggage → smaller bundle, easier to reason about.
## PDF Renderer — Comparison and Pick
| Option | Style | Bundle | Custom UI freedom | Verdict |
|--------|-------|--------|-------------------|---------|
| **`react-pdf`** | Low-level primitives (`<Document>`, `<Page>`) | Ships pdfjs-dist as dep, worker separate | Total — build your own toolbar | ✅ Recommended |
| `@react-pdf-viewer/*` | Full viewer UI, plugin architecture | Larger + plugin registry | Themeable but "someone else's UI" — matches poorly with a polished shadcn app | ❌ UI-fit mismatch |
| `pdfjs-dist` direct | Raw pdf.js Web API | Smallest, but you write the React bindings | Total but you reinvent react-pdf | ❌ Skip |
- Small React surface: `<Document file={url}><Page pageNumber={n} /></Document>`. Everything else — page navigation, zoom, spinners — is your JSX.
- Fits shadcn/ui aesthetic because you provide the chrome.
- Locked-in and matches the "design & polish" scoring dimension.
## Drizzle Migration Workflow
| Command | When to use |
|---------|-------------|
| `drizzle-kit push` | Rapid schema prototyping against a throwaway DB. Never in production. |
| `drizzle-kit generate` | After editing `db/schema.ts`, emits a versioned `.sql` file into `drizzle/`. Commit these. |
| `drizzle-kit migrate` | Applies pending migrations. Runs in dev via `pnpm --filter api db:migrate`, and in production as a container start-hook before Fastify boots. |
| `drizzle-kit studio` | Local DB inspector at `localhost:4983`. Useful during dev. |
- Reviewer clones your repo — they need reproducible schema state, which means committed migration SQL, not a `push` that guesses at diffs.
- Production Postgres in Dokploy needs a deterministic upgrade path. `push` on prod is dangerous (it can drop columns).
- Migration files serve as a schema changelog for the reviewer to skim.
## Fastify Plugin Set
| Plugin | Purpose | Priority |
|--------|---------|----------|
| `@fastify/cors@^11` | Allow browser origin (Vercel URL + localhost) | Required |
| `@fastify/sensible@^6` | `reply.notFound()`, `httpErrors.badRequest()`, unified error contract | Recommended |
| `@fastify/helmet@^13` | Security headers (CSP, HSTS, X-Content-Type-Options) | Recommended |
| `@fastify/rate-limit@^11` | Throttle `/files/init` bursts | Optional (README talking point) |
| `fastify-type-provider-zod@^7` | Zod schemas as request/response validation | Required (schema-first is the whole point) |
- `@fastify/multipart` — you're using presigned URLs; the backend never receives file bytes. If you find yourself adding this, you've broken the architecture rule.
- `@fastify/jwt` — Clerk handles JWT verification via `@clerk/backend`. No custom JWT signing.
- `@fastify/static` — API returns JSON only; static assets are on Vercel.
- Fastify emits Pino JSON logs by default with request/response info. Add `pino-pretty` transport in dev only:
- Error normalization: register a `setErrorHandler` that maps `packages/shared/errors.ts` codes to HTTP status + a stable `{code, message}` shape. Do this once, no scattered `reply.status(...).send(...)` calls.
## Testing Stack — Budget-Aware
- **Type-checking as tests:** `tsc --noEmit` in CI. Zod schemas + TanStack Router + Drizzle collectively catch a huge class of bugs at compile time. This is free.
- **Backend contract test:** one Vitest file that spins up Fastify with `.inject()` (Fastify's built-in test helper — no supertest needed), hits `/datarooms` POST/GET/DELETE with a mocked Clerk verify. Proves the API isn't lying. ~30 min.
- **One Playwright smoke test:** sign in → create dataroom → create folder → upload PDF → open viewer. If it passes, everything ships. If it fails, you get a video. ~45 min including trace config.
- **Component tests with RTL:** high setup cost, low return for a 4-6h build. If the reviewer opens your `__tests__/` dir and sees three trivial `render(<Button />)` tests, they'll notice the theatre. Better to skip than fake it.
- **Backend integration tests against real Postgres:** requires testcontainers or a docker-compose-test — worth it for a real product, not for MVP.
## Locked-in Choice Validation — Gotcha Check
| Choice | Verdict | Notes |
|--------|---------|-------|
| React 19 + Vite + TypeScript | ✅ Solid | Vite 8 (rolldown) is stable; React 19 is 18+ months old. No bleeding edge. |
| TanStack Router v1 | ✅ Solid | 2.5 years since v1.0.0; used at scale. No production-ready concerns. |
| Tailwind 4 | ✅ Solid | Stable since Jan 2025. shadcn/ui v2 targets Tailwind 4. **New CSS-first config** — no `tailwind.config.ts`; use `@theme` in `index.css`. Do not paste v3 configs from stale tutorials. |
| Clerk on plain React SPA | ⚠️ Rename | See Executive Summary #1: use `@clerk/react@^6`, not `@clerk/clerk-react`. Behavior is otherwise identical. |
| Drizzle 0.x | ✅ Solid | 0.45.2 is production-quality; 1.0 beta is safe to ignore for MVP. Migration story is well-worn. |
| MinIO | ⚠️ Fork | See Executive Summary #2: pull `pgsty/minio`, not `minio/minio`. Everything else in the plan holds. |
| Fastify v4 vs v5 | ✅ Use v5 | v5 required by `fastify-type-provider-zod@7`. v4 is legacy at this point (Sept 2024 → v5 is 22 months old). Node ≥20. |
## Version Compatibility Notes
| Package | Requires | Notes |
|---------|----------|-------|
| `react-pdf@10.x` | `pdfjs-dist@5.4.296` (pinned, transitive) | Do NOT install `pdfjs-dist` explicitly. |
| `fastify-type-provider-zod@7.x` | `fastify@^5.5.0`, `zod@>=4.1.5` | Zod 3 → won't work. Fastify 4 → won't work. |
| `@clerk/react@6.x` | `react@^18.0.0 \|\| ~19.x` | React 19 supported. `<SignedIn>`/`<Protect>` gone — use `<Show>`. |
| `@clerk/backend@3.x` | Any Node HTTP framework; pass verifier a `Request`-like object | Version 3.10.0 works with the Core 3 frontend. |
| `drizzle-orm@0.45.x` | `drizzle-kit@0.31.x`, `postgres@^3.4.x` | Kit + ORM have independent semver — that's normal. |
| Tailwind 4 | Needs a browser-native `@import` capable stylesheet; Vite handles this by default | Do not use PostCSS plugin patterns from Tailwind 3 docs — v4 uses `@tailwindcss/vite`. |
## Installation
# core
# dev
# optional: pnpm add -D @playwright/test
# core
# dev
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| ky | `@better-fetch/fetch` | When you want Zod schemas from `packages/shared` to drive fully-inferred fetch response types with zero hand-written generics. Trade-off: smaller ecosystem, ~1.5 year old lib. |
| react-pdf | `@react-pdf-viewer/*` | If you want a pre-built PDF viewer UI with a toolbar and plugin ecosystem. Trade-off: aesthetic mismatch with your shadcn/ui polish. |
| Vitest | Jest | If your team already has Jest expertise + a config they don't want to rewrite. Trade-off: Vitest is Vite-native and 3-5× faster starts. |
| Drizzle | Prisma | If you want a GUI for schema modeling and don't mind the query engine binary. Trade-off: already locked out. |
| Fastify | Hono | If you were deploying to an edge runtime (Cloudflare Workers, Vercel Edge). Trade-off: you're on a VPS running Node, so Fastify's plugin ecosystem wins. |
| pgsty/minio | SeaweedFS or Garage | If you need geo-distributed storage or a genuine post-MinIO architecture. Trade-off: none of these are drop-in for `@aws-sdk/client-s3` without config changes, and MVP does not benefit. |
| Postgres (in compose) | Neon / Supabase Postgres | If you want zero infra ownership. Trade-off: adds an external dependency for the reviewer to worry about. Locked in already. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `axios` | 13 KB, XHR-based, redundant with modern fetch. No benefit here. | `ky` |
| `redux` / `@reduxjs/toolkit` | Server state lives in React Query, client state in Zustand. RTK adds boilerplate for state that is already handled. | React Query + Zustand |
| `swr` | Duplicates React Query. Two cache systems = bugs. | React Query only |
| `react-router` (any version) | Locked to TanStack Router for prefetch + type-safe params. Do not mix routers. | TanStack Router |
| `next/*` in shadcn primitives copied from `.reference/` | You're a Vite SPA, not Next.js. `next/link`, `next/image`, `next/navigation` will not resolve. | Rewrite per `CLAUDE.md` rule #8: TanStack `Link`, plain `<img>`, TanStack Router hooks |
| `pdfjs-dist` installed explicitly | `react-pdf@10` pins a specific version transitively; explicit install causes worker mismatch. | Let `react-pdf` provide it |
| `formik` | react-hook-form + Zod is faster to write and lighter. | react-hook-form |
| `styled-components` / `emotion` | You already have Tailwind + CVA. Runtime CSS-in-JS is redundant and slower. | Tailwind + `cva` |
| `moment` / `dayjs` (unless required) | Only 3 date operations exist in MVP (createdAt display). Use `Intl.DateTimeFormat`. | Native `Intl` |
| `@clerk/clerk-react` (v5) | Renamed to `@clerk/react` (v6) in Core 3. Old package is legacy. | `@clerk/react@^6` |
| `minio/minio` Docker image | Archived and stale on a Sept 2025 release. | `pgsty/minio` |
| `@fastify/multipart` | Uploads go direct-to-MinIO via presigned PUT. Fastify never sees bytes. | Presigned URL flow (already in plan) |
| `express` | Fastify is chosen. Do not introduce a second HTTP layer. | Fastify |
| `prisma` | Drizzle is chosen. No engine binary, better types, honest SQL. | Drizzle |
| `nodemon` | Fastify dev server + `tsx watch` (or Fastify's own reload) is enough. Adding nodemon is 2019 muscle memory. | `tsx --watch src/index.ts` |
| `ts-node` | Slower and more configuration-heavy than `tsx`. | `tsx` |
| `dotenv` (as runtime dep) | Node ≥20.6 has native `--env-file`; Vite reads `.env*` natively. Only install if you need it for a script explicitly. | Native `--env-file` or Vite's built-in loader |
## Stack Patterns by Variant
- Alternative: pin `minio/minio` to `RELEASE.2025-09-07T16-13-09Z` (last stable before archive) and document it as a known-frozen pin in the README. Acceptable for MVP but not for a real product — the fork path is better.
- Some libraries may not yet declare TS 6 compatibility. Stay on TS 5.8 for the MVP; upgrade once the ecosystem catches up (typically 3-6 months).
- You are starting greenfield. There is no v5 → v6 migration to perform. Install `@clerk/react@^6` directly. The risk described in the Clerk upgrade guides applies to existing v5 codebases.
- Ship Tier 1 (Vitest with `.inject()` API contract tests) + call it out in the README as "MVP testing footprint; component and E2E tests added in a hypothetical Phase 2." This is honest and defensible.
## Sources
- All version numbers in tables above were fetched from `registry.npmjs.org/{pkg}/latest` on research date.
- Peer dependency checks against `registry.npmjs.org/{pkg}/{version}` metadata.
- [Clerk Core 3 changelog (2026-03-03)](https://clerk.com/changelog/2026-03-03-core-3) — package rename + `<Show>` migration. HIGH confidence.
- [Clerk React quickstart](https://clerk.com/docs/quickstarts/react) — Vite env var handling. HIGH confidence.
- [TanStack Router authenticated routes guide](https://tanstack.com/router/latest/docs/framework/react/guide/authenticated-routes) — beforeLoad + context pattern. HIGH confidence.
- [MinIO releases (GitHub)](https://github.com/minio/minio/releases) — maintenance mode + Docker image status. HIGH confidence.
- [fastify-type-provider-zod peer requirements](https://registry.npmjs.org/fastify-type-provider-zod/7.0.0) — Fastify 5.5+, Zod 4.1.5+. HIGH confidence.
- [react-pdf transitive pdfjs-dist pin](https://registry.npmjs.org/react-pdf/10.4.1) — pdfjs-dist@5.4.296 exact pin. HIGH confidence.
- [MinIO Is Dead / MinIO Resurrect (Vonng blog)](https://blog.vonng.com/en/db/minio-resurrect/) — pgsty/minio fork rationale.
- [MinIO container images gone — best alternatives (DevPro, 2025)](https://devpro.fr/minio-container-images-gone-best-alternatives-2025/) — alternative images survey.
- [MinIO Is Done With Open Source (It's FOSS News)](https://itsfoss.com/news/minio-moves-away-from-open-source/) — timeline of the license/maintenance shift.
## Open Decisions for User
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
