
# Screenplay Editor Rescue — Local-First Plan

The screenplay page is sacred. Everything else is secondary. This plan implements the editor in four small, verifiable passes. Each pass has a hard stop; we do not advance until its acceptance check passes.

---

## 1. Current editor diagnosis

Files inspected:
- `src/components/editor/useScreenplayDocument.ts`
- `src/components/editor/ScreenplayDocumentEditor.tsx`
- `src/components/editor/ScreenplayLine.tsx`
- `src/routes/_authenticated/editor.$projectId.tsx`
- `src/lib/editor/nextBlockType.ts`, `autoFormat.ts`
- `docs/SCREENPLAY_EDITOR_CONTRACT.md`, `EDITOR_LAB_SPEC.md`, `EDITOR_ACCEPTANCE_TESTS.md`, `LOVABLE_PASS_SEQUENCE.md`

What's actually working:
- `useScreenplayDocument` already uses stable `local-…` IDs as React keys; `serverId` is stored separately. Server-echo guard exists (skip merge when active/dirty/saving).
- `ScreenplayLine` is a single `<textarea>` with autosize, Tab cycling, Enter transitions, slash menu, and auto-format detection.

What is still broken / fragile:
1. **Supabase is still on the typing path.** `useScreenplayDocument` imports `supabase` directly and calls `runInsert`/`runUpdate` from inside the same hook that owns local state. Any Supabase hiccup mutates the same hook that owns focus/active state, so a failure ripples into the writing surface. Persistence is not isolated behind an adapter, and there is no localStorage draft fallback — the contract requires both.
2. **Server-echo merge runs on every `initialBlocks` reference change.** Because the route passes the React Query array directly, any cache invalidation (template insert, `invalidateQueries(['blocks', projectId])`, AI continue) triggers the merge effect mid-typing. The guard protects the active block, but it still rewrites neighbors and can race with in-flight inserts (duplicate rows when the new local block hasn't received its `serverId` yet before the next refetch lands).
3. **Route still owns block-mutation paths.** `editor.$projectId.tsx` runs `insertTemplate` (bulk Supabase insert) + `qc.invalidateQueries(['blocks', projectId])` for AI Continue, opening template, Story Builder — exactly the "invalidate during typing" pattern the contract forbids. It also reads `blocks` (server cache) for outline, page count, AI context, and current-page math, mixing server truth with local truth.
4. **Click-below-last-line path is in the editor component, but it inserts via `insertBlockAfter` which calls `queueInsert` immediately.** Good for local focus, but ties the click path to network optimism. Acceptable for Pass 3, must be local-only in Pass 1.
5. **Toolbar focus risk.** The per-line floating toolbar (`QUICK_TYPES` buttons) uses `onMouseDown preventDefault`, which is correct, but the global `Cmd+1–7` handler lives on the route and is wired to `editorRef`, meaning route remounts (StudioMode toggle, drawer toggles) re-bind listeners and can drop keystrokes during the React commit.
6. **Tab key swallowed globally only inside `ScreenplayLine`.** Outside the textarea (e.g. the moment after Enter creates a new block before the new textarea is focused via `useEffect`), Tab can escape to the browser. Symptom: occasional focus jump to toolbar/sidebar.
7. **No `screenplayKeymap.ts` and no `screenplayPersistence.ts` modules** as the contract names them. Keymap logic is inlined in `ScreenplayLine.handleKeyDown`; persistence is inlined in the hook. Splitting these is a prerequisite for swapping in a mock adapter for `/editor-lab`.
8. **No `/editor-lab` route exists.** All testing happens in the production route, where AI/Coach/Builder/Guided side-effects make it impossible to attribute regressions to the editor itself.
9. **Auto-format `onChangeType` during typing** schedules an update at 200ms. If the user is still typing the first word, the resulting `setLocalBlocks` re-render is harmless for focus but does fire a save mid-keystroke. Not a bug, but a credit/network cost we can defer.
10. **Ghost line / temp-ID juggling is mostly gone**, but the route still passes `onOpenStoryBuilder`/`onDraftWithAi`/`onInsertTemplate` handlers that render helper buttons on top of the seed block. These compete for the writer's attention on first load and partially recreate the "click before typing" anti-pattern. Pass 3 will hide these by default.

---

## 2. Target architecture

```text
src/components/editor/
  useScreenplayDocument.ts     local state + mutators only, no Supabase
  ScreenplayDocumentEditor.tsx renders lines, owns click-below-last-line
  ScreenplayLine.tsx           single textarea, autosize, smart format
  screenplayKeymap.ts          pure functions: Enter/Tab/Shift+Tab/Backspace
  screenplayPersistence.ts     adapter: insert/update/delete queue, draft I/O
src/routes/editor-lab.tsx      local-only proving ground (Pass 1)
src/routes/_authenticated/editor.$projectId.tsx
                               composes layout + side panes only (Pass 3)
```

Ownership:

| File | Owns | Must not own |
|---|---|---|
| `useScreenplayDocument` | `localBlocks`, `activeBlockId`, `dirtyIds`, mutators, hydration from initial snapshot, server-echo merge | Supabase, fetch, React Query, focus DOM calls |
| `ScreenplayDocumentEditor` | rendering, click-below-last-line, `editorRef` imperative API | block transitions, persistence, route data |
| `ScreenplayLine` | textarea, autosize, smart-format detect, slash UI | block transition logic (delegates to keymap) |
| `screenplayKeymap` | pure `nextBlockTypeAfter`, `cycleType`, `keymapForLine` | React, DOM |
| `screenplayPersistence` | insert/update/delete queues, debounce, retry, localStorage draft, optional Supabase adapter (Pass 2) | UI, focus, React state |
| `/editor-lab` | renders engine with a mock adapter (or none) | network, auth, side panes |
| `/editor/:projectId` | data fetch, layout, side panes, AI, Coach, Builder | typing, Enter/Tab, block CRUD |

---

## 3. Pass 1 plan — local-only `/editor-lab`

Goal: prove the writing engine works with zero network.

Files created:
- `src/routes/editor-lab.tsx` — new public route, minimal header, centered paper, mounts the editor with a local-only adapter.
- `src/components/editor/screenplayKeymap.ts` — extract pure functions (`nextBlockTypeAfter`, `cycleType`, `enterTransition`, `tabCycle`) currently scattered in `nextBlockType.ts` + `ScreenplayLine`.
- `src/components/editor/screenplayPersistence.ts` — Pass 1 ships a `NullPersistenceAdapter` (no-op insert/update/delete). Interface is defined here so Pass 2 swaps in `SupabasePersistenceAdapter` without touching the hook.

Files edited:
- `src/components/editor/useScreenplayDocument.ts` — remove direct `supabase` import; accept a `persistence` adapter via props. Keep all local-state logic. Strip the React Query `patchCache` calls into the adapter.
- `src/components/editor/ScreenplayDocumentEditor.tsx` — make `initialBlocks`, `characters`, helper-button props optional so the lab can render with `[]` and `null`.
- `src/components/editor/ScreenplayLine.tsx` — route Enter/Tab through `screenplayKeymap` (no behavior change, just relocation).

Acceptance for Pass 1 (run in `/editor-lab` only):
1. Route opens → one focused `scene_heading` line, caret visible, no buttons clicked.
2. Type `int african desert day` → first character `i` appears, auto-formats to `INT. AFRICAN DESERT - DAY`.
3. Enter → new Action block, focused.
4. Tab cycles forward; Shift+Tab cycles backward; focus stays.
5. Character → Enter → Dialogue → Enter → Character pattern works.
6. Click below last line → new editable block.
7. Slash menu opens, selecting a command preserves focus and typed text.
8. 30 seconds sustained typing: no remount, no caret jump, no duplicate, no delete.

Stop condition: every item above passes manually before Pass 2 begins.

---

## 4. Pass 2 plan — background persistence

Goal: add Supabase + draft recovery without changing typing.

Files created:
- `src/components/editor/persistence/SupabasePersistenceAdapter.ts` — implements the adapter interface using `supabase.from('script_blocks')`. Owns insert/update/delete queues, debounce (500–800ms), retry-with-backoff (cap 3, then mark `error`), in-flight tracking, and React Query cache patching (`qc.setQueryData(['blocks', projectId], …)` — never `invalidateQueries`).
- `src/components/editor/persistence/LocalDraftStore.ts` — `localStorage` snapshot keyed by `projectId`. Writes on every dirty mutation (throttled 1s). Reads on hydration when server returns empty or unreachable.

Files edited:
- `src/components/editor/useScreenplayDocument.ts` — call `persistence.queueInsert/update/delete` instead of running mutations inline. Hydration: prefer server data; if server unreachable, fall back to local draft.
- `src/routes/editor-lab.tsx` — add a toggle to swap `NullPersistenceAdapter` for `SupabasePersistenceAdapter` against a scratch project, so we can prove persistence without touching the production editor.

Local-ID vs server-ID contract:
- React keys always use `localId`. The adapter receives `localId` and returns `{ serverId }` via callback. The hook patches the matching block in place — never replaces the key.

Queues:
- **Insert queue**: FIFO, one in-flight per block. If content changes during insert, schedule a follow-up update once `serverId` arrives.
- **Update queue**: debounced per-block (600ms). If a block's `serverId` is missing when update fires, defer until insert resolves.
- **Delete queue**: fire-and-forget if `serverId` exists; clear pending timers for that block.

Server-echo guard (already present): on any cache patch / refetch, merge a row into local state only if the local block is not active, not dirty, not saving, not in error. Otherwise keep `order_index` only.

Why never `invalidateQueries(['blocks', projectId])` during typing: invalidation triggers a refetch, which replaces the array reference in props, which re-runs the merge effect, which can drop in-flight inserts as "stale server rows" while the user is still typing.

Stop condition: editor-lab still passes Pass 1 tests with the Supabase adapter on; refresh restores content; network-off (devtools) does not stop typing; reconnect drains the queue without duplicates.

---

## 5. Pass 3 plan — production integration

Goal: drop the proven engine into `/editor/:projectId` without disturbing side panes.

Files edited:
- `src/routes/_authenticated/editor.$projectId.tsx`:
  - Keep: `useQuery(['project'])`, `useQuery(['blocks'])`, `useQuery(['characters'])`, AppShell, ProjectNav, GuidedRail, CoachPane, StoryNavigatorPane, StoryBuilder, FeatureDock, CanvasToolbar, AutosaveIndicator, EditorTour, StudioModeToggle.
  - Pass server `blocks` as `initialBlocks` (hydration only; the hook's merge logic already handles subsequent updates).
  - Remove: route-owned `insertTemplate` mutation path that bulk-inserts via raw Supabase + `invalidateQueries`. Replace with `editorRef.current?.insertBlocksAtEnd(parsedBlocks)` so template/AI Continue go through the local-first engine and persistence adapter.
  - Remove: global `Cmd+1–7` handler from route; move into `ScreenplayDocumentEditor` so it doesn't rebind on route renders.
  - Hide helper buttons (`onOpenStoryBuilder`/`onDraftWithAi`/`onInsertTemplate`) behind a "Need a starting point?" link instead of rendering them under the seed line.
- `src/components/editor/ScreenplayDocumentEditor.tsx`:
  - Add imperative `insertBlocksAtEnd(blocks)` and own `Cmd+1–7`.
  - Wire `onBlockCreated` → emits `block_created` / `scene_created` writer events (already happens; keep).

Side panes (CoachPane, StoryNavigator, StoryBuilder, FeatureDock, CanvasToolbar):
- Continue to read from React Query (`['blocks', projectId]`). Persistence adapter patches that cache on success, so panes update without invalidation.
- Story Builder's "insert beats" path calls `editorRef.insertBlocksAtEnd` instead of raw Supabase insert.
- Copy / download utilities read from `editorRef.getBlocksSnapshot()` (new imperative method) or from the React Query cache — both reflect the same content.

What is intentionally NOT changed in Pass 3:
- Visual design.
- CoachPane behavior, StoryPulse, Academy, Storyboard, Table Read, Pitch, Pricing.
- Auth flow.

Stop condition: every acceptance test from `/editor-lab` passes in `/editor/:projectId` with side panes mounted.

---

## 6. Pass 4 plan — cleanup

Files edited / lines removed:
- `src/routes/_authenticated/editor.$projectId.tsx`:
  - Delete `insertTemplate` raw mutation, `pendingTempContent`-style state, route-level Enter/Tab handling, `invalidateQueries(['blocks', projectId])` calls during writing.
  - Delete global Cmd+1–7 keymap (moved to editor component in Pass 3).
- Remove any remaining ghost `div role="button"` writing line if found in legacy files (`EmptyEditorTeacher.tsx`, older editor scaffolding — to be audited).
- Consolidate duplicated block type constants between `ScreenplayLine.BLOCK_TYPES`, `nextBlockType.ts`, and `autoFormat.BLOCK_LABEL` into a single `src/lib/editor/blockTypes.ts`.
- Delete `runDelete` references in the hook that bypass the adapter.

Stop condition: route is slimmer, no editor logic outside `src/components/editor/`, acceptance tests still pass.

---

## 7. Acceptance test plan

Run from `docs/EDITOR_ACCEPTANCE_TESTS.md`. Manual script, executed first in `/editor-lab`, then `/editor/:projectId`:

```text
int african desert day  → Enter
The sun burns across an endless sea of sand.  → Enter
A lone soldier stumbles over a dune.  → Tab until Character
STEPHAN  → Enter
Just a few more clicks.  → Enter
COMMANDER  → Enter
You are lost, soldier.
[continue typing for 30s]
```

Verify:
- First character never lost.
- No blur, no caret jump, no duplicate or accidental delete.
- Block transitions correct per the contract table.
- Pass 2+: refresh preserves content; throttle to offline keeps typing alive; reconnect drains queue with zero duplicates.

I'll execute manually each pass and report results before moving forward.

---

## 8. Risk analysis

| Risk | Mitigation |
|---|---|
| React remount of active line | Stable `localId` React key, never substituted. Verified in `useScreenplayDocument` already. |
| Textarea focus loss on rerender | Focus is owned by `ScreenplayLine` `useEffect([isActive])`, not by parent re-renders. Avoid changing `key` or unmounting. |
| Slash menu steals focus | Menu uses `onMouseDown preventDefault` on items; verified pattern. Add `tabIndex={-1}` on menu container. |
| Toolbar steals focus | Quick-type buttons already `onMouseDown preventDefault`. Add same to any new toolbar element. |
| Server echo overwrites local text | Guard: skip merge when block is active/dirty/saving/error. Already in hook; covered by tests in Pass 2. |
| Duplicate server rows | Single in-flight insert per `localId` (savingIds set). Updates wait for `serverId` before firing. No invalidation during typing. |
| `order_index` conflicts | Use fractional midpoints (`(a+b)/2`) for inserts between blocks; periodic background re-normalization (Pass 4 if needed, not Pass 2). |
| Stale React Query cache | Persistence adapter patches cache in place (`setQueryData`); never `invalidateQueries` during typing. |
| localStorage draft conflicts | Drafts keyed by `projectId`; clear on successful full hydration. On conflict, prefer the version with later `mtime`. |
| Route-level side effects (StudioMode toggle, drawer opens) re-bind keyboard handlers and drop keystrokes | Move global shortcuts into the editor component (Pass 3), keep route side panes pure render. |
| `Tab` escaping the textarea | `ScreenplayLine` already `preventDefault`s Tab; ensure new lines get `autoFocus` synchronously via `useEffect`. |

---

## 9. Stop conditions

- **Pass 1 → Pass 2**: do not proceed until every `/editor-lab` acceptance test passes manually with the null adapter.
- **Pass 2 → Pass 3**: do not proceed until `/editor-lab` (with Supabase adapter) passes refresh-recovery and offline-tolerance tests AND no duplicate rows appear in `script_blocks` after a 30s typing session.
- **Pass 3 → Pass 4**: do not proceed until `/editor/:projectId` passes the full acceptance script identical to `/editor-lab`.
- **Pass 4 done**: route is slimmer, no editor logic outside `src/components/editor/`, all tests still pass.

Hard rule: no new product features (StoryPulse, storyboard, table read, Academy polish, AI tools, pitch, pricing) until Pass 4 closes.

---

## Approval checkpoint

Approve this plan and I'll execute Pass 1 only: create `screenplayKeymap.ts`, `screenplayPersistence.ts` (null adapter), `/editor-lab` route, and refactor `useScreenplayDocument.ts` to take a persistence adapter. I'll stop there and ask you to run the acceptance test before touching anything else.
