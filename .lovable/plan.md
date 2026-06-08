
# Pass 2 — Supabase Persistence Adapter

Goal: implement `SupabasePersistenceAdapter` behind the existing `PersistenceAdapter` interface (from Pass 1) so the editor can persist to `script_blocks` without ever sitting on the typing path. Local typing remains synchronous; Supabase becomes a background target.

Scope (per `docs/LOVABLE_PASS_SEQUENCE.md` Pass 2):
- Background persistence only. Typing path unchanged.
- Add localStorage draft recovery.
- Patch the React Query cache in place — never `invalidateQueries(['blocks', projectId])` during typing.
- Do NOT change `useScreenplayDocument` mutator semantics, `ScreenplayLine`, `ScreenplayDocumentEditor`, or production route behavior.

## 1. Files created

### `src/components/editor/persistence/SupabasePersistenceAdapter.ts`
Factory `createSupabasePersistenceAdapter({ projectId, queryClient, onSaveStatus?, onLastSaved? }): PersistenceAdapter`.

Owns:
- **Insert queue**: per-`localId` single-flight. Reads the *latest* snapshot from a `getSnapshot` callback at flush time (so content typed during the round-trip is included via a follow-up update once `serverId` arrives).
- **Update queue**: per-`localId` debounced (600ms). If `serverId` is missing at flush time, defer (re-schedule 400ms) until insert completes.
- **Delete queue**: fire-and-forget per `serverId`; cancels any pending insert/update timers for that `localId`.
- **In-flight tracking**: `savingIds: Set<localId>` so a second write coalesces instead of racing.
- **Retry with backoff**: 3 attempts (300ms, 900ms, 2700ms). On final failure, status flips to `error` and the block is marked stuck until the next user edit re-queues it.
- **Cache patch**: after each successful insert/update/delete, `queryClient.setQueryData(['blocks', projectId], …)` to keep side panes consistent. Never `invalidateQueries`.
- **Aggregate save status**: `pendingCount` drives `onSaveStatus('dirty'|'saving'|'saved'|'error')` and `onLastSaved(Date.now())` callbacks.

Adapter API (matches Pass 1 interface):
- `queueInsert(row, onServerId)` — needs a way to read the latest local content at flush time. To avoid changing the existing `PersistenceAdapter` interface signature, the adapter stores `row` snapshot and refreshes from the next `scheduleUpdate` call. Sufficient because every content edit also calls `scheduleUpdate`.
- `scheduleUpdate(localId, getSnapshot, delay?)`
- `queueDelete(serverId)`
- `cancelPending(localId)`

### `src/components/editor/persistence/LocalDraftStore.ts`
Tiny localStorage wrapper, **opt-in only** (we'll only enable in the lab in this pass; production hydration already comes from server). Keyed `scenesmith.draft.<projectId>`:
- `read(projectId): LocalBlock[] | null`
- `write(projectId, blocks): void` (throttled 1s)
- `clear(projectId): void`

Used in Pass 2 only by `/editor-lab` toggle to prove draft recovery works. Production hydration is unchanged — Pass 3 will wire it into `/editor/:projectId` if needed.

## 2. Files edited

### `src/routes/editor-lab.tsx`
Add a small header toolbar:
- Toggle: **Null adapter** (default) ↔ **Supabase adapter** (uses a stable `projectId = "editor-lab-scratch"` — note: editor-lab is a public route, so a real Supabase write would 401 under RLS).
- Because `/editor-lab` is unauthenticated, the Supabase toggle is **gated behind a sign-in check** using `supabase.auth.getSession()`. If no session, render a "Sign in at /auth to test Supabase persistence" hint and keep the toggle disabled. This keeps the lab honest without forcing auth.
- Pass `queryClient` from `useQueryClient()` into the adapter factory.
- Show a tiny save-status pill driven by `onSaveStatus`.

### `src/components/editor/useScreenplayDocument.ts`
No behavioral changes; just keep the hook adapter-agnostic. The existing branch that uses the built-in Supabase path remains for the production editor in Pass 2 (Pass 3 will switch production to the new adapter).

## 3. Files explicitly NOT touched

- `src/routes/_authenticated/editor.$projectId.tsx` — production wiring waits for Pass 3.
- `ScreenplayDocumentEditor.tsx`, `ScreenplayLine.tsx`, `screenplayKeymap.ts` — already correct.
- Any side pane, AI, Coach, Builder, or Academy file.

## 4. Local ID vs server ID contract

- React keys never change. `localId` stays for the lifetime of the block.
- Adapter receives `localId` only. On insert success it returns `serverId` via `onServerId` callback; hook patches the block in place.
- Updates require `serverId`. If a content edit fires before insert resolves, `scheduleUpdate` defers until insert completes (re-schedule 400ms).

## 5. Server echo guard reaffirmed

The hook's existing merge effect already skips blocks that are `active | dirty | saving | error`. Adapter never invalidates the query — it only patches via `setQueryData`. Therefore the merge effect won't fire from adapter activity; it only fires when external code (e.g. AI template insert in Pass 3) invalidates the query. Pass 3 will replace those invalidations with `editorRef.insertBlocksAtEnd`.

## 6. Acceptance test plan

In `/editor-lab` with the **Supabase adapter** toggled on (signed in):

1. Re-run the full Pass 1 manual script. No regression: first character, Enter, Tab, Character↔Dialogue, click-below-last-line, slash menu, 30s sustained typing.
2. Type a few blocks, wait 1s, refresh — content restored from `script_blocks`.
3. DevTools → Offline. Type 5 more blocks. Save indicator flips to `error`. Typing remains synchronous.
4. DevTools → Online. Queue drains, indicator returns to `saved`. Query `script_blocks` directly: no duplicate rows, `order_index` correct.
5. Delete a saved block via Backspace-on-empty: row removed from DB after delete settles.
6. Toggle adapter to **Null**: refresh shows blocks gone (no draft); typing still works locally.

If any test fails, Pass 2 is not done.

## 7. Risk analysis (incremental)

| Risk | Mitigation |
|---|---|
| Duplicate inserts on rapid Enter | `savingIds` set; `queueInsert` no-ops if `serverId` already set or insert in flight. |
| Update fires before insert completes | `scheduleUpdate` checks `serverId`; defers with re-schedule until insert resolves. |
| Race between offline retry and user editing | `getSnapshot` is called at every flush, so retries always send latest content. |
| Cache patch overwriting newer local edit | `setQueryData` patches the row by `serverId`, but the hook's merge guard still skips active/dirty blocks, so cache patches can't clobber the textarea. |
| `editor-lab` writing to wrong project's `script_blocks` | Use a sentinel `projectId = "editor-lab-scratch"` and warn in the UI; require sign-in for the Supabase toggle. |
| Build-time import of `client.server` | Adapter uses only the browser `supabase` client (`@/integrations/supabase/client`). No service-role import. |

## 8. Stop condition

Pass 2 is done — and we do NOT begin Pass 3 — until:
- Acceptance tests above pass.
- No duplicate rows after a 30s typing session.
- Offline typing remains synchronous; reconnect drains without loss.

On approval I will implement only the files listed in §1 and §2.
