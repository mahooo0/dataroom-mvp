# Dataroom MVP

Virtual Data Room — Google Drive-style repository for M&A due-diligence PDFs. Take-home coding challenge for Acme Corp.

Live demo: _(to be added when Phase 9 ships)_

## Stack (Phase 1 — Bootstrap)

- **Frontend:** Vite + React 19 + TypeScript + Tailwind 4 + shadcn/ui + TanStack Router + React Query + Clerk
- **Backend:** Fastify 5 + Drizzle ORM + Zod validation + Clerk JWT verification
- **Storage:** Postgres 16 (metadata) + MinIO (files, S3-compatible)
- **Monorepo:** pnpm workspaces + Turborepo + Biome + Husky

Detailed rules and rationale live in `CLAUDE.md`. Roadmap in `.planning/ROADMAP.md`.

## Local Development

### Prerequisites

- Node.js 22+ (`.nvmrc` provided — `nvm use`)
- pnpm 10+ (`corepack enable && corepack prepare pnpm@10.5.2 --activate`)
- Docker + Docker Compose
- A Clerk account with a **development instance** — [dashboard.clerk.com](https://dashboard.clerk.com/apps)

### One-time setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp apps/api/.env.example apps/api/.env.local
cp apps/web/.env.example apps/web/.env.local

# Then edit both:
# - apps/api/.env.local → paste your Clerk secret + publishable keys
# - apps/web/.env.local → paste the same Clerk publishable key
```

### Run

```bash
# Start Postgres + MinIO in Docker
pnpm db:up

# Push schema to Postgres (dev — no migration files)
pnpm --filter api db:push

# Start API + web with hot reload
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173). Sign in via Clerk magic link — after auth you land on `/datarooms` (empty state; create button ships in Phase 2).

**Ports:**

| Service | URL |
|---------|-----|
| Web (Vite) | http://localhost:5173 |
| API (Fastify) | http://localhost:3001 |
| Postgres | localhost:5432 (user `dev` / db `dataroom`) |
| MinIO S3 API | http://localhost:9000 |
| MinIO Console | http://localhost:9001 (login `minio-dev` / `minio-dev-password`) |

### Common commands

```bash
pnpm dev              # start web + api together (turbo)
pnpm db:up            # postgres + minio up
pnpm db:down          # postgres + minio down (data preserved in named volumes)
pnpm db:reset         # nuke volumes and start fresh (destroys all local data)
pnpm db:push          # push Drizzle schema to Postgres (dev workflow)
pnpm check:fix        # biome lint + format
pnpm typecheck        # tsc across all workspaces
```

## Architecture

- `apps/web` — Vite React SPA (deploys to Vercel)
- `apps/api` — Fastify backend (deploys to Dokploy on VPS)
- `packages/shared` — Zod schemas and typed error codes shared between web and api
- `docker/docker-compose.dev.yml` — Postgres + MinIO for local dev
- `docker-compose.prod.yml` — Full stack for Dokploy deploy (api + postgres + minio)

Frontend follows **Feature-Sliced Design**: `app → pages → widgets → features → entities → shared`.
Backend uses **plugin → route → service → db** with a `packages/shared` boundary for schemas.

Full architecture rules in [`CLAUDE.md`](./CLAUDE.md).

## Health Check

```bash
# Liveness (unauth)
curl http://localhost:3001/health

# Auth roundtrip — requires a valid Clerk session token
# (the browser handles this automatically after sign-in)
curl -H "Authorization: Bearer $CLERK_TOKEN" http://localhost:3001/me
```
