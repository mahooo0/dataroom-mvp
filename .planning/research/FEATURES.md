# Feature Research — Virtual Data Room MVP

**Domain:** Google Drive-like file manager, framed as M&A due-diligence data room
**Researched:** 2026-07-03
**Confidence:** HIGH for Google Drive / Dropbox / Box UX conventions (well-documented, personally used, community-validated). MEDIUM for enterprise VDR baseline expectations (Firmex, Datasite, iDeals features known from marketing/comparison sites, not personally used).

## Reading Guide for Downstream Consumers

This file categorizes features into three buckets with an explicit **verdict** on each:

- **SHIP** — table-stakes feature we must build. Missing = demo feels broken.
- **DIFFERENTIATE** — worth building if time allows. Ranked by value/cost.
- **SKIP** — deliberately out of scope. Reasoning drives the README "Out of Scope" section.

Complexity ratings (**S/M/L**) assume the locked-in stack (React 19 + shadcn/ui + TanStack Query + Fastify + Postgres + MinIO). "S" = under 30 min because a primitive/library covers 80% of it. "M" = a couple hours. "L" = half a day or more.

---

## 1. Table Stakes — General File-Manager UX

Features every Drive-like app has. Users will consciously or unconsciously judge us on all of these. Ordered by scoring impact per TASK.md ("UX & functionality" > "design & polish").

### 1a. Navigation

| Feature | Verdict | Complexity | Why It Matters | Implementation Note |
|---------|---------|------------|----------------|---------------------|
| Breadcrumb trail (Dataroom > Folder > Sub) | SHIP | S | Users disorient without location context. shadcn `Breadcrumb` primitive already handles this. | Truncate middle segments with ellipsis if trail exceeds 4 crumbs. Root crumb links to dataroom root. |
| Click any breadcrumb crumb to jump | SHIP | S | Broken breadcrumbs are worse than no breadcrumbs. NN/g explicitly calls this out. | TanStack Router `<Link>` on each crumb. |
| Sidebar folder tree (collapsible) | SHIP | M | Every mature file manager has one (Drive, Dropbox, Box, VS Code file explorer). Missing it screams "hackathon project." | Recursive component. Prefetch children on hover. Persist expanded state per dataroom in Zustand. |
| Back/forward navigation | SHIP-BY-DEFAULT | S (free) | Browser back/forward works if we use real routes. Free from TanStack Router. | Do NOT build custom back button — the browser one is there. |
| Current folder title in header | SHIP | S | Anchors the user on scroll when breadcrumbs scroll away. | Sticky header. |
| URL reflects current folder | SHIP | S | Copy-paste-shareable URLs are table stakes. Also enables reload-to-current-location. | Use `/datarooms/$dataroomId/folders/$folderId` path or a `?path=` query param. |

### 1b. CRUD Interactions

| Feature | Verdict | Complexity | Why It Matters | Implementation Note |
|---------|---------|------------|----------------|---------------------|
| Right-click context menu on rows | SHIP | S | shadcn `ContextMenu` primitive already copied. Users right-click. This is muscle memory. | Actions: Open, Rename (F2), Move, Download, Delete. Different menus for folders vs files. |
| Row hover actions (three-dot menu) | SHIP | S | Discoverability aid for mouse users who don't right-click. shadcn `DropdownMenu`. | Show on `.group:hover`. Duplicates context menu. |
| Inline rename (double-click name or press F2) | SHIP | M | Modal rename feels sluggish. Drive, Dropbox, and OS finder all use inline rename. | Escape cancels, Enter commits. Auto-select filename portion (not extension). |
| Drag and drop files between folders | SHIP | M | Table stakes for anything Drive-like. `@dnd-kit` already in the stack. | Highlight drop targets, forbid dropping onto self or descendant. |
| Drag files from desktop to upload | SHIP | M | The #1 way users add files to Drive/Dropbox. | Full-page drop zone that appears when `dragover` detected at document level. |
| Multi-select (Cmd/Ctrl+click, Shift+click, marquee) | DIFFERENTIATE | M | Nice but not required for MVP demo (single-file flow is enough). Marquee (drag-to-select) is L complexity. | If shipped: only Cmd/Ctrl+click. Skip marquee. |
| Bulk delete / bulk move | DIFFERENTIATE | S (given multi-select) | Only makes sense with multi-select. | Cheap to add once multi-select works. |
| Keyboard shortcuts (see 1e) | SHIP-PARTIAL | S-M | Delete, F2, Enter, Escape are baseline. `?` help modal is a differentiator. | See section 1e. |

### 1c. File Viewer

| Feature | Verdict | Complexity | Why It Matters | Implementation Note |
|---------|---------|------------|----------------|---------------------|
| In-app PDF viewer (not `<iframe>`) | SHIP | M | Already a Key Decision in PROJECT.md. iframe UI looks foreign. | `react-pdf` with custom toolbar in a dialog or dedicated route. |
| Page navigation (prev/next, jump-to-page) | SHIP | S | Any PDF viewer has this. | Toolbar with buttons + input for page number. |
| Zoom in / out / fit-to-width | SHIP | S | Built into most `react-pdf` demos. | Range: 50%, 75%, 100%, 125%, 150%, 200%, fit-width, fit-page. |
| Download button | SHIP | S | Users assume they can download what they see. | Presigned GET URL, `<a download>` link. |
| Fullscreen mode | DIFFERENTIATE | S | `Element.requestFullscreen()` is one call. Feels polished. | Press `F` to toggle. Optional. |
| Close-and-return preserves scroll position in file list | SHIP | S | If the viewer is a modal/dialog, closing it should not reset the folder view. | Use a dialog, not a route replace. Or route with `keepPreviousData` on parent list query. |
| Progressive first-page render | SHIP-BY-DEFAULT | S | `react-pdf` streams pages by default. Don't fight it. | Render page 1 immediately, lazy-render subsequent pages as user scrolls or navigates. See section 4d. |
| Text selection / copy | SHIP-BY-DEFAULT | S (free) | `react-pdf` renders a text layer by default when `renderTextLayer={true}`. | Just leave the default on. |
| Print button | SKIP | — | Users can `Cmd+P` in the browser. Adding a custom button = clutter. | Rely on browser default. |

### 1d. States (Empty / Loading / Error)

Per TASK.md scoring priority #2 ("don't include unimplemented features"), empty and error states are where evaluators notice care or its absence.

| State | Verdict | Complexity | Copy / Design Note |
|-------|---------|------------|--------------------|
| Empty dataroom (no folders/files) | SHIP | S | Illustration or icon + "This dataroom is empty" + primary CTA "Upload files" + secondary "New folder". |
| Empty folder | SHIP | S | Lighter than empty dataroom: "This folder is empty" + same two CTAs. |
| Empty datarooms list (new user) | SHIP | S | "Create your first dataroom to get started." Single CTA. |
| Skeleton loading for file/folder lists | SHIP | S | shadcn `Skeleton` primitive. Match row height so no layout shift. Use for `isPending`, NOT for `isFetching` when previous data exists. |
| Skeleton for PDF viewer | SHIP | S | Grey rectangle at page aspect ratio while pdf.js parses first page. |
| Error state — network / 5xx | SHIP | S | shadcn `Alert` variant destructive. "Something went wrong. Retry" button. Sonner toast for mutations. |
| Error state — 403/404 | SHIP | S | Dedicated "You don't have access to this dataroom" / "Not found" page. |
| Upload failed (per-row) | SHIP | S | Row stays visible with red icon + Retry button. Don't just toast and disappear. |
| Offline detection | SKIP | — | Rare for a demo. Not table stakes. |

### 1e. Keyboard Shortcuts

Only shortcuts users try instinctively. Do NOT invent a proprietary keymap. Base on Google Drive's 2024 refresh (Ctrl+/ opens shortcut help, first-letter navigation, etc.).

| Shortcut | Action | Verdict | Complexity |
|----------|--------|---------|------------|
| `Enter` | Open selected item | SHIP | S |
| `F2` | Rename selected | SHIP | S |
| `Delete` or `Backspace` | Delete selected (with confirm modal for folders) | SHIP | S |
| `Escape` | Close dialog / cancel inline edit / clear selection | SHIP | S |
| `Cmd/Ctrl + A` | Select all in current folder | DIFFERENTIATE | S |
| `?` or `Cmd/Ctrl + /` | Open shortcut cheat sheet | DIFFERENTIATE | M | shadcn `Dialog` listing shortcuts. Signals polish. |
| Arrow keys | Move selection up/down in file list | DIFFERENTIATE | M |
| First-letter navigation | Type "P" jumps to first item starting with P | SKIP | L | Google added this in 2024. Nice, but L complexity for MVP. |

### 1f. Confirmation Modals

The rule: **destructive-and-irreversible → modal. Reversible → toast with undo. Trivial → nothing.**

| Action | Modal? | Justification |
|--------|--------|---------------|
| Delete file | NO — soft optimistic + toast with Undo (5s) | Reversible pattern that Gmail popularized. Feels faster than a modal. |
| Delete empty folder | NO — soft optimistic + toast with Undo | Nothing important is lost. |
| Delete folder **with contents** | YES — modal | Cascade delete could wipe dozens of files. Show count: "Delete 'Q3 Financials' and its 12 files and 3 folders? This cannot be undone." |
| Overwrite existing file (same name) | YES — modal | See section 6. |
| Delete dataroom | YES — modal with type-to-confirm | Nuclear. Type dataroom name to confirm — GitHub repo-delete pattern. |
| Rename | NO | Inline. Trivial. |
| Move | NO | Optimistic, toast with Undo if a mistake. |

**Trade-off note:** Undo-with-toast requires backend to support soft-delete or delayed hard-delete. For MVP, the simpler path is: **hard-delete immediately** but keep the confirmation modal only for folders-with-contents and dataroom deletion. Skip Undo entirely on single-file/empty-folder delete. This is honest: an Undo button that doesn't actually work is worse than no Undo. Complexity S vs L.

**Recommendation:** No Undo pattern in v1. Hard delete for files and empty folders (no modal). Hard delete for non-empty folders (with modal). Hard delete for datarooms (with type-to-confirm).

---

## 2. Table Stakes Specific to Data Rooms (What Differs From Personal Drive)

**Question posed:** Would evaluators expect a hint of VDR-specific features (access control, watermarks, audit log, Q&A)?

**Answer, direct:** No. TASK.md explicitly frames this as *"take inspiration from Google Drive, Dropbox, Box, etc., for UI/UX where the Data Room is the top-level folder or drive."* The M&A framing is narrative flavor, not a functional spec. Every VDR-specific feature (Q&A, watermarks, audit logs, granular permissions, DRM) is a multi-day build and is explicitly outside functional requirements.

That said, the DATAROOM CONCEPT (top-level container above folders) is table stakes because TASK.md names it. What we need:

| Feature | Verdict | Complexity | Note |
|---------|---------|------------|------|
| Multiple datarooms per user (list view) | SHIP | S | "Dataroom" is the top-level abstraction. A "Datarooms" list page is essential. |
| Create dataroom (name only) | SHIP | S | Modal or inline. |
| Rename / delete dataroom | SHIP | S | Modal for delete (destructive). |
| Dataroom metadata badge (file count, updated-at) | DIFFERENTIATE | S | Visual polish on the datarooms list. |
| Dataroom cover / description | SKIP | — | Not in TASK.md. Decorative. |

**Anti-VDR-features to explicitly SKIP (see section 3):** watermarks, expiration, audit log, granular permissions, Q&A, guest invites, DRM. All discussed with rationale in section 3.

---

## 3. Differentiators — Ranked by Value/Cost

Ranked by (evaluator wow-factor per hour of build time). Build top-down until time is out.

| Rank | Feature | Value | Complexity | Reasoning |
|------|---------|-------|------------|-----------|
| 1 | **Optimistic UI everywhere it's safe** (rename, delete, create folder, move) | HIGH | S-M | Core of "feels instant." Already a Key Decision. React Query `onMutate`+`onError` handles rollback. Not really a differentiator — it's the difference between polished and broken. |
| 2 | **Client-side filename filter** (search box, instant) | HIGH | S | TASK.md lists search as extra credit. Client filter is 30 min and gives zero-latency vibe. Search across the current folder, or across the whole dataroom, is a design choice. |
| 3 | **Prefetch folder children on hover in sidebar tree** | HIGH | S | TanStack Router + React Query prefetch. Makes navigation feel telepathic. |
| 4 | **Drag files from desktop directly onto a folder in the tree** | HIGH | M | dnd-kit + native drag events. Upgrade over "upload button." |
| 5 | **Toast with progress for multi-file upload** | MEDIUM | M | Sonner supports custom content. Shows queued/in-progress/done count. |
| 6 | **First-page PDF thumbnail on file rows** | MEDIUM | M | Real Drive-like feel. Generate via pdf.js on client after upload completes, cache in IndexedDB or as a background job. Complexity climbs if server-side generation is needed. Client-side lazy generation on scroll is achievable. |
| 7 | **Dark mode** | MEDIUM | S | Template already has it. Toggle in header. Free polish. |
| 8 | **Recently viewed / recently uploaded** (top of dataroom home) | MEDIUM | M | Small backend addition (order by `updatedAt`). Feels like a real product. |
| 9 | **Folder icon color/emoji picker** | LOW | S | Cute but decorative. Skip unless everything else is done. |
| 10 | **Move via keyboard-driven "Move to..." dialog** (Cmd+K-style) | LOW | M | Cool but niche. Only if time is generous. |
| 11 | **Duplicate file / duplicate folder** | LOW | M | Not in TASK.md. Skip. |
| 12 | **Sort options (name / date / size)** | MEDIUM | S | Users expect column header click to sort. Cheap. |
| 13 | **Grid vs list view toggle** | LOW | M | Drive has it. Nice, not necessary. Adds design work for two layouts. |

**Priority stack for a 4-6h budget:** Ship #1, #2, #3, #7, #12. Reach for #4, #5, #6 if time remains. Everything else is out.

---

## 4. UX Polish Patterns That Make File Managers FEEL Fast

This is where the demo wins or loses on TASK.md scoring dimension #1.

### 4a. Optimistic Updates — What To Be Optimistic About

**Be optimistic** (rollback rarely matters, user sees instant feedback):

- **Rename file/folder** — 99% success rate. Rollback shows toast: "Rename failed. Reverted."
- **Create folder** — Show the row immediately with a temp ID. Backend confirms with real ID.
- **Delete file/folder** — Row disappears. Rollback re-inserts on failure.
- **Move file/folder** — Item leaves source folder, appears in target immediately.

**Do NOT be optimistic** (failure would be confusing or destructive):

- **File upload** — Bytes might fail. Show a pending row with progress bar. Only mark success when `POST /files/{id}/complete` confirms. Already a Key Decision.
- **Overwrite on same-name conflict** — Two-step confirmation before actually doing anything.
- **Cascade delete of non-empty folder** — Confirmation modal first. Then optimistic removal is fine.

### 4b. Prefetching Strategies

Explicit list of prefetch targets:

| Trigger | What to Prefetch | How |
|---------|------------------|-----|
| Hover over folder row (300ms delay) | Folder's children (subfolders + files) | `queryClient.prefetchQuery(folderKeys.children(id))` on `onMouseEnter` |
| Hover over folder in sidebar tree | Same as above | Same |
| Viewport intersection (file about to become visible) | File thumbnail or download URL | IntersectionObserver + prefetch |
| App load (root query) | Root folder of most-recent dataroom | On login redirect |
| Route enter | Route loader (TanStack Router native) | `loader: ({ context }) => context.queryClient.prefetchQuery(...)` |

**Avoid over-prefetching:** Do not eagerly walk the entire folder tree. It kills the backend and wastes user bandwidth.

### 4c. Skeleton Loading Patterns

| Where | Pattern | Note |
|-------|---------|------|
| Initial folder list load | Row skeletons matching row height | 5-8 rows. Match exact height to avoid layout shift. |
| Sidebar tree first load | Nested indented skeletons | Two levels deep is enough. |
| PDF viewer while loading page | Grey rectangle sized to page aspect ratio | Never a spinner. |
| Route transitions | `keepPreviousData: true` on React Query | Prior data stays visible; only skeleton on true first load. |

**Rule:** Skeletons for `isPending`. Prior data + subtle top loading bar (or nothing) for `isFetching && !isPending`. Never both.

### 4d. Progressive PDF Loading

`react-pdf` gives most of this for free:

1. Set `<Document loading={<Skeleton/>} />` for the initial parse.
2. Render page 1 immediately when `onLoadSuccess` fires. Show a page counter (`Page 1 of N`).
3. Render additional pages lazily: only pages currently in viewport plus 1 before and 1 after. Use IntersectionObserver or manual page navigation.
4. For a modal viewer, page-at-a-time (with prev/next) is simpler than continuous scroll — and matches Adobe Reader / Drive's default. **Recommendation: page-at-a-time viewer.** Continuous scroll adds virtualization complexity for zero perceived benefit in a demo.
5. `<Document>` should be given a stable `file` prop (memoized) or pdf.js re-parses on every render.
6. Set `withCredentials={false}` on the Document — presigned URLs already carry auth.

### 4e. Toast Patterns for Mutations

Using `sonner` (already in stack):

| Mutation | Toast | Duration |
|----------|-------|----------|
| Create folder | Success: "Folder created" | 2s |
| Rename | Silent on success. Toast only on error. | — |
| Move | "Moved to /Foo/Bar" | 3s |
| Delete file/empty folder | "Deleted 'name'" | 2s |
| Delete non-empty folder | Silent on success (modal already confirmed). Toast on error. | — |
| Upload complete | "'name.pdf' uploaded" | 2s |
| Upload failed | Persistent error toast with Retry button | Until dismissed |
| Same-name conflict | No toast — modal handles it | — |
| Network error | Destructive toast: "Network error. Please retry." | 5s |

**Anti-pattern:** Do NOT toast every micro-mutation. Toast for uploads (long-running) and errors. Rename/select-and-move should be silent because the visual state change IS the feedback.

### 4f. Keyboard Shortcuts Users Expect

See section 1e. Summary of minimum viable set: `Enter`, `F2`, `Delete`, `Escape`, `Cmd/Ctrl+A`.

---

## 5. Anti-Features — Traps That Would HURT This MVP

Concrete list of features that seem good but would damage the scoring.

| Anti-Feature | Why It Seems Good | Why It Would Hurt | Do This Instead |
|--------------|-------------------|-------------------|-----------------|
| **Decorative page transitions / route animations** | "Feels premium." | Data Room UX must feel FAST. Animations delay every interaction. Framer Motion transitions on route change = perceived 200ms slowdown. Evaluators judging on speed will notice. | Instant route transitions. Only animate what MUST animate (drag hover, tree expand). Already in CLAUDE.md as "Animate UI — selective use only." |
| **Global spinner overlay on any mutation** | "Users need to know something is happening." | Blocks the UI, feels slow, breaks optimistic UX flow. | Optimistic updates + inline skeletons. Sonner toasts for failures. |
| **Modal for rename** | "Cleaner than inline edit." | Two extra clicks, breaks flow. No mainstream file manager does this. | Inline rename on double-click / F2. |
| **Modal for create folder** | "Consistent modal pattern." | Slower than inline. Drive uses inline "New folder" that appears in place. | Inline: press "New folder" → row appears in edit mode → user types name → Enter. |
| **Excessive breadcrumbs on shallow trees** | "More context." | If the entire path is 2 levels, the breadcrumb bar adds visual clutter without value. | Show breadcrumbs only when depth > 1. At root, show only the dataroom name as a heading. |
| **Global full-text search over PDF contents in v1** | "Users want it." | Requires text extraction pipeline. Multi-day build. Search that returns nothing (because indexing hasn't finished) feels broken. | Client-side filename filter. Note in README: "Full-text PDF search is a natural next step." |
| **Server-rendered PDF thumbnails for the file list** | "Looks like Drive." | Requires headless pdf.js on server or a queue system. Adds infra complexity. | Icon-only in v1. Client-generated thumbnail as differentiator #6 if time permits. |
| **Onboarding tutorial / product tour** | "Helps users understand." | Reviewers will click Skip. They know how a file manager works. | No onboarding. First-time empty state has clear CTAs — that's the tour. |
| **Trash / recycle bin** | "Users expect it." | Debatable. Drive has it, but implementing soft-delete + Trash UI is a full feature. TASK.md doesn't require it. Confirmation modal on destructive folder delete is a reasonable replacement. | Confirmation modal for folder-with-contents delete. No Trash. |
| **Sharing UI / permission dialogs** | "Data Rooms have this." | Multi-tenancy is explicitly out of scope in PROJECT.md. Building a Share button that opens a "Coming soon" dialog is worse than not having it (TASK.md scoring #2: "don't include unimplemented features"). | No sharing UI at all. Not even a disabled button. |
| **Watermarks on PDFs / DRM** | "It's a Data Room." | Days of work. Not evaluated. | Not built. Called out in README as a natural production extension. |
| **Audit log / activity feed** | "It's a Data Room." | Backend eventing + timeline UI. Not evaluated. | Not built. Already in PROJECT.md Out of Scope. |
| **Q&A / annotations** | "Real VDRs have them." | Multi-day feature. Not in TASK.md. | Not built. |
| **Guest invites / expiring links** | "It's a Data Room." | Requires user management + token system. Not evaluated. | Not built. |
| **Real-time updates via websockets** | "Feels modern." | Single-user scope. No collaboration = no reason to reconnect on tab focus. | Standard React Query polling on window focus is enough. |
| **Preview for non-PDF files** | "Drive supports 100+ formats." | TASK.md limits to PDF. | Reject uploads that aren't `application/pdf` at the presigned-URL init endpoint. |

---

## 6. Same-Name File Upload — Industry-Standard UX

TASK.md explicitly names this edge case. Understanding what real products do:

### What Real Products Do

| Product | Behavior | Note |
|---------|----------|------|
| **Google Drive (web)** | Auto-appends `(1)`, `(2)`. No dialog. | Convenient but has drawn user complaints for creating unintended duplicates. |
| **Dropbox (web)** | Shows dialog: **Replace / Keep both (auto-rename) / Cancel**. | Explicit user choice. |
| **Box** | Similar dialog: Replace / Keep both. | |
| **macOS Finder** | Dialog: Replace / Keep both / Stop. | |
| **Windows Explorer** | Dialog: Replace / Skip / Compare. | |
| **OneDrive** | Similar to Dropbox. | |

**Consensus of desktop and enterprise products:** show a dialog. Google Drive's silent-rename is an outlier and users complain about it.

### Recommended Behavior for This MVP

Match Dropbox pattern (matches user expectation, matches CLAUDE.md's stated approach of UNIQUE constraint + 409 → prompt):

1. User uploads `financials.pdf`. Backend detects `UNIQUE(folderId, name)` violation and returns 409 `FOLDER_NAME_TAKEN`.
2. Frontend catches error code and opens a modal:

   > **"financials.pdf" already exists in this folder.**
   > - **Replace existing file** (overwrite content, keep same name)
   > - **Keep both** (upload as `financials (1).pdf`)
   > - **Cancel**

3. Actions:
   - **Replace:** call a dedicated `POST /files/{existingId}/replace` endpoint that keeps the DB row + name, generates a new presigned PUT with same `s3Key` (S3 overwrites the object), then `POST /complete` marks `status='ready'`. Note: this changes the file bytes, which is a real edit. The old bytes are gone.
   - **Keep both:** frontend computes the next available `(n)` suffix client-side by checking the existing file list (already in React Query cache — no extra fetch), then retries with the new name. Server-side there's no special path — it's just a new upload with a new name.
   - **Cancel:** dismiss the modal, the pending upload row disappears.

4. For **multiple simultaneous same-name uploads** (rare edge — drag 10 files where 3 conflict): show a single modal listing the conflicts with per-row Replace/Keep both/Skip options, plus an "Apply to all" toggle. This is Windows Explorer's pattern. **For MVP, ship the single-file case only.** Multi-file conflict resolution UI is a differentiator, not table stakes for a 6-hour project.

### Complexity: M

Backend needs a `/files/{id}/replace` endpoint (~30 min). Frontend needs a modal (~30 min). "Keep both" logic (~15 min). Test the 409 flow end-to-end (~15 min). Roughly 1.5 hours including polish.

---

## 7. Competitor Behaviors Worth Studying

Concrete pointers. All are publicly accessible and worth 10-15 min each while designing.

### Google Drive (drive.google.com)
Study for: right-click menu structure, breadcrumb behavior, empty state design, keyboard shortcut palette (press `?`), first-letter navigation, and file/folder row hover states. Not to copy: silent-duplicate-rename, gray-heavy palette in 2026.

### Dropbox (dropbox.com/home)
Study for: same-name upload dialog, sidebar tree, upload progress panel (bottom-right persistent), and folder metadata badges. Their file/folder icons are worth referencing.

### Box (app.box.com — trial available)
Study for: file preview panel that opens on file click without route change, and the way they handle multi-selection.

### DocSend (docsend.com)
Closest to our "data room for evaluators" positioning. Study: how they display a single "collection" of files, viewer overlay pattern, and the minimal chrome around the PDF viewer. Notably: they lean into read-only sharing, which is the opposite of our CRUD spec — reference for polish, not for CRUD patterns.

### Firmex (firmex.com — marketing site + demos)
Reference for the "enterprise VDR" aesthetic (mostly to know what we're explicitly NOT doing: heavy chrome, dense information density, deep permission trees).

### Datasite (datasite.com — marketing site)
Same reason as Firmex.

### VS Code Explorer
Underrated reference for sidebar file tree behavior: expand/collapse animation timing, indent guides, hover states, and inline rename UX. `react-arborist` or `react-complex-tree` are React libraries that approximate this feel.

---

## 8. Feature Dependency Graph

```
sign-in (Clerk)
    └──> datarooms list page
              └──> create dataroom
              └──> select dataroom
                        └──> folder tree (recursive)
                                  └──> create folder
                                  └──> rename folder (needs create)
                                  └──> delete folder (needs create)
                                  └──> move folder (needs drag-drop)
                                  └──> folder contents view
                                            └──> upload file
                                                      ├──> same-name conflict modal (needs upload)
                                                      └──> upload progress toast (needs upload)
                                            └──> rename file (needs upload)
                                            └──> delete file (needs upload)
                                            └──> move file (needs drag-drop)
                                            └──> view file (needs upload)
                                                      ├──> page nav (needs viewer)
                                                      ├──> zoom (needs viewer)
                                                      └──> download (needs viewer)

breadcrumbs ──enhances──> folder navigation
sidebar tree ──enhances──> folder navigation
keyboard shortcuts ──enhances──> all CRUD
optimistic UI ──enhances──> all CRUD (except upload)
prefetch on hover ──enhances──> folder navigation, PDF viewer
skeleton loading ──enhances──> every query state
```

### Phase-ordering implications for REQUIREMENTS.md

If the roadmap has phases, this ordering is forced by the graph:

1. **Auth + shell** — Clerk + protected route + empty datarooms list.
2. **Dataroom CRUD** — Create/list/delete/rename dataroom.
3. **Folder CRUD** — Nested folders, tree, breadcrumbs.
4. **File upload + list** — Presigned upload, same-name conflict, upload progress.
5. **File viewer** — react-pdf with controls.
6. **File CRUD** — Rename, delete, move.
7. **Polish** — Prefetch, optimistic UI (which should really be woven in from step 2, not saved for last), skeleton refinement, keyboard shortcuts, dark mode, empty states, error states.
8. **Deployment + README** — Vercel + Dokploy + Clerk prod keys + screenshots.

Optimistic UI (item 1 in Differentiators) is called out as "weave in from the start" because retrofitting it later is more work than doing it correctly the first time.

---

## 9. MVP Definition — What Ships in v1

### Launch With (v1) — Table Stakes Only

- [ ] Clerk sign-in (magic-link demo mode)
- [ ] Datarooms list page + create/delete/rename dataroom
- [ ] Nested folders with tree sidebar + breadcrumbs + URL reflects folder
- [ ] Folder create/rename/delete (with confirmation for non-empty)
- [ ] File upload (drag-drop from desktop + button)
- [ ] Same-name conflict modal (Replace / Keep both / Cancel)
- [ ] File rename/delete
- [ ] In-app PDF viewer (page nav, zoom, download, fullscreen optional)
- [ ] Right-click context menus + row hover actions
- [ ] Inline rename with F2 / double-click
- [ ] Empty states for datarooms list, empty dataroom, empty folder
- [ ] Skeleton loading for lists and viewer
- [ ] Error states (network, 403/404) + destructive toasts
- [ ] Confirmation modal for delete-non-empty-folder and delete-dataroom
- [ ] Optimistic UI for create/rename/delete/move; NOT for upload
- [ ] Sonner toasts for uploads and errors
- [ ] Baseline keyboard shortcuts (Enter, F2, Delete, Escape)
- [ ] Dark mode toggle
- [ ] Deployed (Vercel + Dokploy) with Clerk prod keys
- [ ] README with design decisions and setup

### Add If Time Remains

- [ ] Client-side filename filter
- [ ] Prefetch folder children on hover
- [ ] Drag files between folders in tree
- [ ] Multi-file upload progress toast
- [ ] Sort by name / date / size
- [ ] Client-generated PDF thumbnails
- [ ] Keyboard shortcut help modal (`?`)
- [ ] Multi-select + bulk delete
- [ ] Recently viewed / recently uploaded row

### Explicitly Out — Reasoning For README "Out of Scope"

- Sharing / multi-user / permissions — TASK.md scope
- Full-text PDF search — multi-day feature
- Non-PDF files — TASK.md limits scope to PDFs
- Watermarks / audit log / Q&A / expiration / DRM — VDR-specific, not in TASK.md, days of work each
- Trash / soft delete with Undo — introduces backend complexity; hard-delete with confirmation is honest
- Real-time / websockets — single-user scope
- Onboarding tour — reviewers know file managers
- Marquee multi-select — L complexity for niche gain
- SSR / SEO — content behind auth

---

## 10. Feature Prioritization Matrix

Only differentiators shown (table stakes are all P1 by definition).

| Feature | User Value | Impl Cost | Priority |
|---------|------------|-----------|----------|
| Optimistic UI (create/rename/delete/move) | HIGH | LOW-MED | P1 |
| Client-side filename filter | HIGH | LOW | P1 |
| Prefetch on hover | HIGH | LOW | P1 |
| Dark mode | MED | LOW | P1 (already free from template) |
| Sort by name/date/size | MED | LOW | P1 |
| Multi-file upload with progress | MED | MED | P2 |
| Drag files to sidebar folders | HIGH | MED | P2 |
| First-page PDF thumbnails | MED | MED | P2 |
| Multi-select | MED | MED | P2 |
| Fullscreen PDF | LOW | LOW | P2 |
| Recently viewed | MED | MED | P3 |
| Cmd+K "Move to" dialog | LOW | MED | P3 |
| Grid/list toggle | LOW | MED | P3 |
| First-letter navigation | LOW | HIGH | P3 |
| Folder emoji/color | LOW | LOW | P3 |
| Duplicate item | LOW | MED | P3 |

**Priority key:** P1 = must ship; P2 = ship if time; P3 = skip unless everything else is done.

---

## Sources

**Directly analyzed for UX patterns (personal experience + community-verified conventions, HIGH confidence):**
- Google Drive web app — [drive.google.com](https://drive.google.com)
- Dropbox web app — [dropbox.com](https://www.dropbox.com)
- Box web app — [box.com](https://www.box.com)
- macOS Finder / Windows Explorer conventions

**Referenced during research (MEDIUM confidence for enterprise VDR feature lists):**
- [Firmex — Best Virtual Data Room Providers in 2026](https://www.firmex.com/resources/vdr-tips-tricks/best-virtual-data-room-providers-in-2025/)
- [Datasite — VDR for M&A guide](https://www.datasite.com/en/resources/insights/virtual-data-rooms-for-m-and-a)
- [Orangedox — Top 11 M&A Data Rooms Providers in 2026](https://www.orangedox.com/blog/best-m-and-a-virtual-data-rooms)
- [Peony — 15 Best Data Rooms 2026](https://www.peony.ink/blog/top-10-virtual-data-room-providers)
- [Dealroom — Best Virtual Data Room Service Providers 2026](https://dealroom.net/resources/virtual-data-room-providers-comparison)

**UX pattern references (MEDIUM confidence, general web UX):**
- [NN/g — Breadcrumbs: 11 Design Guidelines](https://www.nngroup.com/articles/breadcrumbs/)
- [Setproduct — Breadcrumbs UI design](https://www.setproduct.com/blog/breadcrumbs-ui-design)
- [Google Drive keyboard shortcuts (official)](https://support.google.com/drive/answer/2563044)
- [Google Workspace Updates — 2024 Drive keyboard shortcut refresh](https://workspaceupdates.googleblog.com/2024/04/first-letters%20navigation-google-drive.html)

**File conflict UX (MEDIUM-HIGH — multiple community discussions confirm):**
- [Google Drive Community — Uploading files with same name creates copies](https://support.google.com/drive/thread/16022579/uploading-files-with-same-name-makes-copies-instead-of-revisions)
- [Wisfile — What happens if I upload two files with the same name to Dropbox](https://www.wisfile.ai/faq/what-happens-if-i-upload-two-files-with-the-same-name-to-dropbox)

**React-pdf performance (HIGH — official repo discussions):**
- [wojtekmaj/react-pdf — Performance issues rendering large PDFs](https://github.com/wojtekmaj/react-pdf/discussions/1691)
- [wojtekmaj/react-pdf — Preload Pages and Cache](https://github.com/wojtekmaj/react-pdf/issues/1816)
- [Joyfill — Optimizing In-Browser PDF Rendering](https://joyfill.io/blog/optimizing-in-browser-pdf-rendering-viewing)

---
*Feature research for: Virtual Data Room MVP (Google Drive-like, PDF-only, single-user)*
*Researched: 2026-07-03*
