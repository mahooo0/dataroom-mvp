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
- SSH access to the Dokploy VPS (alias `holy-water` in `~/.ssh/config`)
- A Clerk account linked to the Data Room app (`app_3G0XlsUZgUI57guII4tDaEUEgPV`)

**Dev infrastructure** (Postgres + MinIO) lives on Dokploy, not locally.
See `docker-compose.dev-infra.yml` and Dokploy project `Data Room`.

### One-time setup

```bash
# 1. Install dependencies
pnpm install

# 2. Pull Clerk env vars (needs `clerk auth login` first)
(cd apps/web && clerk env pull)

# 3. Copy the same Clerk publishable key into apps/api/.env.local plus
#    DATABASE_URL, S3_* and other values (see apps/api/.env.example for shape).
#    Ask a teammate for the current MinIO + Postgres secrets — they live in
#    Dokploy, not in this repo.
```

### Run

```bash
# 1. Open SSH tunnel to remote Postgres (keep terminal open, or use tunnel:bg)
pnpm tunnel

# 2. In another terminal — push schema if not applied yet
pnpm db:push

# 3. Start API + web with hot reload
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173). Sign in via Clerk magic link — after auth you land on `/datarooms` (empty state; create button ships in Phase 2).

**Ports:**

| Service | URL |
|---------|-----|
| Web (Vite) | http://localhost:5173 |
| API (Fastify) | http://localhost:3001 |
| Postgres | localhost:25432 (via SSH tunnel → VPS 127.0.0.1:15432) |
| MinIO S3 API | https://minio.dataroom.holy-water.app |
| MinIO Console | https://minio-console.dataroom.holy-water.app |

### Common commands

```bash
pnpm dev              # start web + api together (turbo)
pnpm tunnel           # SSH tunnel to remote Postgres (foreground)
pnpm tunnel:bg        # SSH tunnel in background
pnpm db:push          # push Drizzle schema to remote Postgres (dev workflow)
pnpm db:studio        # open Drizzle Studio against remote Postgres
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
