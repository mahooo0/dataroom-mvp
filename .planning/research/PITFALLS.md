# Pitfalls Research — Dataroom MVP

**Domain:** Virtual Data Room (Vite React SPA + TanStack Router + React Query + Clerk + FSD + Fastify + Drizzle + Postgres + MinIO + Dokploy monorepo)
**Researched:** 2026-07-03
**Confidence:** HIGH (most items verified against official docs and GitHub issues; a handful of "reviewer taste" items are MEDIUM confidence)

Phases referenced throughout:
- **P0 bootstrap** — monorepo, Vite, TanStack Router shell, Clerk provider, `packages/shared`, biome
- **P1 backend** — Fastify + Drizzle + schema + Clerk verify + docker-compose.dev
- **P2 frontend shell** — FSD scaffolding, auth guard, layout, entity hooks, query client
- **P3 upload** — MinIO presign, CORS, XHR progress, pending row UX
- **P4 tree + CRUD** — folder tree, DnD, rename/delete/move optimistic mutations
- **P5 viewer** — react-pdf, worker config, custom controls
- **P6 deploy** — Vercel (web), Dokploy compose (api + postgres + minio), Cloudflare + LE
- **P7 polish** — skeletons, empty states, error boundaries, keyboard nav, sample data, README

---

## Critical Pitfalls

### Pitfall 1: MinIO presigned PUT returns 403 SignatureDoesNotMatch because the browser omits `Content-Type` (or sends a different one than what was signed)

**Symptom:**
Browser Network tab shows `PUT https://minio.../…` → `403 Forbidden`, response body includes `<Code>SignatureDoesNotMatch</Code>`. Everything looks right — URL is fresh, bucket exists, CORS preflight passed — but the PUT itself fails.

**Why it happens:**
`@aws-sdk/s3-request-presigner` (and MinIO) signs the request using SigV4, which includes any headers you passed to `PutObjectCommand` in the signed policy. If you pass `ContentType: 'application/pdf'` when creating the command, `Content-Type` is baked into the signature. If the browser then sends a different `Content-Type` (or none — `fetch` may not set one for a `Blob` without an explicit MIME) the recomputed signature on MinIO's side doesn't match. This is documented AWS behavior, mirrored exactly by MinIO.

**Detection:**
- 403 with `SignatureDoesNotMatch` (not `AccessDenied`)
- Response XML shows `<StringToSign>` — the last section lists the signed headers; `content-type` will be there
- Curl the same URL with matching `-H "Content-Type: application/pdf"` → succeeds

**Prevention:**
1. Sign WITHOUT `ContentType` if the browser doesn't guarantee sending it — then omit `Content-Type` from PUT too. Simplest for MVP.
2. OR sign WITH `ContentType: 'application/pdf'` AND explicitly set `Content-Type: application/pdf` on the browser PUT (`xhr.setRequestHeader` / `fetch` `headers`).
3. Pick one strategy and pin it. Do not mix.
4. Same rule applies to `ContentLength`, `x-amz-meta-*` — anything signed must be sent.

**Phase:** P3 upload (backend presign + frontend PUT must be built as one pair)

---

### Pitfall 2: MinIO presigned URL contains the internal Docker hostname (`http://minio:9000`) which the browser cannot resolve

**Symptom:**
Presigned URL looks like `http://minio:9000/dataroom-files/…` in the JSON response from `/files/init`. Browser `fetch(uploadUrl)` fails with `net::ERR_NAME_NOT_RESOLVED` or CORS preflight fails because there is no such host from the browser's network.

**Why it happens:**
The Fastify container talks to MinIO via the Docker network, so `S3_ENDPOINT=http://minio:9000` is the correct value for internal ops like `HeadObject` and `DeleteObject`. But the SigV4 signature includes the host header, so the presigned URL bakes in whatever hostname the S3 client was configured with. If you have one `S3Client` and it's pointed at `minio:9000`, every presigned URL leaks the internal hostname.

**Detection:**
- `console.log(uploadUrl)` in the browser shows `minio:9000` or `http://api:...`
- Works locally when everything is on `localhost:9000` — breaks the moment Docker Compose introduces internal DNS

**Prevention:**
1. Two `S3Client` instances (already in `PROJECT.md`):
   - `s3Internal` → `S3_ENDPOINT_INTERNAL=http://minio:9000` for `HeadObject`/`DeleteObject`
   - `s3Public` → `S3_ENDPOINT_PUBLIC=https://minio.dataroom.holy-water.app` for `getSignedUrl`
2. Enforce in code review: `getSignedUrl(s3Public, …)` — never `getSignedUrl(s3Internal, …)`. Consider naming them `s3ForPresign` and `s3ForServerOps` so mistakes read wrong at a glance.
3. In dev, both env vars point to `http://localhost:9000` so the same code paths work without special casing.
4. `forcePathStyle: true` on both clients — MinIO defaults to path-style; virtual-host style needs wildcard DNS you don't have.

**Phase:** P1 backend (S3 client wiring) — verified end-to-end in P3 upload

---

### Pitfall 3: MinIO CORS is not configured, or is configured on the bucket instead of the server, so the browser blocks the PUT preflight

**Symptom:**
Browser console: `Access to fetch at 'https://minio.../…' from origin 'https://dataroom.holy-water.app' has been blocked by CORS policy: Response to preflight request doesn't pass access control check`. The PUT never fires. `curl` works fine.

**Why it happens:**
MinIO does not read AWS-style `cors.xml` on the bucket. CORS must be configured on the MinIO server itself via `MINIO_API_CORS_ALLOW_ORIGIN` (comma-separated) OR via `mc admin` on newer builds. People coming from AWS S3 assume bucket-level CORS works — it does not. Additionally, some MinIO builds have shipped with CORS regressions where the `Access-Control-Allow-Origin` header is missing on `OPTIONS`.

**Detection:**
- `curl -X OPTIONS -H "Origin: https://dataroom.holy-water.app" -H "Access-Control-Request-Method: PUT" https://minio.dataroom.holy-water.app/...` → response must include `Access-Control-Allow-Origin` and `Access-Control-Allow-Methods: PUT`
- Browser Network tab shows OPTIONS request with red status
- No CORS error on `curl` of the PUT itself, but the browser refuses

**Prevention:**
1. Set `MINIO_API_CORS_ALLOW_ORIGIN` on the MinIO container in `docker-compose.prod.yml`:
   `MINIO_API_CORS_ALLOW_ORIGIN=http://localhost:5173,https://dataroom.holy-water.app,https://*.vercel.app`
2. Test the preflight with curl BEFORE trying from the browser.
3. Also configure it in `docker-compose.dev.yml` so dev matches prod behavior.
4. Pin MinIO image to a specific known-good tag (e.g., `minio/minio:RELEASE.2024-…`). Do not use `latest` — a bad release can silently regress CORS.
5. Set `MINIO_API_CORS_ALLOW_HEADERS=*` and expose `ETag` for good measure.

**Phase:** P6 deploy (CORS in compose file) — dev variant in P1 backend so upload can be built locally

---

### Pitfall 4: Presigned URL expiry too short so users can't finish uploading a 50 MB PDF on a slow connection

**Symptom:**
On a slow connection or a large PDF, PUT fails partway through with `403 AccessDenied` or `RequestTimeTooSkewed`. The presigned URL that was minted 4 minutes ago has already expired by the time bytes finish uploading.

**Why it happens:**
Devs often copy `expiresIn: 300` (5 min) from an S3 tutorial without thinking about upload duration for the max file size. 50 MB on a 1 Mbps upstream is ~7 minutes. Also, users may open the upload dialog, pick a file, get distracted for 3 minutes, then hit Upload — clock is ticking from the moment `/files/init` was called, not from PUT start.

**Detection:**
- Sporadic upload failures on files >20 MB
- Works fine on office wifi, fails on tethered mobile
- Response `<Code>AccessDenied</Code>` with `<Message>Request has expired</Message>`

**Prevention:**
1. `expiresIn: 900` (15 min) at minimum for a 50 MB cap. Tradeoff: longer window = larger blast radius if a URL leaks, but for a single-user demo behind Clerk this is fine.
2. Mint the URL when the user hits Upload, not when they open the dialog.
3. On PUT failure with 403, call `/files/init` again to remint and retry once transparently before showing the Retry button to the user.

**Phase:** P3 upload (init endpoint + retry-on-403 in mutation)

---

### Pitfall 5: TanStack Router `loader` + `queryClient.ensureQueryData` treated like a React Router `loader`, causing stale data or query waterfalls

**Symptom:**
- After a rename mutation, the header still shows the old name until you navigate away and back.
- Route navigation feels slow because two `await`ed queries fire sequentially instead of in parallel.
- Error: `context.queryClient.ensureQueryData is not a function` on client-side navigation.
- Data shown in component is different from what the loader returned.

**Why it happens:**
- `ensureQueryData` only fetches if the query is not in cache. It does NOT re-validate on navigation. Devs coming from React Router assume `loader` runs fresh each visit.
- `router.invalidate()` alone does not refetch queries that use `useSuspenseQuery` — you need to invalidate the QueryClient's cache.
- Sequential `await queryClient.ensureQueryData(a); await queryClient.ensureQueryData(b);` creates a waterfall.
- `context.queryClient` is undefined if `RouterProvider` isn't passed `context={{ queryClient }}` or if the route tree wasn't given the context type.

**Detection:**
- `useSuspenseQuery` inside the component returns different data than the loader's return value → stale cache
- Router devtools shows loader duration = sum of query durations (not max)
- TypeScript error on `context.queryClient` in loader

**Prevention:**
1. Wire QueryClient into router context ONCE:
   ```ts
   const router = createRouter({ routeTree, context: { queryClient } });
   // and in rootRoute:
   createRootRouteWithContext<{ queryClient: QueryClient }>()
   ```
2. In loaders, parallelize: `await Promise.all([ctx.context.queryClient.ensureQueryData(a), ctx.context.queryClient.ensureQueryData(b)])`
3. In components, use `useSuspenseQuery` with the SAME query options object (extract to a factory) so the loader's fetch and the component's read share cache identity.
4. After a mutation, call `queryClient.invalidateQueries({ queryKey: … })` — do NOT rely on `router.invalidate()` to refetch data.
5. Set `defaultPreload: 'intent'` on the router to prefetch on hover for free.

**Phase:** P2 frontend shell (router + query client wiring is foundational)

---

### Pitfall 6: React Query cache key is a fresh object literal on every render → infinite refetch loop or new query instance per render

**Symptom:**
- Network tab shows the same request firing over and over.
- `useQuery` returns loading state every render.
- React DevTools shows the component re-rendering constantly.
- Optimistic updates appear to work then instantly revert.

**Why it happens:**
Query keys use structural sharing, but if you inline a filter object like `useQuery({ queryKey: ['files', { folderId }] })` where `folderId` comes from a prop, the object is stable. But if any part of the key is a `new Date()`, `Math.random()`, or an object built from spread of unstable state, the key is different every render, so React Query treats it as a new query.

**Detection:**
- React Query devtools shows N identical queries in the cache with tiny differences
- `refetchInterval` behavior even though you didn't set one
- CPU pegged, browser stutters

**Prevention:**
1. Adopt query key factory pattern (already in `PROJECT.md`):
   ```ts
   export const folderKeys = {
     all: ['folders'] as const,
     children: (parentId: string | null) => [...folderKeys.all, 'children', parentId ?? 'root'] as const,
   };
   ```
   Only primitives in keys. Never `new Date()`, never a computed object.
2. If key needs an object (filters), memoize it or serialize to a stable string.
3. In `select`, extract the fn or wrap in `useCallback` — inline `select` runs every render.
4. Include React Query devtools in dev build — the cache view surfaces this instantly.

**Phase:** P2 frontend shell (query key convention set once, enforced in code review)

---

### Pitfall 7: Optimistic mutation `onMutate` doesn't cancel in-flight queries, causing UI to snap back mid-mutation

**Symptom:**
- User renames folder → new name shows for ~200ms → old name reappears → new name reappears after mutation settles.
- Two rapid rename mutations on the same folder end up with a mixed-up final name.
- Delete an item, it reappears, then disappears.

**Why it happens:**
Standard optimistic update pattern is `onMutate` → snapshot + set cache → `mutationFn` → `onError` rollback → `onSettled` invalidate. If a background refetch is already in flight when `onMutate` runs, that refetch resolves with the OLD server data and overwrites the optimistic update. You must `await queryClient.cancelQueries({ queryKey })` first.

**Detection:**
- Visible flicker after mutation
- Deterministic on slow network throttling (Chrome devtools "Slow 3G")
- Order of `console.log` shows `refetch resolved` firing AFTER `onMutate` set the cache but BEFORE `mutationFn` completes

**Prevention:**
Enforce this exact template for every optimistic mutation:
```ts
onMutate: async (variables) => {
  await queryClient.cancelQueries({ queryKey: folderKeys.children(parentId) });
  const previous = queryClient.getQueryData(folderKeys.children(parentId));
  queryClient.setQueryData(folderKeys.children(parentId), (old) => /* patched */);
  return { previous };
},
onError: (_err, _vars, ctx) => {
  if (ctx?.previous) queryClient.setQueryData(folderKeys.children(parentId), ctx.previous);
},
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: folderKeys.children(parentId) });
}
```
Also: for renames, consider disabling the rename input while a mutation is in flight to prevent the double-mutation race.

**Phase:** P4 tree + CRUD (all four optimistic mutations follow this template)

---

### Pitfall 8: Fastify `fastify-type-provider-zod` set up as a validator but not a serializer, so response schemas are ignored

**Symptom:**
- Response includes fields you didn't intend to expose (`ownerId`, `createdAt` on every File row).
- Backend returns `Date` objects that serialize as ISO strings but the shared TS type says `Date`.
- Zod response schemas are defined but never actually enforce anything.
- Route handler returns `{ …, extraField: 'oops' }` and it silently passes through.

**Why it happens:**
`fastify-type-provider-zod` requires BOTH `setValidatorCompiler` AND `setSerializerCompiler`. Many tutorials only show the validator. Additionally, Fastify has two levels: JSON Schema for serialization at the transport layer and Zod at your handler layer — response schemas only enforce if the serializer is set. Zod `transform()` in a response schema loses type info in the OpenAPI spec (documented bug).

**Detection:**
- Response payload has fields not in the shared response schema
- `pino` logs show slow serialization on large responses (JSON.stringify vs fast-json-stringify)
- OpenAPI spec (if using @fastify/swagger) shows empty objects where transforms live

**Prevention:**
1. In `apps/api/src/server.ts`:
   ```ts
   app.setValidatorCompiler(validatorCompiler);
   app.setSerializerCompiler(serializerCompiler);
   app.withTypeProvider<ZodTypeProvider>();
   ```
2. Every route defines BOTH `body`/`params`/`querystring` AND `response: { 200: FileSchema }` from `packages/shared`.
3. Avoid `.transform()` in response schemas — use in-handler mapping to the shared DTO shape.
4. Custom error handler that maps `hasZodFastifySchemaValidationErrors(err)` → 400 with structured `{ code: 'VALIDATION_ERROR', issues: [...] }` matching the shared error taxonomy. Default error output is a raw dump — unhelpful for the frontend.

**Phase:** P1 backend (server bootstrap file)

---

### Pitfall 9: Drizzle `references(..., { onDelete: 'cascade' })` forgotten → DB errors on folder delete, or worse, orphaned rows

**Symptom:**
- `DELETE /folders/:id` returns 500 with `foreign key constraint "files_folder_id_fkey" violated`.
- OR: Delete succeeds at API level but child folders/files are still in the DB (if you did app-level delete without FK cascade).
- MinIO objects orphaned because their DB rows are gone before cleanup.

**Why it happens:**
Drizzle's `references(() => folders.id)` alone does NOT set `ON DELETE CASCADE`. You must explicitly pass `{ onDelete: 'cascade' }` as the second argument. Devs assume the "relations" API in Drizzle sets FK constraints — it does not. Relations are application-level, foreign keys are database-level.

**Detection:**
- FK violation errors on cascade delete
- After delete, `SELECT * FROM files WHERE folder_id NOT IN (SELECT id FROM folders)` returns rows (should be zero)
- Manual `psql` inspection of `\d+ folders` shows no `ON DELETE CASCADE`

**Prevention:**
1. Every FK gets `{ onDelete: 'cascade' }` for parent-child (folder→file, dataroom→folder), or `{ onDelete: 'restrict' }` for guards:
   ```ts
   folderId: text('folder_id').notNull().references(() => folders.id, { onDelete: 'cascade' }),
   parentId: text('parent_id').references(() => folders.id, { onDelete: 'cascade' }),
   ```
2. Self-referencing FK on `folders.parentId` needs it too — otherwise deleting a parent folder fails when it has children.
3. Verify with `pnpm --filter api db:generate` → inspect the generated SQL migration for `ON DELETE CASCADE`.
4. Separately: schedule MinIO object cleanup as an async job after DB delete (or use a soft-delete + cleanup worker). For MVP take-home, best-effort delete in the same transaction is acceptable — flag orphans as known limitation in README.

**Phase:** P1 backend (schema definition)

---

### Pitfall 10: Drizzle N+1 on folder tree because `db.query.folders.findMany({ with: { children: true } })` doesn't recurse

**Symptom:**
- Fetching the folder tree fires one query per folder level.
- Frontend shows nested loading skeletons as each level resolves.
- API response for the tree takes 500ms even with 30 folders.

**Why it happens:**
Drizzle's `with` relation loader is single-level. For a recursive tree you need either (a) a Postgres recursive CTE, (b) a flat list + client-side tree construction, or (c) accept the N+1 for small trees.

**Detection:**
- Enable Drizzle query logging (`logger: true`), count queries per tree fetch
- pg_stat_statements shows many identical `SELECT * FROM folders WHERE parent_id = $1`
- Tree render blocks visibly on each level

**Prevention:**
For MVP: **fetch flat list, build tree on client**. This is the simplest and correct approach for datasets under ~1000 folders:
```sql
SELECT id, parent_id, name, updated_at FROM folders WHERE dataroom_id = $1
```
Frontend transforms flat list into nested structure once, memoized by dataroom id. Same for files. Single round trip, no N+1, no recursive CTE complexity.

If tree gets huge (>1000 nodes), swap to recursive CTE later. Do NOT prematurely optimize.

**Phase:** P4 tree + CRUD (folder listing endpoint design)

---

### Pitfall 11: `packages/shared` imported as source in dev works, but Vercel build fails because the package has no `dist/`

**Symptom:**
- `pnpm dev` works locally — `apps/web` imports `@dataroom/shared/schemas` no problem.
- Vercel build fails: `Cannot find module '@dataroom/shared'` or types missing.
- Or worse: build succeeds but runtime error `Cannot use import statement outside a module` because the raw `.ts` file was published.

**Why it happens:**
`packages/shared/package.json` needs to be honest about what it exports. Two viable strategies:
1. **Source-only** (no build step): `"main": "./src/index.ts"`, `"types": "./src/index.ts"` + consumer bundles it (Vite does). Fastest for dev.
2. **Built package**: `"main": "./dist/index.js"`, `"types": "./dist/index.d.ts"` + a `build` script. More correct but adds a build step to the pipeline.

Vercel runs `pnpm install` in `apps/web` root by default. If it can't resolve the workspace package because `pnpm-workspace.yaml` isn't at the discovered root, or if `packages/shared` needs a build that hasn't run — deploy fails.

**Detection:**
- `pnpm build --filter web` from repo root FAILS the same way Vercel does — reproduce locally
- Vercel build log shows `Cannot find module` for the shared package
- `pnpm why @dataroom/shared` in apps/web shows the wrong resolution

**Prevention:**
1. Use **source-only** shared package for this MVP (Vite bundles TS from a workspace dep fine):
   - `package.json`: `"exports": { ".": "./src/index.ts", "./schemas": "./src/schemas/index.ts" }`
   - `"types"` also pointing at src
   - Skip a build step entirely
2. Vercel config:
   - Root Directory: `apps/web`
   - Install Command: `cd ../.. && pnpm install --frozen-lockfile`
   - Build Command: `cd ../.. && pnpm --filter web build`
   - Output Directory: `dist` (relative to `apps/web`)
   - OR use Turborepo's Vercel integration which handles this automatically
3. Also install `@dataroom/shared` in `apps/web/package.json` as `"@dataroom/shared": "workspace:*"` — pnpm needs this reference to link.
4. Verify locally: `rm -rf node_modules && pnpm install && pnpm --filter web build` — mimics CI.

**Phase:** P0 bootstrap (monorepo config) — verified once at first Vercel deploy in P6

---

### Pitfall 12: `VITE_` prefix forgotten (or `NEXT_PUBLIC_` used by muscle memory), env var undefined in prod bundle

**Symptom:**
- `import.meta.env.CLERK_PUBLISHABLE_KEY` is `undefined` in prod even though Vercel dashboard shows it set.
- Clerk fails to initialize with a cryptic error.
- Works in dev, breaks in prod.

**Why it happens:**
Vite only exposes env vars prefixed with `VITE_` to the client bundle. `NEXT_PUBLIC_` does nothing in Vite. Also, `import.meta.env.X` is a compile-time static replacement — you cannot use `import.meta.env[dynamicKey]`.

**Detection:**
- `Object.keys(import.meta.env).filter(k => k.startsWith('VITE_'))` in the browser console shows what's actually exposed
- Vercel deploy logs show env vars set but bundle doesn't have them

**Prevention:**
1. Convention: every client-side env var is `VITE_*`. Enforce in code review.
2. Zod-validate env at boot in `apps/web/src/shared/config/env.ts`:
   ```ts
   const envSchema = z.object({
     VITE_CLERK_PUBLISHABLE_KEY: z.string().min(1),
     VITE_API_URL: z.string().url(),
   });
   export const env = envSchema.parse(import.meta.env);
   ```
   This throws on boot if anything is missing — better than a mystery undefined at runtime.
3. Static access only: `import.meta.env.VITE_CLERK_PUBLISHABLE_KEY` — never `import.meta.env[key]`.
4. Backend has its own env schema (unprefixed), validated with Zod at Fastify boot.

**Phase:** P0 bootstrap (env module in shared/config) — reused across all phases

---

### Pitfall 13: `react-pdf` worker not configured for Vite → "Setting fake worker failed" or 504 in prod

**Symptom:**
- Dev: works fine.
- Prod: PDF viewer shows loading spinner forever. Console: `Setting fake worker failed: "TypeError: Failed to construct 'Worker'"` or 504 on the worker script.
- Or: `Could not read from file: /…/node_modules/pdfjs-dist/build/pdf.worker.js?url`

**Why it happens:**
`react-pdf`'s Vite entry point had a broken worker resolution in some versions. The recommended pattern is to configure `pdfjs.GlobalWorkerOptions.workerSrc` explicitly using `new URL()` with `import.meta.url`, which Vite handles as a static asset. But if you use `React.lazy` to lazy-load the PDF component, the worker URL resolution may fail in build mode only.

**Detection:**
- Only breaks in `vite build` + `vite preview`, never in `vite dev`
- Browser Network tab shows 404 or 504 on `pdf.worker.*.mjs`
- Console warning about fake worker

**Prevention:**
1. Configure worker at module top level in the file that renders the PDF viewer:
   ```ts
   import { pdfjs } from 'react-pdf';
   import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
   pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
   ```
   The `?url` suffix is a Vite-specific import that gives you a hashed URL to the asset.
2. Do NOT wrap the PDF viewer file in `React.lazy` initially. If lazy-loading needed later, do it at the widget level, not the file where workerSrc is set.
3. Test the built app locally with `pnpm --filter web build && pnpm --filter web preview` BEFORE deploying to Vercel.
4. Pin `pdfjs-dist` and `react-pdf` versions — worker path has moved between minor versions.

**Phase:** P5 viewer (setup in the widget file, verified in preview mode)

---

### Pitfall 14: `react-pdf` memory leak from not destroying the `PDFDocumentProxy` on unmount / doc switch

**Symptom:**
- After viewing 3-4 PDFs in a session, browser tab uses 800MB+ of memory.
- Switching between docs feels progressively slower.
- Browser eventually crashes with "Aw, snap!" (out of memory).

**Why it happens:**
`react-pdf` internally holds a `loadingTask` and `PDFDocumentProxy`. If the component unmounts or the `file` prop changes without calling `.destroy()` on both, workers keep pages, canvases, and cmaps in memory. Documented issue in `wojtekmaj/react-pdf`.

**Detection:**
- Chrome DevTools → Memory → Heap snapshots before and after opening 5 PDFs, diff shows growing arrays owned by pdfjs
- Performance monitor shows tab RAM climbing without ever dropping
- Only surfaces after viewing many docs — will not appear in a 2-minute dev test

**Prevention:**
1. Use the `Document` component's built-in cleanup — pass a stable `file` prop and rely on internal unmount handling.
2. Explicitly cleanup on doc change:
   ```tsx
   const [docProxy, setDocProxy] = useState<PDFDocumentProxy | null>(null);
   useEffect(() => () => { docProxy?.destroy(); }, [docProxy]);
   <Document file={url} onLoadSuccess={setDocProxy} />
   ```
3. Do not render more `<Page>` components than are visible — for multi-page docs, virtualize or render page-by-page based on the current page number.
4. Test by opening 5+ PDFs during QA and watching the memory tab.

**Phase:** P5 viewer + P7 polish (cleanup verification)

---

### Pitfall 15: Recursive folder tree crashes browser due to corrupt parent chain (a folder's parent chain loops back to itself)

**Symptom:**
- Frontend renders indefinitely — page hangs, then browser prompts to kill the tab.
- Or: Recursive delete on backend never terminates.
- Or: DB has a folder whose `parentId` transitively points back to itself (should be impossible with proper checks).

**Why it happens:**
Moving a folder into its own descendant is the classic footgun. If backend doesn't validate the move, the DB happily creates a cycle. Frontend tree-building code with no cycle detection then infinitely recurses. Even without a cycle, `parentId` pointing to a non-existent folder can also break tree assembly.

**Detection:**
- Move a folder into one of its own descendants → tree fails to render
- Backend query on the folder tree hangs (recursive CTE without depth limit)
- Browser Task Manager shows tab CPU at 100%, memory climbing fast

**Prevention:**
1. Backend `PATCH /folders/:id/move` validates: the target `parentId` MUST NOT be a descendant of `:id`. Simple check using the flat folder list (which you already have):
   ```ts
   function isDescendant(candidateParentId, folderId, allFolders) {
     let current = candidateParentId;
     const seen = new Set();
     while (current) {
       if (current === folderId) return true;
       if (seen.has(current)) return true; // corrupted chain
       seen.add(current);
       current = allFolders.find(f => f.id === current)?.parentId ?? null;
     }
     return false;
   }
   ```
2. DnD `canDrop` on the frontend runs the same check for immediate visual feedback (red drop zone).
3. Tree-building code has a hard depth cap (e.g., 50 levels) with a warning log if exceeded — corrupt data doesn't crash the UI.
4. DB-level safety: a CHECK constraint or trigger is overkill for MVP. Trust the app-level guard.

**Phase:** P4 tree + CRUD (move mutation validation + tree render safety)

---

### Pitfall 16: File upload UX — cancel button only closes the modal but the DB row (`status='pending'`) and partial S3 object are leaked

**Symptom:**
- User cancels upload mid-flight.
- Later, they upload a new file with the same name in the same folder → 409 conflict because the pending row is still there.
- MinIO fills up with orphaned partial objects.
- `/files/pending` (if you had it) would show ghosts.

**Why it happens:**
Devs implement cancel as `setUploadingFile(null)` which removes the UI row. The XHR is not aborted, the pending DB row is not deleted, the partial S3 object is not cleaned.

**Detection:**
- After cancel, `SELECT COUNT(*) FROM files WHERE status = 'pending' AND created_at < NOW() - INTERVAL '1 hour'` returns rows
- Duplicate file rename prompt triggers on filenames that don't visibly exist
- MinIO bucket `mc du` grows without matching DB rows

**Prevention:**
1. Cancel button flow:
   - Abort the `XMLHttpRequest`
   - `DELETE /files/:fileId` (which deletes DB row + attempts S3 DeleteObject)
   - Remove from UI
2. Backend: on `DELETE`, if `status='pending'`, silently succeed if S3 DeleteObject 404s (the object may not exist yet).
3. Same cleanup on window unload — best-effort `navigator.sendBeacon` to DELETE endpoint.
4. Backup: nightly cron job that deletes rows where `status='pending' AND created_at < NOW() - INTERVAL '24 hours'` plus their S3 objects. For MVP, document this as known limitation without implementing the cron.
5. UNIQUE constraint on `(folderId, name)` should exclude pending rows OR pending rows should use a temp name like `.pending-{uuid}` until complete. Simplest: exclude via partial unique index `WHERE status = 'ready'`.

**Phase:** P3 upload (cancel flow) — partial index migration in P1 backend

---

### Pitfall 17: Same-file uploaded twice concurrently races on UNIQUE `(folderId, name)`, one succeeds and one 500s ugly

**Symptom:**
- User drops two files with the same name into the same folder simultaneously (drag both from Finder).
- One upload succeeds; the other returns `500 Internal Server Error` with `duplicate key value violates unique constraint`.
- No user-friendly rename prompt.

**Why it happens:**
Both `/files/init` calls arrive at the backend nearly simultaneously. Both see no existing file with that name, both try to INSERT, one loses the race. The default behavior is a Postgres error propagated as 500.

**Detection:**
- Sentry / logs show `error: duplicate key value violates unique constraint "files_folder_id_name_key"`
- Reproduce: drag two identical filenames into the same folder in quick succession

**Prevention:**
1. Backend catches the specific PG error code `23505` (unique_violation) and returns 409 with `{ code: 'FILE_NAME_TAKEN' }`.
2. Frontend on 409 → same rename/overwrite dialog as the "file already exists" case. Single flow for both.
3. Backend on the client side — briefly disable "upload" for a filename that's already in the pending list (`status='pending'` in the current folder cache).

**Phase:** P3 upload (409 error handling on init endpoint)

---

### Pitfall 18: Clerk `getToken()` result cached in a variable → sending expired JWT after 60 seconds

**Symptom:**
- App works fine after login.
- Come back after leaving the tab for 5 minutes, next API call returns `401 Unauthorized`.
- Token in browser storage is fine, but the value being sent is stale.

**Why it happens:**
Clerk session tokens live for 60 seconds by default. `useAuth().getToken()` returns a fresh (or refreshed) token each call. If you cache the token in a variable or Zustand store, you'll send an expired one. If you make a shared `fetch` wrapper that closes over the token at construction time, same problem.

**Detection:**
- 401 after ~60 seconds of inactivity
- 401 on the first API call after refocusing the tab

**Prevention:**
1. Call `getToken()` fresh on every API request. Set up a fetch wrapper inside a hook that has closure access to Clerk:
   ```ts
   export function useApi() {
     const { getToken } = useAuth();
     return useCallback(async (path, init) => {
       const token = await getToken();
       return fetch(`${env.VITE_API_URL}${path}`, {
         ...init,
         headers: { ...init?.headers, Authorization: `Bearer ${token}` },
       });
     }, [getToken]);
   }
   ```
2. Never store the token in Zustand or React state.
3. React Query's `queryFn` receives context; get the fresh token there via the wrapper hook.
4. On 401 response, invoke Clerk's session refresh and retry once before showing "please sign in again."

**Phase:** P2 frontend shell (API client hook — foundational)

---

### Pitfall 19: `@clerk/backend` JWT verify expects `Authorization: Bearer <token>` exactly; case-sensitive typo or missing scheme breaks auth

**Symptom:**
- Every protected endpoint returns 401.
- Token looks right when logged.
- `authenticateRequest()` throws or returns `{ isAuthenticated: false }`.

**Why it happens:**
`@clerk/backend`'s `authenticateRequest` inspects headers. If you send `authorization: bearer <token>` (lowercase scheme), `Bearer<token>` (no space), or `Token <token>`, it silently returns unauthenticated. Also, the Fastify plugin (`@clerk/fastify`) needs `CLERK_PUBLISHABLE_KEY` AND `CLERK_SECRET_KEY` in env — either missing = 401.

**Detection:**
- Curl the endpoint with `-H "Authorization: Bearer <token>"` and it works, but browser fails
- Pino log shows request has no `auth` context
- `auth.userId` is undefined even though the frontend has a signed-in Clerk user

**Prevention:**
1. Use `@clerk/fastify`'s `clerkPlugin` — it handles header parsing plus JWKS caching correctly. Skip manual `authenticateRequest` unless you have a reason.
2. If using manual: pass the FULL Fastify request as `{ request: { headers: req.headers, url: req.url, method: req.method } }` — the SDK reads from all of these, not just Authorization.
3. Provide `jwtKey` (PEM public key) to `authenticateRequest` — verification becomes networkless, avoids JWKS fetch latency and flakiness.
4. Test with a real signed-in browser token, not just a curl-forged one.
5. Log the outcome of the auth check (userId or `unauthenticated_reason`) at debug level in dev.

**Phase:** P1 backend (auth plugin)

---

### Pitfall 20: Dokploy re-clones the repo on every deploy → any state written to the workdir is wiped

**Symptom:**
- Postgres data disappears after every deploy.
- MinIO objects disappear after every deploy.
- Custom edits to compose file on the VPS are gone.

**Why it happens:**
Dokploy's deploy model: pull repo → build → up. The workdir (`/etc/dokploy/compose/dataroom/code/`) is treated as ephemeral. Named Docker volumes persist; bind mounts to the workdir do not.

**Detection:**
- After a redeploy, sign-in works but no data — everything looks fresh
- MinIO bucket is empty again
- Volume mount in `docker-compose.prod.yml` reads `./data/postgres` (bind mount to workdir) instead of a named volume

**Prevention:**
1. Postgres data → named volume:
   ```yaml
   volumes:
     - postgres_data:/var/lib/postgresql/data
   ...
   volumes:
     postgres_data:
   ```
2. MinIO data → named volume:
   ```yaml
   - minio_data:/data
   ```
3. Never `./anything:/something` in the compose file for stateful services.
4. First-deploy checklist verifies: `docker volume ls | grep dataroom` after deploy → volumes exist and persist across `dokploy redeploy`.
5. Take a manual `mc mirror` backup of the MinIO bucket before any risky deploy.

**Phase:** P6 deploy (compose file authoring)

---

## Take-Home Reviewer Traps (P7 polish focus)

These are what will cost you points from the reviewer even if the app "works". Confidence: MEDIUM (reviewer-taste territory), but consistent across senior-frontend feedback patterns.

### Pitfall 21: Loading spinners everywhere instead of skeleton states

**Symptom:** Every route/data fetch shows a centered spinner while the layout is empty. App feels amateur even if it's technically working.

**Prevention:** Skeleton components that match the eventual UI shape. shadcn provides `<Skeleton>` — use it. Never render `<Spinner />` for a whole-view load; only for inline actions (button loading).

**Phase:** P7 polish (audit all query loading states) — but establish the pattern early in P2 frontend shell

---

### Pitfall 22: `alert()` / `confirm()` / `prompt()` used for anything

**Symptom:** Native browser prompts appear for rename, delete confirmation, error messages. Immediate signal of a rushed submission.

**Prevention:** All confirmations use shadcn `<AlertDialog>`. All prompts use a real form with react-hook-form + Zod. Toasts (`sonner`) for non-blocking success/error notifications.

**Phase:** P4 tree + CRUD (rename/delete dialogs use shadcn AlertDialog)

---

### Pitfall 23: No empty states — new dataroom shows a blank canvas

**Symptom:** User creates a dataroom, sees a completely blank page with no explanation of what to do. First-time UX is confusing.

**Prevention:** Every list/tree has an explicit empty state:
- Empty dataroom → "Create your first folder" CTA + a sample file drop zone
- Empty folder → "Drop PDFs here or click Upload" prompt
- No datarooms → onboarding card explaining what a dataroom is

**Phase:** P7 polish (audit empty states) — but design them alongside feature UI in P2/P3/P4

---

### Pitfall 24: No error states — API errors show a red toast and the UI keeps its stale data

**Symptom:** Backend is down or 500s → user sees a "something went wrong" toast but the folder tree still shows the last-cached state. No path to recover.

**Prevention:**
- Every route wrapped in a TanStack Router `errorComponent` with a Retry button that invalidates queries.
- React Query's `useQuery` `error` state rendered as an inline error card in widgets that fetch data, not a toast alone.
- Global error boundary in `app/` for uncaught renders.

**Phase:** P7 polish + P2 frontend shell (error boundary + errorComponent scaffolding)

---

### Pitfall 25: Keyboard nav broken — tree not navigable with arrow keys, dialogs don't trap focus

**Symptom:** Reviewer opens the app, tries Tab / arrow keys / Escape and nothing works right. Big flag for accessibility.

**Prevention:**
- shadcn `<Dialog>` and `<AlertDialog>` already handle focus trap + Escape. Use them.
- Tree: arrow keys to move, Enter to open, Space to select, Delete for delete. Use `@radix-ui/react-tree` primitives or `react-arborist`, or hand-roll but test.
- All interactive elements are focusable buttons/links, not `<div onClick>`.
- Escape closes any open dialog or drag session.

**Phase:** P7 polish (a11y audit) — hand-rolled tree focus behavior in P4

---

### Pitfall 26: Sample data too obviously fake ("Test Folder 1", `lorem_ipsum.pdf`, `Untitled.pdf`)

**Symptom:** Demo login lands on a dataroom named "test" with `sample.pdf` files. Reviewer knows they're looking at a bootstrap, not a designed demo.

**Prevention:** Seed data that matches the M&A due-diligence framing:
- Dataroom: "Project Nightingale — Acme × Hooli"
- Folders: "01 Financial Statements", "02 Legal", "03 Contracts", "04 IP & Patents"
- Files: real-sounding PDF names like `2024-Q3-Consolidated-Financials.pdf`, `Master-Services-Agreement-Redacted.pdf`
- Actual, small (2-5 page) PDFs generated or checked in — not `sample.pdf`

Bonus: put the sample data behind a "Try demo" button that seeds the user's account on first sign-in.

**Phase:** P7 polish (seed data curation) — sample PDFs prepared in P0 or P5

---

### Pitfall 27: Over-engineered without polish — 200 lines of "clean architecture" ceremony but the core flow feels janky

**Symptom:** Reviewer opens code, sees excellent structure, opens app, sees UI glitches (flash of unstyled state, layout shift on load, drag ghost doesn't render, toast piled on top of another).

**Prevention:** Every hour spent on structure without visible polish is negative EV. Hard rule: after every feature, the reviewer's five-second impression is the acceptance test:
- Does it look intentional?
- Does it never flash?
- Does every interaction have feedback within 100ms?
- Does the app "feel" fast?

**Phase:** P7 polish is where this is enforced, but the discipline runs through every phase

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `db:push` in prod instead of `generate` + `migrate` | Skip migration file authoring | Silent column drops, no audit trail, no rollback | Never in prod — dev-only. For MVP, use `migrate` on api container start. |
| Skipping response schemas in Fastify Zod | Faster routes to write | Leaked internal fields (`ownerId`, hashes), no OpenAPI, no serialization speed | Never — the shared schemas exist for a reason |
| Client-side tree construction from flat list | One query, no CTE | Fine up to ~5k folders per dataroom | Fine for this MVP (no user has 5k folders) |
| No virtualized tree | Simpler code | Jank at ~500+ visible nodes | Fine for the MVP; add if seed data ever needs it |
| No PDF page virtualization (render all pages) | Simpler viewer | Memory blowup on 200+ page PDFs | Fine if you cap uploads to reasonable size (50MB ≈ maybe 100 pages) |
| Best-effort MinIO cleanup on delete (no worker) | Zero infra | Orphaned objects accumulate | Acceptable for MVP if noted in README |
| No cancel on in-flight uploads (just close dialog) | Simpler UI | Ghost pending rows, MinIO orphans | Not acceptable — reviewer will notice |
| Skipping `pnpm --filter web preview` before deploy | Ship faster | Prod-only Vite/worker bugs surface after deploy | Never — always preview locally first |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| MinIO + browser | One S3 client with internal endpoint used for presigning | Two clients: internal for server ops, public for presign |
| MinIO CORS | Configuring `cors.xml` on the bucket like AWS S3 | Set `MINIO_API_CORS_ALLOW_ORIGIN` on the server container |
| Clerk on Vite SPA | Copying `@clerk/nextjs` snippets | Use `@clerk/clerk-react`; `<ClerkProvider>` at app root; `useAuth().getToken()` for API calls |
| Clerk backend verify | Manual header parsing + `verifyToken` | `@clerk/fastify`'s `clerkPlugin` handles headers, JWKS caching, refresh |
| Fastify + Zod | Only `setValidatorCompiler` | ALSO `setSerializerCompiler` — otherwise responses aren't validated |
| Drizzle FK | `references(() => folders.id)` alone | `references(() => folders.id, { onDelete: 'cascade' })` |
| TanStack Router + React Query | Loader fetches, component fetches again (waterfall) | Loader `ensureQueryData` + component `useSuspenseQuery` with the SAME options factory |
| React Query key | Inlined `{ filter }` object in key | Query key factory returning tuples of primitives |
| Vite env | `NEXT_PUBLIC_*` or unprefixed | Every client env `VITE_*`; parse with Zod at boot |
| react-pdf worker | Default entry with no explicit workerSrc | Explicit `pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker` via `?url` import |
| Vercel monorepo | Root Directory = repo root, build command = `pnpm build` | Root Directory = `apps/web`, install/build commands `cd ../.. && …` |
| Dokploy state | Bind mount volumes to workdir | Named Docker volumes always |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Backend proxies file bytes | Fastify CPU spike on upload, latency | Presigned PUT — bytes never touch Fastify | Any single upload > memory limit |
| Rendering full folder tree without virtualization | Scroll jank, initial render >500ms | react-arborist or virtualize | ~500+ visible nodes |
| Query key includes `new Date()` each render | CPU pegged, network floods | Stable primitive keys | Immediately, on affected route |
| N+1 on nested folder fetch (`with: { children }`) | 30 queries per tree fetch | Flat list + client-side tree | ~30+ folders |
| No `staleTime` — refetch on every mount | Rapid API traffic on navigation | `staleTime: 5 * 60_000` per `PROJECT.md` | Feels slow immediately |
| Rendering all PDF pages at once | Memory grows per doc opened, tab crashes at ~5 docs | Page-by-page render with `<Page pageNumber={n} />` | ~50+ page PDFs, or ~5 docs viewed |
| No `keepPreviousData` on folder navigation | Flash of skeleton on every navigation | `placeholderData: keepPreviousData` | Every folder click feels jerky |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Presigned URL scoped too broadly (bucket-wide GET) | User A downloads User B's PDFs | Presign one specific object key per request; keys are UUIDs, not guessable |
| Ownership check missing on any mutation | User A deletes User B's folder | Every mutating handler pulls `ownerId` from JWT and joins on `datarooms.ownerId = auth.userId` |
| `s3Key` derived from user input | Path traversal into other users' objects | Deterministic key format `{ownerId}/{dataroomId}/{fileId}.pdf` where all parts are server-controlled |
| CORS allows `*` origin with credentials | Cross-site request forgery | Explicit origin allowlist (no `*` with credentials) — Clerk requires this too |
| Presigned URL logged to Sentry / logs | Anyone with log access has a valid upload URL for 15 min | Redact URLs in logs; log only `fileId` |
| Clerk publishable key confused with secret key | Publishing secret key to client bundle | `VITE_CLERK_PUBLISHABLE_KEY` only. Never `VITE_CLERK_SECRET_KEY` |
| Trusting client-supplied `mimeType` in `/files/init` | Malicious user uploads `.exe` renamed to PDF | Backend hard-codes `application/pdf` on presign; if you accept it from client, also validate on `HeadObject` after upload |
| No file size cap → user uploads 5GB PDF | MinIO fills up, bandwidth costs, DoS | Enforce `size <= 50MB` at `/files/init`; MinIO also honors `Content-Length` in signed policy |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Upload rendered as optimistic → user thinks file is safe → refreshes → gone | User loses file mentally; trust is broken | Non-optimistic upload with visible progress bar + explicit "complete" transition. Never mark ready before `/files/complete` returns 200 |
| "Are you sure?" browser confirm on delete | Feels dated, non-brand | `<AlertDialog>` with typed "Delete" confirmation for folders with contents |
| Rename triggers immediately on blur without validation | Empty names accepted, whitespace names accepted | Zod-validated form, disable submit if invalid, cancel on Escape |
| Drag ghost invisible or unstyled | Users don't know a drag is in progress | `@dnd-kit` `DragOverlay` with a styled ghost card |
| Tree collapses on every query refetch | Loses user's expand state | Persist expanded folder ids in Zustand keyed by dataroom; not in server cache |
| Upload progress bar jumps to 100% instantly | Because upload is small; looks broken | For small files (<200KB), just fade in the row with a checkmark; skip the bar |
| Same-name conflict shows a generic error | User doesn't know they can rename or overwrite | Specific dialog: "File `X.pdf` already exists in this folder" with "Rename" (auto-suffix "(1)") and "Overwrite" actions |
| PDF viewer full-page overlay with no obvious close | User feels trapped | Clear X button, Escape to close, breadcrumb visible even in viewer |
| No indication of which folder you're in when scrolled | Lose context in deep hierarchies | Sticky breadcrumb header |
| Cascade delete without preview | User accidentally nukes hundreds of files | Confirmation shows "This will delete 47 files and 12 folders." |

---

## "Looks Done But Isn't" Checklist

Verify each of these before saying a phase is complete.

- [ ] **Upload:** Cancel button aborts XHR AND deletes DB row AND deletes S3 object (if any)
- [ ] **Upload:** 409 on duplicate filename shows rename/overwrite dialog, not a red error toast
- [ ] **Upload:** Failure keeps the row with a Retry button — file is not lost from UI
- [ ] **Upload:** Progress bar shows real percentage, not fake CSS animation
- [ ] **Rename:** Empty string / whitespace-only is rejected in the form, not by the backend
- [ ] **Rename:** Optimistic UI reverts on backend rejection (test by killing api)
- [ ] **Delete folder:** Shows count of what will be deleted before confirmation
- [ ] **Delete folder:** Backend cascade deletes verified in DB after operation
- [ ] **Delete file:** MinIO object also deleted (spot-check `mc ls`)
- [ ] **Move:** Cannot drop a folder onto itself or a descendant (visual "no" state)
- [ ] **Move:** Optimistic UI updates the tree, reverts on backend rejection
- [ ] **PDF viewer:** Renders in prod build (not just dev)
- [ ] **PDF viewer:** Memory doesn't leak — open 5 different PDFs, check DevTools memory tab
- [ ] **PDF viewer:** Close (X button, Escape) returns you to your previous folder view
- [ ] **Tree:** Expand-collapse state persists across route navigation
- [ ] **Tree:** Keyboard arrow keys navigate; Enter opens; Delete prompts delete
- [ ] **Auth:** Signed-out users hitting `/datarooms/…` redirect to sign-in, then back after auth
- [ ] **Auth:** Token refresh works — leave tab open for 2 min, then interact — no 401
- [ ] **Auth:** Sign out clears React Query cache
- [ ] **Empty states:** Every list has one (no dataroom / empty dataroom / empty folder)
- [ ] **Error states:** Every query has an inline error state, not just a toast
- [ ] **Loading:** No spinner used for a whole view — skeletons only
- [ ] **Dialogs:** No native `alert()` / `confirm()` / `prompt()` anywhere in the app
- [ ] **Env:** All required env vars validated at boot, both frontend and backend
- [ ] **Prod build:** `pnpm --filter web build && pnpm --filter web preview` works before deploy
- [ ] **CORS:** Curl OPTIONS to `minio.dataroom...` returns allow headers
- [ ] **CORS:** Curl OPTIONS to `api.dataroom...` returns allow headers with credentials
- [ ] **Sample data:** Seeds a realistic M&A dataset on first sign-in, not "test folder 1"
- [ ] **README:** Documents deploy steps, design decisions, live URL, sign-in flow for reviewer
- [ ] **Deploy:** Postgres volume named, MinIO volume named — data survives redeploy

---

## Recovery Strategies

When a pitfall happens despite prevention.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| MinIO CORS breaks in prod | LOW | Update `MINIO_API_CORS_ALLOW_ORIGIN` in compose, `dokploy redeploy minio` (no data loss) |
| Presigned URL uses internal hostname | LOW | Fix `s3Public` client config, redeploy api; old URLs will expire in minutes |
| Content-Type signature mismatch | LOW | Ship a fix that either signs without CT or ensures browser sends it; existing pending uploads will fail, users retry |
| DB missing `ON DELETE CASCADE` | MEDIUM | New migration `ALTER TABLE ... DROP CONSTRAINT + ADD CONSTRAINT`; test in dev first |
| `packages/shared` not resolving in Vercel | LOW | Adjust Vercel build command or package.json exports; redeploy |
| Env var missing in prod | LOW | Add in Vercel dashboard / Dokploy env, redeploy; Zod-boot check catches this |
| Query key instability shipped to prod | LOW-MEDIUM | Fix key factory, ship patch; users on old cache clear on next reload |
| react-pdf worker 504 in prod | LOW | Add explicit `?url` import, rebuild, redeploy |
| Postgres volume was a bind mount, deploy wiped data | HIGH | If backup exists, restore. Otherwise: total data loss. Take a `pg_dump` before any risky change |
| MinIO objects orphaned by cancel bug | MEDIUM | `mc ls --recursive` diff against DB `s3_key` list, `mc rm` the diff; document as one-time cleanup |
| Recursive folder cycle in DB | MEDIUM | Manual `UPDATE folders SET parent_id = NULL WHERE id = '...'` to break the cycle; ship the guard fix |
| Optimistic race showing wrong data | LOW | Add `cancelQueries` to `onMutate`, ship fix |
| Clerk token cached → 401s | LOW | Refactor API client to `getToken()` per request; frontend fix, ship immediately |

---

## Pitfall-to-Phase Mapping

The order below shows which phase MUST prevent each pitfall. Some pitfalls span phases; primary owner listed.

| # | Pitfall | Prevention Phase | Verification |
|---|---------|------------------|--------------|
| 1 | Content-Type signature mismatch | P3 upload | Manual PUT works from browser to `dataroom.holy-water.app` |
| 2 | Presigned URL uses internal hostname | P1 backend | Log presigned URL, confirm hostname is public |
| 3 | MinIO CORS misconfigured | P6 deploy (+ P1 dev compose) | `curl -X OPTIONS` returns allow headers |
| 4 | Presigned URL expiry too short | P3 upload | Upload 40MB file on throttled connection |
| 5 | TanStack Router loader misuse | P2 frontend shell | No waterfall in devtools; mutation reflects instantly |
| 6 | Unstable query key | P2 frontend shell | React Query devtools shows one query per logical resource |
| 7 | Race condition on optimistic mutation | P4 tree + CRUD | Throttle to Slow 3G, rename twice quickly, no revert |
| 8 | Fastify Zod serializer missing | P1 backend | Sample route with extra field in return → 500 (validation fires) |
| 9 | Missing `onDelete: 'cascade'` | P1 backend | Delete parent folder → children gone from DB |
| 10 | N+1 on folder tree | P4 tree + CRUD | Query log shows one SELECT per tree fetch |
| 11 | `packages/shared` resolution in Vercel | P0 bootstrap | `pnpm build` from clean checkout succeeds |
| 12 | Wrong env prefix | P0 bootstrap | Zod boot validation throws on missing var |
| 13 | react-pdf worker not configured | P5 viewer | `pnpm preview` renders a PDF (not just dev) |
| 14 | react-pdf memory leak | P5 viewer + P7 polish | Open 5 PDFs, DevTools memory stays under 300MB |
| 15 | Folder cycle → recursive crash | P4 tree + CRUD | Attempt to move folder into descendant → 400, tree renders |
| 16 | Cancel leaves orphans | P3 upload | Cancel, check DB and MinIO for cleanup |
| 17 | Duplicate name race | P3 upload | Simultaneous upload of same name → one succeeds, other 409 |
| 18 | Cached Clerk token → 401 | P2 frontend shell | Idle 2 min, resume, no auth failure |
| 19 | Backend header parsing | P1 backend | Frontend token verified end-to-end |
| 20 | Dokploy wipes state | P6 deploy | Redeploy, verify data persists |
| 21 | Spinners instead of skeletons | P7 polish (+ P2 pattern) | No `<Loader>` at page level in codebase |
| 22 | `alert()` used | P4 + P7 | grep repo: `alert(` returns zero |
| 23 | No empty states | P7 polish | Fresh account has intentional onboarding |
| 24 | No error states | P7 polish | Kill backend, every view shows an error card + retry |
| 25 | Broken keyboard nav | P7 polish | Tab through app; use tree with arrows |
| 26 | Fake sample data | P7 polish | Seed reads as a real M&A dataset |
| 27 | Over-engineered without polish | Every phase | Five-second reviewer test after each feature |

---

## Sources

MinIO / S3 presigned URLs and CORS:
- [Troubleshoot Signature Mismatch errors with S3 presigned URLs — AWS re:Post](https://repost.aws/knowledge-center/s3-presigned-url-signature-mismatch)
- [MinIO 403 Forbidden for presigned put url — GitHub issue #5630](https://github.com/minio/minio/issues/5630)
- [MinIO SignatureDoesNotMatch on PUT — GitHub issue #15693](https://github.com/minio/minio/issues/15693)
- [MinIO CORS Access-Control-Allow-Origin missing — GitHub issue #11111](https://github.com/minio/minio/issues/11111)
- [Solving Presigned URL Issues in Dockerized Development with MinIO & Internal DNS — Medium](https://medium.com/@codyalexanderraymond/solving-presigned-url-issues-in-dockerized-development-with-minio-internal-dns-61a8b7c7c0ce)
- [Allow defining hostname when requesting presigned URLs — GitHub issue #10222](https://github.com/minio/minio/issues/10222)

TanStack Router + React Query:
- [TanStack Query Integration — TanStack Router Docs](https://tanstack.com/router/latest/docs/integrations/query)
- [TanStack Router and Query — TkDodo blog](https://tkdodo.eu/blog/tan-stack-router-and-query)
- [context.queryClient.ensureQueryData is not a function — GitHub issue #2869](https://github.com/TanStack/router/issues/2869)
- [Validate Search Parameters with Schemas — TanStack Router Docs](https://tanstack.com/router/latest/docs/how-to/validate-search-params)

React Query optimistic + query keys:
- [Optimistic Updates — TanStack Query docs](https://tanstack.com/query/v4/docs/framework/react/guides/optimistic-updates)
- [Concurrent Optimistic Updates in React Query — TkDodo blog](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query)
- [Race condition even though I call cancelQueries — GitHub discussion #7932](https://github.com/TanStack/query/discussions/7932)
- [Effective React Query Keys — TkDodo blog](https://tkdodo.eu/blog/effective-react-query-keys)
- [Constant refetching loop caused by unstable cache key — Medium](https://medium.com/@maxwellhsu/react-query-constant-refetching-loop-caused-by-unstable-cache-key-and-refetchonmount-560afe857e9b)

Clerk on React SPA + Fastify:
- [Manual JWT verification — Clerk docs](https://clerk.com/docs/guides/sessions/manual-jwt-verification)
- [Session tokens — Clerk docs](https://clerk.com/docs/guides/sessions/session-tokens)
- [clerkPlugin() — Fastify SDK Reference](https://clerk.com/docs/reference/fastify/clerk-plugin)
- [Customize your redirect URLs — Clerk docs](https://clerk.com/docs/guides/development/customize-redirect-urls)

Drizzle:
- [Drizzle ON DELETE cascade — GitHub issue #2565](https://github.com/drizzle-team/drizzle-orm/issues/2565)
- [Drizzle Relations docs](https://orm.drizzle.team/docs/relations)
- [Drizzle Migrations in Production — dev.to](https://dev.to/whoffagents/drizzle-orm-migrations-in-production-zero-downtime-schema-changes-e71)
- [Drizzle Migrations to Postgres in production — Budi Voogt](https://budivoogt.com/blog/drizzle-migrations)

Fastify + Zod:
- [fastify-type-provider-zod — GitHub](https://github.com/turkerdev/fastify-type-provider-zod)
- [Response Serialization — DeepWiki](https://deepwiki.com/turkerdev/fastify-type-provider-zod/4.2-response-serialization)
- [Fastify Validation and Serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/)

react-pdf + Vite:
- [Vite entry error — GitHub issue #1232](https://github.com/wojtekmaj/react-pdf/issues/1232)
- [Config worker not work when using Vite + React.lazy — GitHub issue #1843](https://github.com/wojtekmaj/react-pdf/issues/1843)
- [Memory consumption after rendering certain amount of pdfs — GitHub issue #305](https://github.com/wojtekmaj/react-pdf/issues/305)
- [Memory leak related to pdf.worker.js — GitHub issue #504](https://github.com/wojtekmaj/react-pdf/issues/504)

Vite env + Vercel monorepo:
- [Env Variables and Modes — Vite docs](https://vite.dev/guide/env-and-mode)
- [Using Monorepos — Vercel docs](https://vercel.com/docs/monorepos)
- [Deploying Turborepo to Vercel](https://vercel.com/docs/monorepos/turborepo)
- [Live types in a TypeScript monorepo — Colin McDonnell](https://colinhacks.com/essays/live-types-typescript-monorepo)

Take-home reviewer expectations:
- [29 React Codebase Red Flags from a Senior Frontend Developer — Frontend Joy](https://www.frontendjoy.com/p/29-react-codebase-red-flags-from-a-senior-frontend-developer)
- [UI best practices for loading, error, and empty states — LogRocket](https://blog.logrocket.com/ui-design-best-practices-loading-error-empty-state-react/)
- [Why Error States Define the Quality of Your UI — dev.to](https://dev.to/maurya-sachin/why-error-states-define-the-quality-of-your-ui-11lc)

Virtualized trees (deferred, but referenced):
- [react-vtree — npm](https://www.npmjs.com/package/react-vtree)
- [High Performance Directory Component in React — dev.to](https://dev.to/jdetle/memoization-generators-virtualization-oh-my-building-a-high-performance-directory-component-in-react-3efm)

---
*Pitfalls research for: Dataroom MVP (Vite React SPA + TanStack Router + React Query + Clerk + FSD + Fastify + Drizzle + Postgres + MinIO + Dokploy)*
*Researched: 2026-07-03*
