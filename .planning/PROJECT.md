# Dataroom MVP

## What This Is

A virtual Data Room web app — a Google Drive / Dropbox-like repository where a user can create datarooms, organize PDF documents into nested folders, and view them in-browser. Built as a take-home coding challenge for Acme Corp's engineering evaluation, framed around an M&A due-diligence use case.

## Core Value

A user can create a dataroom, upload a PDF into the right folder, and immediately view it — the create → upload → view flow must feel instantaneous and never lose a file.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. Full breakdown lives in REQUIREMENTS.md. -->

- [ ] Users can sign in (Clerk magic-link, no shared demo account)
- [ ] Users can create, view, and delete their own datarooms
- [ ] Users can create nested folders inside a dataroom
- [ ] Users can rename and delete folders (cascade delete of nested contents)
- [ ] Users can upload PDF files into a folder (direct-to-storage via presigned PUT)
- [ ] Users can view uploaded PDFs in an in-app viewer (react-pdf, custom controls)
- [ ] Users can rename and delete files
- [ ] Users get immediate feedback on all mutations (optimistic UI for rename/delete/create/move; upload state for uploads)
- [ ] Same-filename conflicts within a folder are handled gracefully (UNIQUE constraint → 409 → rename/overwrite prompt)
- [ ] Frontend deployed to Vercel; backend + Postgres + MinIO deployed to Dokploy VPS with LE certs
- [ ] README documents design decisions and setup steps for reviewer

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- **Multi-tenancy / team collaboration / sharing** — Each user has their own datarooms. TASK.md scope does not mention sharing; a due-diligence dataroom in real life would need it, but the take-home does not.
- **Full-text search inside PDF content** — Table stakes for real due diligence but a full day of work for MVP (embedding pipeline or pg_trgm + PDF text extraction). Filename filter on the client is enough for the demo.
- **Non-PDF file types** — TASK.md explicitly limits scope to PDF; other formats add mime-detection, thumbnail, and viewer branches with no evaluation upside.
- **Password reset / email verification UIs** — Clerk handles all of these behind its default flows; building custom screens is wasted time.
- **Theme presets / theme switcher** — Light/dark toggle only. Multi-preset color pickers are decorative, not evaluated.
- **Audit log / activity feed / notifications** — Not in TASK.md, not necessary to prove the core CRUD flow works.
- **Real-time collaboration (websockets)** — Single-user scope; websockets are complexity without payoff for MVP.
- **SSR / SEO** — All content sits behind Clerk auth. There is no public surface to index.

## Context

**Evaluation framing:**
- 4-6 hour nominal budget per TASK.md (user may exceed for polish).
- Reviewer will read the code, run it locally, and open the hosted URL.
- Scoring priorities in strict order: **UX & functionality → design & polish → code quality**. Storage speed, backend architecture, and infra are NOT explicitly evaluated; they are self-imposed to demonstrate production-grade thinking.

**Deployment reality:**
- Existing Dokploy infra on Contabo VPS (`62.171.189.125`) under umbrella `holy-water.app`. Product subdomain: `dataroom.holy-water.app`. Backend at `api.dataroom.holy-water.app`, storage at `minio.dataroom.holy-water.app`.
- Cloudflare DNS + Let's Encrypt via Traefik. First-deploy sequence: A-record `proxied:false` → Dokploy provisions → LE cert → optionally flip to `proxied:true`.
- Backend + MinIO + Postgres live in a single Docker compose on the VPS; backend ↔ MinIO over Docker network (LAN speed, no Traefik hop).

**Technical anchors:**
- Frontend: Vite + React 19 + TypeScript + Tailwind 4 + shadcn/ui (46 primitives copied from user's own template `next-shadcn-admin-dashboard`, gitignored in `.reference/`).
- Routing: TanStack Router (type-safe params, prefetch integrates with React Query cache).
- Frontend architecture: Feature-Sliced Design (FSD) with layers `app / pages / widgets / features / entities / shared`. Container/Presenter split applied pragmatically (all meaningful logic in hooks, view/container split only when reuse or testability justifies it).
- Backend: Fastify + Drizzle ORM + `@aws-sdk/client-s3` for MinIO. Files uploaded direct-to-MinIO via presigned PUT URLs — backend never touches file bytes.
- Auth: Clerk (`@clerk/clerk-react` frontend, `@clerk/backend` backend JWT verify). Demo mode uses magic-link so reviewer signs in without a shared password.
- Shared package: `packages/shared` holds Zod schemas + inferred TS types (Dataroom / Folder / File models, request/response DTOs, error codes). Consumed by both `apps/web` and `apps/api`.
- Repo: pnpm workspaces + Turborepo. Biome for lint + format (from template, faster than ESLint+Prettier).

**Perceived speed strategy:**
- React Query with `staleTime: 5min` + prefetch-on-hover for folder navigation
- Optimistic mutations for rename / delete / create-folder / move (React Query `onMutate`+`onError` rollback)
- Upload is NOT optimistic — shown as a pending row with progress bar; keeps a retry button on failure
- Skeletons, not spinners
- Client-side filename filter for zero-latency search

## Constraints

- **Tech stack**: React SPA on Vite (no Next.js), Fastify backend, Postgres + MinIO — locked in during scoping conversation. Deviations require explicit re-scoping.
- **Timeline**: TASK.md nominal 4-6h. Real budget is elastic but every hour on infra is an hour not spent on UX polish, which is the #1 scored dimension.
- **Deployment**: Dokploy on Contabo VPS (backend + storage + DB) + Vercel (frontend). Predefined domains under `holy-water.app`.
- **Storage protocol**: S3-compatible API only. This unlocks direct-to-storage upload via presigned URLs and preserves the option to swap MinIO for R2/S3 later with an env var change.
- **Frontend architecture**: FSD layers with strict layer-direction rules. All React Query calls live in hooks; components receive props. React Query owns server state; Zustand owns client state; no overlap.
- **File support**: PDF only (TASK.md limit); UNIQUE `(folderId, name)` at DB layer; ownership check on every backend mutation.
- **Auth**: Clerk-hosted; no custom auth flows.

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Full-stack over MVP-first (real backend, not IndexedDB mock) | User chose to demonstrate production-grade thinking despite TASK.md permitting mocked storage | — Pending |
| Vite + React SPA (no Next.js) | Content sits behind auth so SSR/SEO offer nothing; Vite HMR is faster; FSD structure is cleaner without Next `app/` collision | — Pending |
| TanStack Router over React Router v7 | Same-author integration with React Query, type-safe path params, prefetch-on-hover with cache priming | — Pending |
| FSD + pragmatic Container/Presenter | User-requested; enforces logic-in-hooks discipline including for React Query; view/container split only when it earns its keep | — Pending |
| MinIO (self-hosted S3) over R2/S3/filesystem | S3 API preserves migration path with an env var change; local dev via one Docker container; no external accounts for reviewer; low egress on Contabo | — Pending |
| Direct-to-MinIO presigned PUT uploads (never proxied through Fastify) | Backend never bottlenecks file bytes; matches how real Drive-like products work; supports resumable multipart later | — Pending |
| Postgres in same Dokploy compose (not Neon) | Zero external dependencies for reviewer; backend↔DB over Docker network; self-hosted stack reads cleaner in code review | — Pending |
| Drizzle over Prisma | No engine binary; honest SQL; better types for query builder; simpler migrations on VPS | — Pending |
| Fastify over Hono | Schema-first Zod integration via `fastify-type-provider-zod`; mature Node ecosystem; strong plugin story | — Pending |
| Clerk over custom auth | Zero-time-cost of adding auth; magic-link demo mode = reviewer signs in without a shared password; TASK.md ranks auth as extra credit | — Pending |
| `react-pdf` over `<iframe>` viewer | In-app custom controls (pages, zoom) match the design-and-polish scoring dimension; iframe UI looks foreign inside a polished app | — Pending |
| Monorepo (pnpm + Turborepo) over two repos | Shared Zod schemas + TS types between web and api eliminate DTO drift; single-clone setup for reviewer | — Pending |
| Template used only as UI copy source (gitignored `.reference/`) | Template gives us 46 shadcn primitives + config, but its Next routing + dashboard boilerplate would clash with our FSD scope | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-03 after initialization*
