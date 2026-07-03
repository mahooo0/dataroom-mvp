# Stack Research

**Domain:** Virtual Data Room / document management SPA (Google Drive-like MVP)
**Researched:** 2026-07-03
**Confidence:** HIGH (all versions verified live via npm registry on research date; library recommendations verified against current official docs)

---

## Scope of This Document

The stack is 90% locked in by the user (see `CLAUDE.md` and `.planning/PROJECT.md`). This file:

1. **Validates the locked-in choices** against July 2026 reality and flags anything that changed since the choices were made.
2. **Fills gaps** — fetch client, PDF renderer, migration tooling, Fastify plugins, testing stack.
3. **Pins current versions** verified live against the npm registry.
4. **Lists what NOT to use** so downstream planning does not re-litigate settled decisions.

---

## Executive Summary — 4 Things That Changed The Plan

Findings that materially affect the locked-in stack. Roadmap must account for these:

1. **Clerk shipped Core 3 in March 2026.** `@clerk/clerk-react` v5 was renamed to `@clerk/react` v6, and `<SignedIn>`/`<SignedOut>`/`<Protect>` are all deprecated in favor of a single `<Show when="...">` component. A codemod CLI handles most of the migration. **Recommendation: install `@clerk/react@^6` from day one, not `@clerk/clerk-react`.** Confidence: HIGH.
2. **MinIO went into maintenance mode and archived its public Docker images in Oct 2025 → Feb 2026.** The `minio/minio` official image is stale on a security release from Sept 2025, and the embedded UI console has been removed. **Recommendation: use the community fork `pgsty/minio` — drop-in S3 API + restored admin console.** Confidence: HIGH.
3. **`react-pdf@10` pins `pdfjs-dist` to an exact version (`5.4.296`).** Do NOT install `pdfjs-dist@6` or `pdfjs-dist@latest` alongside it — worker/version mismatch will silently break rendering. Let react-pdf transitively supply pdfjs-dist. Confidence: HIGH.
4. **Zod 4 is stable (released July 2025) and is the version `fastify-type-provider-zod@7` requires.** Do NOT install `zod@3` — the peer range is `>=4.1.5`. Confidence: HIGH.

Everything else in the locked-in stack holds up in July 2026.

---

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

---

## Fetch Client — Comparison and Pick

**Recommendation: `ky@^2.0.2`.**

| Option | Bundle Size (min+gz) | Typing | React Query fit | Verdict |
|--------|---------------------|--------|-----------------|---------|
| **`ky`** | ~4 KB | Solid, generic-based | Excellent — throws on non-2xx, matches React Query's error contract | ✅ Recommended |
| Native `fetch` + tiny wrapper | 0 KB baseline + ~30 lines | You write the types | Fine but you rewrite ky yourself, worse than nothing | ❌ Reinventing |
| `axios` | ~13 KB + XHR-based | Solid but old-school | Fine, but bloated + XHR interceptors are anachronistic in 2026 | ❌ Skip |
| `@better-fetch/fetch` | ~3 KB | Excellent (built for Zod inference) | Excellent, but the ecosystem is small (~1.5 years old, low download count) | ⚠️ Great if you want Zod-inferred client types, otherwise ky is the safer bet |

**Why `ky`:**
- Throws `HTTPError` on non-2xx by default → React Query's `useQuery`/`useMutation` `onError` gets a real exception, not a `{ok:false}` object.
- `beforeRequest` hook is the natural place to attach `Authorization: Bearer ${clerkToken}` from `getToken()`.
- Retries with backoff are one option flag.
- Timeouts are one option flag.
- No XHR baggage → smaller bundle, easier to reason about.

**Wrapper pattern (`apps/web/src/shared/api/client.ts`):**

```ts
import ky from 'ky'
import { useAuth } from '@clerk/react'

export const api = ky.create({
  prefixUrl: import.meta.env.VITE_API_URL,
  timeout: 30_000,
  hooks: {
    beforeRequest: [
      async (request) => {
        const token = await window.Clerk?.session?.getToken()
        if (token) request.headers.set('Authorization', `Bearer ${token}`)
      },
    ],
  },
})
```

**Consider `@better-fetch/fetch` only if** you want the fetch client to consume Zod schemas from `packages/shared` and produce end-to-end-typed responses without hand-written generics. If the team is comfortable with `ky.get<Dataroom[]>('datarooms').json()`, stay with ky.

---

## PDF Renderer — Comparison and Pick

**Recommendation: `react-pdf@^10.4.1` (locked-in choice validated).**

| Option | Style | Bundle | Custom UI freedom | Verdict |
|--------|-------|--------|-------------------|---------|
| **`react-pdf`** | Low-level primitives (`<Document>`, `<Page>`) | Ships pdfjs-dist as dep, worker separate | Total — build your own toolbar | ✅ Recommended |
| `@react-pdf-viewer/*` | Full viewer UI, plugin architecture | Larger + plugin registry | Themeable but "someone else's UI" — matches poorly with a polished shadcn app | ❌ UI-fit mismatch |
| `pdfjs-dist` direct | Raw pdf.js Web API | Smallest, but you write the React bindings | Total but you reinvent react-pdf | ❌ Skip |

**Why `react-pdf`:**
- Small React surface: `<Document file={url}><Page pageNumber={n} /></Document>`. Everything else — page navigation, zoom, spinners — is your JSX.
- Fits shadcn/ui aesthetic because you provide the chrome.
- Locked-in and matches the "design & polish" scoring dimension.

**Critical gotcha (do NOT skip):** `react-pdf@10` deps pin `pdfjs-dist@5.4.296` exactly. If you `pnpm add pdfjs-dist` yourself, you'll get a newer version → worker URL / API version mismatch → blank canvas or console errors. **Only import `pdfjs` symbols from `react-pdf`'s re-exports.**

**Worker setup for Vite:**

```ts
// shared/lib/pdf.ts
import { pdfjs } from 'react-pdf'
import pdfjsWorker from 'react-pdf/dist/esm/pdf.worker.min.js?url'
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker
```

Do this once, at the module import top of `<PdfViewer>`. Vite handles the `?url` import.

---

## Drizzle Migration Workflow

**`drizzle-kit@^0.31.10`** — the tooling.

Two modes exist; for this project use **`generate` + `migrate`** (versioned migrations), not `push`.

| Command | When to use |
|---------|-------------|
| `drizzle-kit push` | Rapid schema prototyping against a throwaway DB. Never in production. |
| `drizzle-kit generate` | After editing `db/schema.ts`, emits a versioned `.sql` file into `drizzle/`. Commit these. |
| `drizzle-kit migrate` | Applies pending migrations. Runs in dev via `pnpm --filter api db:migrate`, and in production as a container start-hook before Fastify boots. |
| `drizzle-kit studio` | Local DB inspector at `localhost:4983`. Useful during dev. |

**Why generate/migrate and not push:**
- Reviewer clones your repo — they need reproducible schema state, which means committed migration SQL, not a `push` that guesses at diffs.
- Production Postgres in Dokploy needs a deterministic upgrade path. `push` on prod is dangerous (it can drop columns).
- Migration files serve as a schema changelog for the reviewer to skim.

**`drizzle.config.ts` sketch:**

```ts
import { defineConfig } from 'drizzle-kit'
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
})
```

**Postgres driver:** use `postgres` (`^3.4.9`) as the driver, not `pg`. `postgres.js` is smaller, prepared-statement friendly, and Drizzle's docs use it as the default example for the `postgres-js` driver adapter.

---

## Fastify Plugin Set

Minimum viable production configuration:

| Plugin | Purpose | Priority |
|--------|---------|----------|
| `@fastify/cors@^11` | Allow browser origin (Vercel URL + localhost) | Required |
| `@fastify/sensible@^6` | `reply.notFound()`, `httpErrors.badRequest()`, unified error contract | Recommended |
| `@fastify/helmet@^13` | Security headers (CSP, HSTS, X-Content-Type-Options) | Recommended |
| `@fastify/rate-limit@^11` | Throttle `/files/init` bursts | Optional (README talking point) |
| `fastify-type-provider-zod@^7` | Zod schemas as request/response validation | Required (schema-first is the whole point) |

**NOT needed:**
- `@fastify/multipart` — you're using presigned URLs; the backend never receives file bytes. If you find yourself adding this, you've broken the architecture rule.
- `@fastify/jwt` — Clerk handles JWT verification via `@clerk/backend`. No custom JWT signing.
- `@fastify/static` — API returns JSON only; static assets are on Vercel.

**Request logging + error normalization:**
- Fastify emits Pino JSON logs by default with request/response info. Add `pino-pretty` transport in dev only:
  ```ts
  const logger = process.env.NODE_ENV === 'production'
    ? true
    : { transport: { target: 'pino-pretty' } }
  ```
- Error normalization: register a `setErrorHandler` that maps `packages/shared/errors.ts` codes to HTTP status + a stable `{code, message}` shape. Do this once, no scattered `reply.status(...).send(...)` calls.

---

## Testing Stack — Budget-Aware

The 4-6h nominal budget is real. Ranked by ROI for this specific project:

**Tier 1 (do these):**
- **Type-checking as tests:** `tsc --noEmit` in CI. Zod schemas + TanStack Router + Drizzle collectively catch a huge class of bugs at compile time. This is free.
- **Backend contract test:** one Vitest file that spins up Fastify with `.inject()` (Fastify's built-in test helper — no supertest needed), hits `/datarooms` POST/GET/DELETE with a mocked Clerk verify. Proves the API isn't lying. ~30 min.

**Tier 2 (if you have time):**
- **One Playwright smoke test:** sign in → create dataroom → create folder → upload PDF → open viewer. If it passes, everything ships. If it fails, you get a video. ~45 min including trace config.

**Tier 3 (skip for MVP):**
- **Component tests with RTL:** high setup cost, low return for a 4-6h build. If the reviewer opens your `__tests__/` dir and sees three trivial `render(<Button />)` tests, they'll notice the theatre. Better to skip than fake it.
- **Backend integration tests against real Postgres:** requires testcontainers or a docker-compose-test — worth it for a real product, not for MVP.

**Recommended install (minimum):**

```bash
pnpm add -D vitest jsdom @vitest/ui  # unit
pnpm add -D @playwright/test         # only if you'll write the smoke test
```

Skip `@testing-library/react` unless you commit to the Tier 3 component tests.

**Open decision the user must confirm before phase planning:** which tier — 1 only, or 1+2? This affects the phase budget in the roadmap.

---

## Locked-in Choice Validation — Gotcha Check

For each locked-in choice, is there a July 2026 concern?

| Choice | Verdict | Notes |
|--------|---------|-------|
| React 19 + Vite + TypeScript | ✅ Solid | Vite 8 (rolldown) is stable; React 19 is 18+ months old. No bleeding edge. |
| TanStack Router v1 | ✅ Solid | 2.5 years since v1.0.0; used at scale. No production-ready concerns. |
| Tailwind 4 | ✅ Solid | Stable since Jan 2025. shadcn/ui v2 targets Tailwind 4. **New CSS-first config** — no `tailwind.config.ts`; use `@theme` in `index.css`. Do not paste v3 configs from stale tutorials. |
| Clerk on plain React SPA | ⚠️ Rename | See Executive Summary #1: use `@clerk/react@^6`, not `@clerk/clerk-react`. Behavior is otherwise identical. |
| Drizzle 0.x | ✅ Solid | 0.45.2 is production-quality; 1.0 beta is safe to ignore for MVP. Migration story is well-worn. |
| MinIO | ⚠️ Fork | See Executive Summary #2: pull `pgsty/minio`, not `minio/minio`. Everything else in the plan holds. |
| Fastify v4 vs v5 | ✅ Use v5 | v5 required by `fastify-type-provider-zod@7`. v4 is legacy at this point (Sept 2024 → v5 is 22 months old). Node ≥20. |

---

## Version Compatibility Notes

Compatibility relationships that will bite you if broken:

| Package | Requires | Notes |
|---------|----------|-------|
| `react-pdf@10.x` | `pdfjs-dist@5.4.296` (pinned, transitive) | Do NOT install `pdfjs-dist` explicitly. |
| `fastify-type-provider-zod@7.x` | `fastify@^5.5.0`, `zod@>=4.1.5` | Zod 3 → won't work. Fastify 4 → won't work. |
| `@clerk/react@6.x` | `react@^18.0.0 \|\| ~19.x` | React 19 supported. `<SignedIn>`/`<Protect>` gone — use `<Show>`. |
| `@clerk/backend@3.x` | Any Node HTTP framework; pass verifier a `Request`-like object | Version 3.10.0 works with the Core 3 frontend. |
| `drizzle-orm@0.45.x` | `drizzle-kit@0.31.x`, `postgres@^3.4.x` | Kit + ORM have independent semver — that's normal. |
| Tailwind 4 | Needs a browser-native `@import` capable stylesheet; Vite handles this by default | Do not use PostCSS plugin patterns from Tailwind 3 docs — v4 uses `@tailwindcss/vite`. |

---

## Installation

Frontend (`apps/web`):

```bash
# core
pnpm add react@^19 react-dom@^19
pnpm add @tanstack/react-router @tanstack/react-query
pnpm add @clerk/react
pnpm add ky
pnpm add zustand
pnpm add react-hook-form @hookform/resolvers zod
pnpm add react-pdf
pnpm add @dnd-kit/core @dnd-kit/sortable
pnpm add sonner
pnpm add clsx tailwind-merge class-variance-authority

# dev
pnpm add -D vite @vitejs/plugin-react-swc
pnpm add -D typescript
pnpm add -D tailwindcss @tailwindcss/vite
pnpm add -D @biomejs/biome
pnpm add -D vitest jsdom
# optional: pnpm add -D @playwright/test
```

Backend (`apps/api`):

```bash
# core
pnpm add fastify @fastify/cors @fastify/sensible @fastify/helmet
pnpm add fastify-type-provider-zod
pnpm add @clerk/backend
pnpm add drizzle-orm postgres
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
pnpm add zod
pnpm add pino  # transitive via Fastify, but explicit is fine

# dev
pnpm add -D typescript tsx
pnpm add -D drizzle-kit
pnpm add -D pino-pretty
pnpm add -D vitest
```

Shared (`packages/shared`):

```bash
pnpm add zod
pnpm add -D typescript
```

---

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

---

## What NOT to Use

Actively avoid — commonly-suggested-for-React libraries that would be wrong for this stack.

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

---

## Stack Patterns by Variant

**If MinIO's community fork feels risky to you:**
- Alternative: pin `minio/minio` to `RELEASE.2025-09-07T16-13-09Z` (last stable before archive) and document it as a known-frozen pin in the README. Acceptable for MVP but not for a real product — the fork path is better.

**If TypeScript 6 turns out to be needed later:**
- Some libraries may not yet declare TS 6 compatibility. Stay on TS 5.8 for the MVP; upgrade once the ecosystem catches up (typically 3-6 months).

**If Clerk Core 3 migration feels risky:**
- You are starting greenfield. There is no v5 → v6 migration to perform. Install `@clerk/react@^6` directly. The risk described in the Clerk upgrade guides applies to existing v5 codebases.

**If the reviewer wants a testing story despite the 4-6h budget:**
- Ship Tier 1 (Vitest with `.inject()` API contract tests) + call it out in the README as "MVP testing footprint; component and E2E tests added in a hypothetical Phase 2." This is honest and defensible.

---

## Sources

**Live-verified via npm registry on 2026-07-03 (HIGH confidence):**
- All version numbers in tables above were fetched from `registry.npmjs.org/{pkg}/latest` on research date.
- Peer dependency checks against `registry.npmjs.org/{pkg}/{version}` metadata.

**Official documentation:**
- [Clerk Core 3 changelog (2026-03-03)](https://clerk.com/changelog/2026-03-03-core-3) — package rename + `<Show>` migration. HIGH confidence.
- [Clerk React quickstart](https://clerk.com/docs/quickstarts/react) — Vite env var handling. HIGH confidence.
- [TanStack Router authenticated routes guide](https://tanstack.com/router/latest/docs/framework/react/guide/authenticated-routes) — beforeLoad + context pattern. HIGH confidence.
- [MinIO releases (GitHub)](https://github.com/minio/minio/releases) — maintenance mode + Docker image status. HIGH confidence.
- [fastify-type-provider-zod peer requirements](https://registry.npmjs.org/fastify-type-provider-zod/7.0.0) — Fastify 5.5+, Zod 4.1.5+. HIGH confidence.
- [react-pdf transitive pdfjs-dist pin](https://registry.npmjs.org/react-pdf/10.4.1) — pdfjs-dist@5.4.296 exact pin. HIGH confidence.

**Ecosystem posts (MEDIUM confidence, referenced for context):**
- [MinIO Is Dead / MinIO Resurrect (Vonng blog)](https://blog.vonng.com/en/db/minio-resurrect/) — pgsty/minio fork rationale.
- [MinIO container images gone — best alternatives (DevPro, 2025)](https://devpro.fr/minio-container-images-gone-best-alternatives-2025/) — alternative images survey.
- [MinIO Is Done With Open Source (It's FOSS News)](https://itsfoss.com/news/minio-moves-away-from-open-source/) — timeline of the license/maintenance shift.

---

## Open Decisions for User

Before phase planning, the user should decide:

1. **Testing tier:** Tier 1 only (`.inject()` contract tests + `tsc`), or Tier 1 + Tier 2 (add one Playwright smoke test)? This shapes the phase budget.
2. **Fetch client:** Confirm `ky` is fine, or opt for `@better-fetch/fetch` if end-to-end Zod-inferred response types are a priority.
3. **MinIO image:** Confirm `pgsty/minio` is acceptable, or hold to a pinned `minio/minio` release with the console-removal caveat documented.
4. **Clerk package rename:** Confirm switching to `@clerk/react@^6` from day one (recommended) — no reason to install the legacy `@clerk/clerk-react` for a greenfield project in July 2026.

---

*Stack research for: Virtual Data Room / document management SPA*
*Researched: 2026-07-03*
