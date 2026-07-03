# Architecture Research

**Domain:** Virtual Data Room (Drive-like SPA + presigned-URL upload service)
**Researched:** 2026-07-03
**Confidence:** HIGH (high-level architecture is locked in `.planning/PROJECT.md` and `CLAUDE.md`; this document is the implementation-level translation)

> **Scope note.** The high-level architecture (Vite SPA + FSD + TanStack Router + React Query + Zustand ↔ Fastify + Drizzle + Postgres + MinIO, presigned-URL uploads, Clerk auth) is **locked**. This file does **not** re-propose it. It answers the 8 downstream questions in the milestone context: build order, FSD component boundaries, Fastify module boundaries, folder-tree data flow, upload-flow error cases, local↔prod parity, migration workflow, and testing scope.

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                    BROWSER  (apps/web — Vercel)                       │
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │                          app/  (init)                          │   │
│  │  QueryClientProvider · ClerkProvider · RouterProvider ·        │   │
│  │  ThemeProvider · Toaster                                       │   │
│  └────────────────────────────────┬──────────────────────────────┘   │
│                                   │                                    │
│  ┌────────────────────────────────▼──────────────────────────────┐   │
│  │  pages/    DataroomListPage · DataroomPage · SignInPage        │   │
│  └────────────────────────────────┬──────────────────────────────┘   │
│                                   │                                    │
│  ┌────────────────────────────────▼──────────────────────────────┐   │
│  │  widgets/  <DataroomHeader>  <FolderTree>  <FileGrid>          │   │
│  │            <FileViewer>      <UploadDropZone>  <Breadcrumbs>   │   │
│  └────────────────────────────────┬──────────────────────────────┘   │
│                                   │                                    │
│  ┌────────────────────────────────▼──────────────────────────────┐   │
│  │  features/ create-folder · rename-folder · delete-folder ·    │   │
│  │            upload-file · rename-file · delete-file ·           │   │
│  │            move-file · create-dataroom · delete-dataroom       │   │
│  └────────────────────────────────┬──────────────────────────────┘   │
│                                   │                                    │
│  ┌────────────────────────────────▼──────────────────────────────┐   │
│  │  entities/ dataroom (queries)  folder (queries)  file (queries)│   │
│  └────────────────────────────────┬──────────────────────────────┘   │
│                                   │                                    │
│  ┌────────────────────────────────▼──────────────────────────────┐   │
│  │  shared/ ui (shadcn) · api (fetch client) · lib (formatters)  │   │
│  │          config · hooks · errors (typed codes from shared pkg) │   │
│  └────────────────────────────────┬──────────────────────────────┘   │
└───────────────────────────────────┼───────────────────────────────────┘
                                    │  HTTPS  (Clerk JWT in Authorization)
                                    │  (except presigned PUT/GET → MinIO direct)
┌───────────────────────────────────▼───────────────────────────────────┐
│              api.dataroom.holy-water.app  (Fastify — Dokploy)         │
│                                                                        │
│  plugins/   clerk-jwt · zod-provider · cors · request-context         │
│  hooks/     preHandler: resolveResource → assertOwner                 │
│                                                                        │
│  routes/                                                               │
│    /datarooms          list · create · delete                         │
│    /datarooms/:id      get · tree                                     │
│    /folders            create · rename · move · delete                │
│    /folders/:id        children (paginated) · breadcrumb              │
│    /files              init-upload · complete-upload                  │
│    /files/:id          rename · move · delete · download-url          │
│                                                                        │
│  services/                                                             │
│    dataroom.service.ts   folder.service.ts   file.service.ts          │
│    storage.service.ts    ← wraps 2× S3Client (internal + public)      │
│    ownership.service.ts  ← resource → ownerId resolution              │
│                                                                        │
│  db/                                                                   │
│    schema.ts (Drizzle) · queries/ (typed query fns) · client.ts       │
└───────────────┬───────────────────────────────────┬───────────────────┘
                │                                   │
                │  Docker network (LAN)             │
        ┌───────▼────────┐                  ┌───────▼───────────────┐
        │  Postgres 16   │                  │  MinIO                │
        │  (volume)      │                  │  Internal: minio:9000 │
        │  metadata only │                  │  Public:              │
        └────────────────┘                  │  minio.dataroom...    │
                                            │  (Docker volume)      │
                                            └───────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `app/` | Provider composition, router mount, global styles | `main.tsx` + `providers.tsx` + `router.tsx` |
| `pages/` | One component per route; only compose widgets; hold route params | Thin — pull params from `Route.useParams()`, pass to widgets |
| `widgets/` | Composite blocks with cross-feature composition | `<FolderTree>`, `<FileGrid>`, `<FileViewer>`, `<UploadDropZone>`, `<DataroomHeader>`, `<Breadcrumbs>` |
| `features/` | One user use case = one folder | Container + view + `use-*` hook (mutation + optimistic update) |
| `entities/` | Domain read model + entity UI | React Query **queries** live here (not mutations); types re-exported from `packages/shared` |
| `shared/` | Reusable primitives with zero domain knowledge | `ui/` (shadcn), `api/` (fetch client + error normalization), `lib/` (formatters), `hooks/` (generic), `config/` (env, keys factory) |
| Fastify `routes/` | HTTP boundary; Zod I/O schemas; call one service; map errors | ~15 route files, grouped by resource |
| Fastify `services/` | Business logic; DB + storage orchestration; ownership assertion | Pure TS functions; no Fastify types leak in |
| Fastify `db/` | Schema (single `schema.ts`) + typed query functions | Drizzle; queries as named exports (`getFolderChildren`, `deleteFolderCascade`) |
| `packages/shared` | Zod schemas + inferred DTOs + typed error codes | Consumed by both apps; single source of truth for the wire contract |

---

## Recommended Project Structure

### Frontend — `apps/web/src/`

```
app/
├── main.tsx                       # entry
├── providers.tsx                  # QueryClient · Clerk · Theme · Sonner
├── router.tsx                     # TanStack route tree
└── styles/                        # global.css, tailwind base

pages/
├── sign-in/SignInPage.tsx
├── datarooms/DataroomListPage.tsx      # /datarooms
├── dataroom/DataroomPage.tsx           # /datarooms/$dataroomId (+ ?folderId=)
└── not-found/NotFoundPage.tsx

widgets/
├── dataroom-header/               # title, breadcrumbs slot, upload button
├── folder-tree/                   # left sidebar tree (lazy-expand)
├── file-grid/                     # right pane: rows of files + inline folders
├── file-viewer/                   # react-pdf modal / route panel
├── upload-drop-zone/              # dnd-kit drop overlay (covers file-grid)
└── breadcrumbs/                   # /root/A/B/C for current folder

features/
├── create-dataroom/               # dialog + POST /datarooms
├── delete-dataroom/               # confirm + DELETE /datarooms/:id
├── create-folder/                 # dialog + POST /folders (optimistic)
├── rename-folder/                 # inline + PATCH /folders/:id (optimistic)
├── delete-folder/                 # confirm + DELETE /folders/:id (cascade)
├── move-folder/                   # dnd + PATCH /folders/:id (optimistic)
├── upload-file/                   # THE big feature: init → PUT → complete
├── rename-file/                   # inline + PATCH /files/:id (optimistic)
├── delete-file/                   # confirm + DELETE /files/:id (optimistic)
└── move-file/                     # dnd + PATCH /files/:id (optimistic)

entities/
├── dataroom/
│   ├── model/use-dataroom-list.ts       # GET /datarooms
│   ├── model/use-dataroom.ts            # GET /datarooms/:id
│   ├── model/keys.ts                    # dataroomKeys factory
│   └── ui/DataroomCard.view.tsx
├── folder/
│   ├── model/use-folder-children.ts     # GET /folders/:id/children
│   ├── model/use-folder-breadcrumb.ts   # GET /folders/:id/breadcrumb
│   ├── model/keys.ts                    # folderKeys factory
│   └── ui/FolderRow.view.tsx
└── file/
    ├── model/use-file.ts                # GET /files/:id
    ├── model/use-file-download-url.ts   # GET /files/:id/download-url
    ├── model/keys.ts
    └── ui/FileRow.view.tsx

shared/
├── ui/                             # 46 shadcn primitives (Next-isms stripped)
├── api/
│   ├── fetch-client.ts             # ky/fetch wrapper; attaches Clerk token; parses errors
│   ├── api-error.ts                # ApiError class w/ typed code
│   └── xhr-upload.ts               # XHR wrapper for presigned PUT with progress
├── lib/
│   ├── format-bytes.ts
│   ├── format-date.ts
│   └── conflict-resolver.ts        # "file already exists" name generation
├── hooks/
│   ├── use-debounced.ts
│   └── use-mounted.ts
├── config/
│   ├── env.ts                      # VITE_* validated with Zod at boot
│   └── query-client.ts             # staleTime, retry policy
└── errors/                         # re-exports codes from packages/shared
```

### Backend — `apps/api/src/`

```
server.ts                           # buildServer() — export for tests; listen in main.ts
main.ts                             # import buildServer(); listen
plugins/
├── clerk-auth.ts                   # decorates req.userId; verify JWT once
├── zod-provider.ts                 # fastify-type-provider-zod setup
├── cors.ts                         # allowed origins from env
└── error-handler.ts                # ApiError → HTTP status + typed code payload

hooks/
└── ownership.ts                    # factory: assertOwns(resourceKind, paramName)

routes/
├── datarooms/
│   ├── index.ts                    # GET /, POST /, DELETE /:id
│   └── tree.ts                     # GET /:id/tree (initial folder tree)
├── folders/
│   ├── index.ts                    # POST /, PATCH /:id, DELETE /:id
│   └── children.ts                 # GET /:id/children, GET /:id/breadcrumb
└── files/
    ├── index.ts                    # PATCH /:id, DELETE /:id
    ├── upload.ts                   # POST /init, POST /:id/complete
    └── download.ts                 # GET /:id/download-url

services/
├── dataroom.service.ts
├── folder.service.ts               # incl. deleteFolderCascade()
├── file.service.ts
├── ownership.service.ts            # resolves resource → ownerId
└── storage.service.ts              # 2× S3Client; presign PUT/GET; head/delete

db/
├── client.ts                       # drizzle(pg) singleton
├── schema.ts                       # Dataroom, Folder, File tables + relations
└── queries/
    ├── datarooms.ts
    ├── folders.ts                  # incl. WITH RECURSIVE for tree/cascade
    └── files.ts

config/
└── env.ts                          # Zod-validated env: DATABASE_URL, CLERK_*, S3_*

errors.ts                           # thin re-export of packages/shared/errors
```

### Shared — `packages/shared/src/`

```
schemas/
├── dataroom.ts                     # Zod: DataroomSchema, CreateDataroomInput
├── folder.ts                       # Zod: FolderSchema, CreateFolderInput, RenameInput
├── file.ts                         # Zod: FileSchema, InitUploadInput, InitUploadOutput
└── common.ts                       # UUID, timestamp, pagination cursor

errors.ts                           # ERROR_CODES enum + ApiErrorShape
index.ts                            # public exports (schemas + inferred types)
```

### Structure Rationale

- **FSD layer order:** enforced by the layered lint rule (upper imports lower only). `features` may compose `entities` + `shared`; `entities` may not know about features.
- **All React Query calls in hooks under `entities/model/` (queries) or `features/model/` (mutations)** — components stay pure JSX-and-props. This is a locked rule from CLAUDE.md.
- **One file per resource route group** in Fastify — 15 endpoints in ~9 files. Splitting one-endpoint-per-file is 25+ tiny files with no upside for a 4-6h build.
- **`storage.service.ts` owns both S3Clients.** Route handlers never touch the SDK directly — prevents accidentally presigning with the internal (`minio:9000`) client, which is the #1 self-inflicted upload bug.
- **`ownership.service.ts` centralises "does user X own resource Y?"** as `assertOwnsFolder(userId, folderId)` etc. Called from the Fastify `preHandler` hook, so every mutating route gets it for free.
- **`packages/shared` never depends on the runtime.** Only Zod and inferred types. Both apps import from it; drift between DTO and validator becomes structurally impossible.

---

## Architectural Patterns

### Pattern 1: Presigned-URL Upload (three-step ceremony)

**What:** Frontend never sends bytes to the backend. Backend issues a short-lived presigned PUT URL, browser uploads directly to MinIO, then frontend calls a `complete` endpoint that verifies the object exists via `HeadObject`.

**When to use:** Any time a client uploads a file to S3-compatible storage and you want the API server to stay stateless and never bottleneck on bandwidth. This is the standard pattern for Drive-like products.

**Trade-offs:**
- ✔ Backend never handles file bytes → no timeout, no memory pressure, horizontal scaling free.
- ✔ Progress bar is trivial (XHR/fetch upload progress on the direct PUT).
- ✖ Two-phase commit: the browser can complete the PUT and fail to call `complete`, leaving orphan objects or `pending` DB rows. Requires a cleanup story.
- ✖ CORS on MinIO must be configured or the browser silently blocks the PUT.
- ✖ Two `S3Client` instances required in prod (internal for `HeadObject`/`DeleteObject`, public for presigning). Mixing them = "hostname not resolvable" in the browser.

**Example:**
```typescript
// storage.service.ts
export const publicS3 = new S3Client({
  endpoint: env.S3_ENDPOINT_PUBLIC,       // https://minio.dataroom...
  region: 'us-east-1', forcePathStyle: true,
  credentials: { accessKeyId: env.S3_KEY, secretAccessKey: env.S3_SECRET },
});
export const internalS3 = new S3Client({
  endpoint: env.S3_ENDPOINT_INTERNAL,     // http://minio:9000
  region: 'us-east-1', forcePathStyle: true,
  credentials: { accessKeyId: env.S3_KEY, secretAccessKey: env.S3_SECRET },
});

export async function presignPut(s3Key: string, contentType: string) {
  return getSignedUrl(
    publicS3,
    new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: s3Key, ContentType: contentType }),
    { expiresIn: 300 },
  );
}

export async function objectExists(s3Key: string) {
  try { await internalS3.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: s3Key })); return true; }
  catch (e: any) { if (e.$metadata?.httpStatusCode === 404) return false; throw e; }
}
```

### Pattern 2: Ownership Preflight via Fastify Hook

**What:** A `preHandler` hook resolves the resource identified by the route param (e.g. `:folderId`), fetches its `ownerId`, and compares against `req.userId` set by the Clerk plugin. Routes never call the check manually.

**When to use:** Any project where every mutating endpoint requires "user owns the resource." Prevents the class of bug where a developer forgets to add `AND owner_id = ?` to a query.

**Trade-offs:**
- ✔ Impossible to forget — enforced at framework level.
- ✔ One extra DB round-trip per mutation (fast: single-row PK lookup).
- ✖ Coupling: the hook must know each resource kind. Kept in `hooks/ownership.ts` with one factory per kind.

**Example:**
```typescript
// hooks/ownership.ts
export const assertOwnsFolder = (paramName = 'folderId') => async (req: FastifyRequest) => {
  const id = (req.params as any)[paramName];
  const ownerId = await ownership.folderOwner(id);
  if (!ownerId) throw new ApiError('NOT_FOUND', 404);
  if (ownerId !== req.userId) throw new ApiError('FORBIDDEN', 403);
};

// routes/folders/index.ts
fastify.patch('/folders/:folderId', {
  schema: renameFolderSchema,
  preHandler: [assertOwnsFolder('folderId')],
}, handler);
```

### Pattern 3: Optimistic Mutation with Rollback (React Query)

**What:** For rename/delete/create/move — write the target state into the cache synchronously in `onMutate`, keep a snapshot for `onError` rollback, invalidate in `onSettled`. Upload is explicitly **not** optimistic (it shows a pending row with progress).

**When to use:** Latency-sensitive UI where the user expects instant feedback and the mutation almost always succeeds. Perfect for CRUD in a Drive-like app.

**Trade-offs:**
- ✔ Feels instant.
- ✖ You now maintain two mental models (server truth vs optimistic guess). Rollback code must be correct.
- ✖ Conflict cases (409 UNIQUE) need special handling — rollback + open rename/overwrite prompt.

**Example:**
```typescript
export const useRenameFolder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; parentId: string | null; name: string }) => api.renameFolder(v),
    onMutate: async (v) => {
      const key = folderKeys.children(v.parentId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Folder[]>(key);
      qc.setQueryData<Folder[]>(key, (old) => old?.map(f => f.id === v.id ? { ...f, name: v.name } : f) ?? []);
      return { prev, key };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
      if (err instanceof ApiError && err.code === 'FOLDER_NAME_TAKEN') openConflictDialog();
      else toast.error('Rename failed');
    },
    onSettled: (_r, _e, v) => qc.invalidateQueries({ queryKey: folderKeys.children(v.parentId) }),
  });
};
```

### Pattern 4: Lazy-Expand Folder Tree (per-node queries)

**What:** The `<FolderTree>` widget renders a stub for each folder. Expanding a node triggers `useFolderChildren(nodeId)` — one React Query per expanded folder. Nodes with `childFolderCount > 0` show an expander chevron even before their children are loaded.

**When to use:** Trees where full traversal is expensive and users rarely expand more than a few branches. Matches typical Drive UX.

**Trade-offs:**
- ✔ Fast initial paint — `/datarooms/:id/tree` returns only root children.
- ✔ Prefetch-on-hover primes the cache before click.
- ✔ Cache keys naturally scope to `folderKeys.children(parentId)` — invalidation is surgical.
- ✖ Deep-linking a folder path requires resolving `breadcrumb(folderId) → [ancestors...]` and expanding them; extra endpoint (`GET /folders/:id/breadcrumb`).

### Pattern 5: Typed Error Codes at the Wire

**What:** `packages/shared/errors.ts` exports a string-literal union `ErrorCode`. Fastify's error handler serializes `{ code, message }`; frontend fetch-client parses to `ApiError` with `.code` typed. Mutations switch on codes, never on message strings.

**When to use:** Any full-stack app where the frontend needs to respond differently to specific server errors (e.g. 409 name-taken → open rename dialog).

**Trade-offs:**
- ✔ Refactoring an error code renames it across frontend + backend at once (TS compile error).
- ✔ i18n-friendly — the frontend controls user-visible copy.
- ✖ Tiny discipline cost: throw `ApiError(code)` not `throw new Error('...')`.

### Pattern 6: XHR (not fetch) for Presigned PUT

**What:** Use `XMLHttpRequest.upload.onprogress` for real progress events; `fetch` still lacks reliable request-body upload progress in most browsers.

**When to use:** Any file upload UI that shows a progress bar during the PUT.

**Trade-offs:**
- ✔ Progress works consistently.
- ✖ Callback style vs Promises; wrap it once in `shared/api/xhr-upload.ts`.

---

## Data Flow

### The upload path — the critical flow to get right

```
[User drops file / picks in dialog]
        │
        ▼
[features/upload-file/model/use-upload]      ─── local Zustand row created (status: 'queued')
        │                                          NOT written to React Query cache
        ▼
POST /files/init                              ─── Fastify:
  { folderId, name, mimeType, size }              1. clerk-auth resolves userId
                                                   2. assertOwnsFolder hook
                                                   3. file.service.initUpload():
                                                      - validate mime === application/pdf
                                                      - validate size ≤ 50MB
                                                      - INSERT File(status='pending')
                                                        catches UNIQUE(folderId,name)
                                                        → 409 FILE_NAME_TAKEN
                                                      - storage.presignPut(s3Key)
                                                   4. return { fileId, uploadUrl, s3Key }
        │
        ▼  (409? → open rename/overwrite dialog; user picks new name; retry from POST init)
        │
[XHR PUT uploadUrl with file bytes]           ─── Direct browser → MinIO
  Content-Type: application/pdf                   Progress events update Zustand row
                                                  (0-100%). NOT in React Query cache
                                                  because upload state is client state.
        │
        ▼  (on network error → row stays; user can Retry with fresh /init call)
        │
POST /files/{fileId}/complete                 ─── Fastify:
                                                   1. clerk-auth + assertOwnsFile
                                                   2. file.service.completeUpload():
                                                      - storage.objectExists() via
                                                        INTERNAL S3Client
                                                      - UPDATE File SET status='ready'
                                                   3. return final File
        │
        ▼
[features/upload-file writes File into
 folderKeys.children(folderId)]                ─── React Query cache primed;
                                                  file-grid re-renders with new row;
                                                  Zustand pending row cleared.
```

### Folder tree render + navigate

```
[User opens dataroom page]
        │
        ▼
useDataroomTree(dataroomId)   ── GET /datarooms/:id/tree
                                 returns [{ id, name, childFolderCount, hasFiles }, …]
                                 for root-level folders only
        │
        ▼
[<FolderTree> renders stubs; expander shown if childFolderCount > 0]
        │
        ▼ (user hovers a folder)
prefetchFolderChildren(folderId)   ─── warms folderKeys.children(id) into cache
        │
        ▼ (user clicks / expands)
useFolderChildren(folderId)        ─── GET /folders/:id/children
                                       returns { folders: […], files: […] }
        │
        ▼
[<FileGrid> renders right pane;
 breadcrumb updates via useFolderBreadcrumb(folderId)]
```

### Recursive folder delete

```
DELETE /folders/:id
   │
   ├─ 1. assertOwnsFolder(id)
   │
   ├─ 2. folder.service.deleteCascade(id):
   │
   │    ┌─ collect s3Keys of ALL descendant files ─┐
   │    │  WITH RECURSIVE descendants AS (          │
   │    │    SELECT id FROM folders WHERE id = $1   │
   │    │    UNION ALL                              │
   │    │    SELECT f.id FROM folders f             │
   │    │    JOIN descendants d ON f.parent_id=d.id │
   │    │  )                                        │
   │    │  SELECT s3_key FROM files                 │
   │    │  WHERE folder_id IN (SELECT id FROM descendants)
   │    └───────────────────────────────────────────┘
   │
   ├─ 3. DELETE FROM folders WHERE id = $1
   │    (FK ON DELETE CASCADE removes descendant folders + files rows)
   │
   └─ 4. storage.deleteObjectsBatch(s3Keys)     ─── best-effort;
                                                    log failures, don't fail HTTP.
                                                    Orphaned MinIO objects are
                                                    acceptable for MVP.
```

**MVP choice:** synchronous cascade cleanup inside the request. No job queue. Reasoning: (a) typical dataroom has 10s–100s of files, well within a 5-second HTTP budget; (b) BullMQ / Redis adds infra for an evaluation project; (c) failure mode of orphan MinIO objects is invisible to the reviewer.

### State ownership summary

| State | Owner | Rationale |
|-------|-------|-----------|
| Dataroom list, folder tree, file lists, file metadata | React Query | Server state; single source of truth is the API |
| Current selection (row highlighted, checkbox picks) | Zustand | Ephemeral UI |
| Active upload sessions (fileId → progress %) | Zustand | Belongs to the browser session only; never persisted server-side |
| Dark/light theme | Zustand + localStorage | Preference, not server data |
| Dialog open flags | Component-local `useState` | Not shared across the tree |
| Route params (dataroomId, folderId) | TanStack Router | Single source, type-safe |

---

## Build Order — Phase Decomposition

> Constraint: 4-6h nominal budget, UX-first scoring. Every deferred piece is a risk-reduced piece. Vertical slice first, then breadth.

### Recommendation: **vertical slice, then breadth, then polish**

**Anti-recommendation:** Do **not** build the full backend first, then the frontend. If a critical infra bug (Clerk JWT verify, MinIO CORS, presigned URL host mismatch) surfaces at hour 4, you have no UX polish time. Prove the critical path end-to-end in phase 1.

### Phase-by-phase

| # | Phase | Deliverable | Why here |
|---|-------|-------------|----------|
| 1 | **Bootstrap + critical path** | Monorepo boots. `docker-compose.dev.yml` up. Clerk sign-in works. `GET /health` returns userId. Empty dataroom list page renders. | Proves infra before feature work. Every downstream phase assumes these work. |
| 2 | **Data model + first vertical slice: create dataroom → view it** | Drizzle schema + push. `POST /datarooms`, `GET /datarooms`, `DELETE /datarooms/:id`. Frontend list + create + delete with optimistic updates. Ownership hook wired. | Cheapest end-to-end proof of the ownership pattern, error normalisation, React Query optimistic mutations, and shared Zod. Everything after this is repetition of the shape. |
| 3 | **Folder CRUD (non-recursive first)** | Schema for Folder. `POST/PATCH/DELETE /folders`, `GET /folders/:id/children`. `<FolderTree>` renders one level, `<FileGrid>` renders folders only. Breadcrumb. | Files come next; folder tree must render before files can be shown inside it. |
| 4 | **Upload path — the risky one** | `POST /files/init`, `POST /files/:id/complete`. MinIO bucket + CORS configured. XHR upload wrapper. `<UploadDropZone>` widget. Pending-row UX with progress + retry + error states. | This is the highest-risk feature. Do it before the viewer and before recursive delete — if CORS or presign fails, you must uncover it now, not in the last hour. |
| 5 | **File CRUD (rename, delete, download-url)** | `PATCH/DELETE /files/:id`, `GET /files/:id/download-url`. File rows with menu. | Symmetric with folder CRUD; reuses established optimistic pattern. |
| 6 | **PDF viewer** | `react-pdf` viewer widget. Fetches download URL, renders with page/zoom controls. Route panel or modal. | Depends on files existing; independent from other work; can drop to `<iframe>` fallback in emergencies. |
| 7 | **Recursive folder delete + cascade cleanup** | `WITH RECURSIVE` query + `deleteObjectsBatch`. Confirmation dialog counts descendants. | Depends on files existing; not on critical UX flow so it's after upload+viewer. |
| 8 | **Move (drag-and-drop) + client-side name filter** | `@dnd-kit` drop targets on tree nodes. Optimistic move for folder + file. Filename filter input in header. | Nice-to-have but scored as "polish + edge case handling"; low risk. |
| 9 | **Polish pass + README + deploy** | Skeletons, empty states, error boundaries, toasts wired everywhere. Vercel deploy. Dokploy deploy. First-deploy DNS/CORS/env dance. README. | Deploy last so the last hour is polish, not env-var debugging on a live host. |

### Critical path pieces (blockers for everything else)

1. **Clerk JWT verify wired both ends** — nothing works without an authenticated request.
2. **Presigned PUT round-trips** — with MinIO CORS configured. Prove this in phase 4 with a curl-signed test URL from the backend + a manual browser PUT before writing the UI.
3. **`docker-compose.dev.yml` boots Postgres + MinIO** — a broken compose in phase 1 blocks all backend work.
4. **`packages/shared` Zod schemas resolve in both apps** — one misconfigured TSConfig path and every DTO import is `any`.
5. **Two S3Client separation in prod config** — `S3_ENDPOINT_INTERNAL` vs `S3_ENDPOINT_PUBLIC`. Introduce the pair from day 1 (both `localhost:9000` in dev), so you never write single-endpoint code.

### Safely deferred to the last hour

- Move (drag-and-drop) — the app is usable without it.
- Client-side filename filter — a text input over cached data; trivial.
- Dark mode toggle — the shadcn primitives already handle it.
- Empty-state illustrations, micro-animations.
- README polish + screenshots.

### Explicit **do not defer** items

- Confirmation dialog for folder delete (cascade is destructive).
- Toast on any failed mutation (silent failures kill "handles edge cases" scoring).
- Progress bar during upload (empty UI during a 30 MB PDF upload feels broken).
- Handling of 409 name conflict (TASK.md explicitly calls this out).
- Upload retry button after failure (partial network failures are the most-tested edge case).

---

## Upload Flow — Error Cases (walk-through)

### 1. User cancels mid-upload → file stuck in `pending`

**Client:** Zustand row shows "cancelled". User can click Retry → new `/init` call with a **fresh name** or `overwrite:true`.

**Server:** Orphan `pending` File row sits in DB with no MinIO object. No user impact (files list is filtered `WHERE status = 'ready'`).

**MVP cleanup:** none — the row is invisible. If we care later, a periodic sweep of `pending` rows older than 15 min is one cron job. For a 4-6h build, invisible orphans are acceptable.

### 2. Presigned URL expires before user finishes selecting a file

**Doesn't happen.** `/init` is called AFTER file selection (folder + name + size + mime are known). URL TTL is 5 min from that moment; upload starts within seconds. If a huge file + slow line takes >5 min, MinIO rejects with 403 → surface as "Upload expired, click Retry" → new `/init`.

### 3. MinIO rejects (size limit, wrong content-type)

**MinIO returns 4xx during PUT.** XHR wrapper detects non-2xx → mark row `failed` with error copy from server if available. Retry button visible.

**Belt-and-braces:** Fastify pre-validates `size ≤ 50 MB` and `mimeType === 'application/pdf'` in `/init` so the browser gets a fast typed error before the PUT is even attempted.

### 4. Browser tab closes mid-upload

**Client:** upload session dies (Zustand is in-memory only). DB row is `pending`, no MinIO object.

**On next visit:** the file is invisible (filter by `status='ready'`). User can re-upload. No stale data shown.

**Acceptable for MVP.** A resumable upload story (Zustand persist + multipart) is out of scope.

### 5. Complete endpoint fails after MinIO succeeded

**Bad case:** the bytes ARE in MinIO, but the DB row stays `pending` → user thinks upload failed.

**Handling:** frontend retries `/complete` up to 3× with exponential backoff (500ms, 1s, 2s) before marking failed. Because `/complete` is idempotent (`HeadObject` + `UPDATE ... SET status='ready'`), retries are safe.

**Belt-and-braces:** if all 3 retries fail, the failure toast reads "File uploaded but not confirmed — click Retry to finalize." Retry button calls `/complete` again, not `/init`.

### 6. Network drops between PUT-success and `/complete`

Same as #5 — resolved by retry on `/complete`.

### 7. Two tabs, same folder, same filename, race condition

Tab A calls `/init` — inserts pending row, returns 200. Tab B calls `/init` a millisecond later — hits UNIQUE `(folderId, name)` → 409 `FILE_NAME_TAKEN`. UI opens rename/overwrite dialog. This is the same code path as "user tries to upload a name that already exists."

### 8. MinIO CORS misconfigured

**Symptom:** browser blocks the PUT before it's sent. Console shows CORS error.

**Prevention:** MinIO CORS must permit `PUT`, `GET`, `HEAD` from frontend origins. Expose `ETag`. Applied via `mc admin` or console during first-deploy. **This is the single most-common presigned-upload footgun** — configure it during phase 4, verify with a curl-simulated OPTIONS request before writing UI code.

---

## Local Dev vs Production Parity

### The one thing that differs

| Concern | Dev | Prod |
|---------|-----|------|
| S3 endpoint (internal) | `http://localhost:9000` | `http://minio:9000` (Docker DNS) |
| S3 endpoint (public/presign) | `http://localhost:9000` | `https://minio.dataroom.holy-water.app` |
| Postgres | `localhost:5432` | `postgres:5432` (Docker DNS) |
| Frontend origin (CORS) | `http://localhost:5173` | `https://dataroom.holy-water.app` |

**All other behaviour is identical** — presigned-URL flow, ownership check, error codes, Drizzle schema. That's the value of the S3 API + Docker parity.

### Failure modes when copy-pasting env vars

1. **Backend presigns with the INTERNAL endpoint in prod** — browser gets a URL for `http://minio:9000` that it cannot resolve. Fix: two `S3Client` instances, one per endpoint, and `presignPut()` uses the public one only. Enforced by only exposing `publicS3` from `storage.service.ts`.

2. **MinIO CORS allows only localhost** — browser blocks the prod PUT. Fix: apply CORS on both environments; template the origin list from an env var.

3. **`VITE_API_URL` still points at localhost in the Vercel build** — frontend calls `http://localhost:3001` in production. Fix: validate `VITE_API_URL` at boot in `shared/config/env.ts` using Zod URL type; fail fast.

4. **Dokploy re-clones the workdir each deploy** — anything you edit inside `/etc/dokploy/compose/dataroom/code/` is wiped. Fix: all env goes through Dokploy UI; Postgres and MinIO data go into **named Docker volumes**, never bind mounts to the workdir.

5. **Clerk JWKS URL differs between dev instance and prod instance** — sign-in works locally, 401 in prod. Fix: `CLERK_SECRET_KEY` is per-environment and MUST match the frontend's `VITE_CLERK_PUBLISHABLE_KEY`. Configure both instances up-front so you're not swapping keys under time pressure.

6. **`forcePathStyle: true` missing** — presigned URLs use virtual-hosted-style (`{bucket}.minio...`), which MinIO rejects. Fix: pass `forcePathStyle: true` on both `S3Client` instances.

7. **Content-Type header mismatch between signed URL and PUT request** — the browser sends `application/pdf`; the URL was signed without a `Content-Type` constraint (or with a different one) → 403 SignatureDoesNotMatch. Fix: sign with `ContentType: 'application/pdf'` and set the same header on the XHR PUT. Verified against the AWS SDK v3 `s3-request-presigner` behaviour: signed headers must match request headers exactly.

### Parity acceptance test

Before the last hour: sign in on the deployed app, upload a 5 MB PDF, refresh, view it. If any step fails, it's an env-var problem, not code — check the seven items above in that order.

---

## Migration Workflow — Drizzle Kit

### Recommendation for this MVP

**`drizzle-kit push` throughout the 4-6h build. `generate` + `migrate` only if a second developer is invited or a prod schema change is needed after the first deploy.**

### Rationale

- Solo prototyping is exactly the case Drizzle documents `push` for — verified in official docs. Every schema change is one command: `pnpm drizzle-kit push`.
- Zero migration files in git during the sprint = zero rebase pain when features land back-to-back.
- Prod schema is created once during first Dokploy deploy: `pnpm drizzle-kit push` against the prod DATABASE_URL via an SSH tunnel, or run the migration container once.
- Estimated schema evolutions during MVP: initial three tables in phase 2 (`datarooms`, `folders`, `files`), possibly a `status` index in phase 4, possibly nothing else. Not enough churn to justify migration files.

### Transition to `migrate` if…

- The first deploy is stable AND you make a schema change afterwards → `pnpm drizzle-kit generate` produces `0001_...sql`, commit it, deploy runs `drizzle-kit migrate` on boot.
- Any collaborator joins.
- Data-preserving alterations become necessary (dropping a column with data).

### `push` caveats (documented)

- Destructive changes get an interactive confirm; automate around this by reviewing the diff, not by `--force`.
- `push` never runs custom SQL — but we have none; the recursive CTE lives in a query file, not in schema.

---

## Testing Scope — the 3-5 highest-value tests

Given 4-6h budget, treat tests as **guardrails on the highest-cost regressions**, not coverage. Skip UI tests entirely. Skip service-level tests except for the one below.

### 1. Ownership hook rejects cross-user access (Fastify integration test)

**Why:** if this breaks, one user can read/delete another user's data. Highest severity possible.

**How:** boot `buildServer()` against a test DB (Postgres in a Docker in CI, or Neon branch, or SQLite Drizzle for speed if schema compatible). Seed two users, two datarooms. Assert 403 on cross-user `DELETE /datarooms/:id`. ~50 lines.

### 2. UNIQUE(folderId, name) → 409 FILE_NAME_TAKEN (Fastify integration test)

**Why:** documented TASK.md edge case ("uploading files with the same name"). Reviewer will absolutely try it. Regression here loses "handles edge cases" points.

**How:** call `/files/init` twice with the same folder + name; assert first is 200, second is 409 with typed code. ~20 lines.

### 3. Recursive folder delete removes all descendants (Fastify integration test)

**Why:** the WITH RECURSIVE query is the most bug-prone piece of SQL in the build; a subtle join miss orphans data or nukes the wrong subtree.

**How:** seed folder tree A → B → C (with a file in C, another under A directly). `DELETE /folders/:A`. Assert no folders, no files remain; assert an unrelated dataroom's folders untouched. ~40 lines.

### 4. Upload three-step ceremony end-to-end (Fastify integration test, mocked MinIO)

**Why:** the highest-complexity flow; regressions here silently break the product's core value.

**How:** mock `internalS3.send(HeadObjectCommand)` to return success; call `/files/init` → assert `pending` row + returned URL; call `/files/:id/complete` → assert `ready` status. ~40 lines. Don't test against real MinIO — the point is the state machine, not S3 protocol.

### 5. (Optional if time) Optimistic rename rollback (frontend, React Query test)

**Why:** if a rename's optimistic update doesn't roll back on 409, the UI lies to the user.

**How:** mount `useRenameFolder` with a `QueryClient`, seed one folder in cache, mock the API to reject with 409, assert cache is back to the seeded state after `.mutateAsync()` rejection. ~30 lines with `@testing-library/react` + `msw`.

### What NOT to test

- No E2E (Playwright): setup cost vs a 4-6h budget is prohibitive.
- No unit tests for pure formatters or fetch client (return on effort is low).
- No integration test for Clerk JWT verify (mocked in the plugin during tests; testing Clerk itself is out of scope).
- No visual regression, no accessibility audit at test time.

---

## Scaling Considerations

| Scale | Adjustment |
|-------|------------|
| 0–100 users (reviewer + demo) | Current architecture is comfortable. Single VPS, single Postgres, single MinIO container. |
| 100–10k users | Move Postgres to managed (Neon, RDS). MinIO to a HA cluster or swap for R2/S3 — same S3Client code, different env vars. Cache `HeadObject` results briefly. |
| 10k+ users | CDN in front of presigned GETs. Background job queue for cascade delete + orphan cleanup. Consider streaming zip download for whole-folder export. |

**None of this is relevant for the take-home** — mentioned only to prove the architecture doesn't paint into a corner.

### First bottleneck

`GET /folders/:id/children` under a very wide folder (thousands of files). Fix: paginate with cursor `(name, id)` and index on `(folder_id, name)`. Not needed for MVP.

### Second bottleneck

Recursive cascade delete against a 10k-file subtree — the `deleteObjects` batch call runs against MinIO synchronously. Fix: enqueue to a job queue, respond immediately. Not needed for MVP.

---

## Anti-Patterns

### Anti-Pattern 1: Proxying uploads through Fastify

**What people do:** Accept multipart uploads at the API and stream them to MinIO.

**Why it's wrong:** turns the API into the bandwidth bottleneck; loses progress fidelity; requires request-timeout tuning; complicates horizontal scaling; wastes VPS network out.

**Do this instead:** presigned PUT direct to MinIO. The backend never sees bytes. Enforced by CLAUDE.md rule "byte streams never touch Fastify."

### Anti-Pattern 2: React Query inside a JSX-rendering component

**What people do:** call `useQuery` at the top of a component that also returns JSX.

**Why it's wrong:** couples data fetching to presentation; makes the component untestable without a QueryClient; blocks reuse of the same UI with different data sources; violates locked frontend rule #1.

**Do this instead:** every `useQuery`/`useMutation` lives in a `use-*` hook under `entities/model/` or `features/model/`. Components receive props.

### Anti-Pattern 3: Storing upload progress in React Query cache

**What people do:** treat the in-flight file as a query with progress states.

**Why it's wrong:** upload progress is client state (per-session, per-browser). Mixing it with cached server state defeats the "React Query = server state, Zustand = client state" rule and causes cache invalidations to blow away in-flight upload UI.

**Do this instead:** upload session lives in a Zustand `uploadsSlice`. Only after `/complete` returns success do we write the resulting `File` into the React Query cache.

### Anti-Pattern 4: Ownership check in the route handler (not a hook)

**What people do:** each route starts with `if (folder.ownerId !== userId) throw ...`.

**Why it's wrong:** relies on developer discipline. One forgotten check = a security bug.

**Do this instead:** ownership as a `preHandler` factory, attached to the route definition. Adding a new route to an existing resource inherits the check.

### Anti-Pattern 5: Assuming folder delete "just works" because of `ON DELETE CASCADE`

**What people do:** define `ON DELETE CASCADE` on the FK and think it's done.

**Why it's wrong:** cascade removes DB rows but leaves MinIO objects orphaned. The blob store is authoritative for bytes; ignoring it silently accumulates dead objects.

**Do this instead:** the delete flow selects descendant `s3_key`s **first** (recursive CTE), then deletes DB rows (cascade handles this), then best-effort deletes MinIO objects. Log failures; don't fail the HTTP response on MinIO issues.

### Anti-Pattern 6: One S3Client for both internal and public use

**What people do:** initialise a single `S3Client` at boot and use it everywhere.

**Why it's wrong:** presigning against the internal endpoint gives the browser a hostname it cannot resolve (`http://minio:9000`); presigning against the public endpoint from inside the Docker network sometimes fails DNS resolution or hits Traefik unnecessarily.

**Do this instead:** two clients from day 1, exposed via `storage.service.ts`. `internalS3` for `HeadObject`/`DeleteObject`; `publicS3` for `getSignedUrl`. Even in dev where both endpoints are `localhost:9000`, keep the pair — prevents accidentally coding against a single client that breaks in prod.

### Anti-Pattern 7: Storing filename in `s3Key`

**What people do:** `s3Key = 'user/dataroom/folder/pretty-name.pdf'`.

**Why it's wrong:** rename becomes a copy+delete (5s pause on rename UX); name conflicts become S3 conflicts too; filename characters cause encoding issues.

**Do this instead:** `s3Key = '{ownerId}/{dataroomId}/{fileId}.pdf'` — deterministic, opaque, unaffected by renames. The user-visible name lives in the DB.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Clerk | Frontend: `<ClerkProvider>`, hooks return current user + `getToken()`. Backend: `@clerk/backend` verifies bearer JWT in a Fastify plugin, sets `req.userId`. | Magic-link demo mode = reviewer signs in without a shared password. Different `CLERK_SECRET_KEY` per env. |
| MinIO (S3 API) | Two `S3Client` instances (internal + public) in `storage.service.ts`. CORS must permit `PUT/GET/HEAD` from frontend origins and expose `ETag`. `forcePathStyle: true` mandatory. | Configured once per environment via `mc admin` or the console. |
| Vercel | Static Vite build; env prefix `VITE_*`. SPA fallback handled by Vercel automatically. | No server-side runtime. |
| Dokploy | Deploys `docker-compose.prod.yml`. Wipes workdir per deploy — state lives in named volumes only. Env via UI, never in-repo. | LE certs via Traefik; Cloudflare proxy stays off until certs stabilise. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `apps/web` ↔ `apps/api` | HTTPS + JSON; Zod schemas from `packages/shared` on both sides. | `ApiError` class in `shared/api` parses typed error codes. |
| `apps/web` ↔ MinIO | Direct browser PUT/GET on presigned URLs. Never goes through the API. | The presigned URL host is the only thing the browser needs from MinIO. |
| Fastify routes ↔ services | Function call. Routes translate HTTP; services never import Fastify types. | Enables unit-testing services without an HTTP layer. |
| Services ↔ DB | Drizzle query functions in `db/queries/*`. Services import queries; queries import schema. | No inline queries in services beyond trivial ones. |
| Services ↔ MinIO | `storage.service.ts` only. Routes and other services never touch `S3Client` directly. | Guards the two-client separation. |
| Both apps ↔ `packages/shared` | Compile-time import. TSConfig path aliases + Turborepo cache. | Version bump = both apps must rebuild. |

---

## Sources

- [Generate a presigned URL in modular AWS SDK for JavaScript — AWS Developer Tools Blog](https://aws.amazon.com/blogs/developer/generate-presigned-url-modular-aws-sdk-javascript/)
- [`@aws-sdk/s3-request-presigner` npm](https://www.npmjs.com/package/@aws-sdk/s3-request-presigner)
- [S3 Pre-Signed URL SignedHeaders/CORS deep-dive (Saket Agrawal)](https://medium.com/@saketneel15/the-s3-pre-signed-url-bug-that-took-down-our-uploads-a-deep-dive-into-signedheaders-cors-and-aws-789492e191a3)
- [Deep dive into CORS configs on Amazon S3 — AWS M&E blog](https://aws.amazon.com/blogs/media/deep-dive-into-cors-configs-on-aws-s3-how-to/)
- [Drizzle Team: CTE query of hierarchical data (WITH RECURSIVE guidance)](https://www.answeroverflow.com/m/1098017835118231622)
- [Drizzle Kit push — official docs](https://orm.drizzle.team/docs/drizzle-kit-push)
- [Drizzle push vs migrate: practical guide](https://www.oreateai.com/blog/drizzle-push-vs-migrate-navigating-database-management-with-drizzle-kit/c954c74d99e275ff4d3dceb64c18deed)
- [Drizzle ORM Migrations: A Practical drizzle-kit Guide](https://devencyclopedia.com/blog/drizzle-orm-migrations-drizzle-kit)
- [Fastify + Drizzle plugin](https://github.com/trey-m/fastify-drizzle)
- Locked project context: `.planning/PROJECT.md`, `CLAUDE.md`, `TASK.md`

---
*Architecture research for: Virtual Data Room MVP (Vite SPA + Fastify + Postgres + MinIO)*
*Researched: 2026-07-03*
