## Code Red: Stop Silent Data Loss in the Editor

Critical fix for the issue where text typed in a scene never reaches the database and disappears on reload. Two confirmed defects plus a missing safety net.

### What broke

1. **Fractional `order_index` rejected by Postgres.** `script_blocks.order_index` is `INTEGER NOT NULL`. The editor inserts a block between two siblings using `(after + before) / 2`, which produces `29.5`, `30.5`, etc. Postgres rejects these; the adapter retries 3 times and then **silently** gives up.
2. **Silent retry exhaustion.** `SupabasePersistenceAdapter` calls `decErr()` on final failure with no toast, no banner, no `beforeunload` block. The user has no idea anything is wrong.
3. **No local backup.** Nothing is mirrored to `localStorage`, so once React state unmounts the text is gone forever.

### Fix 1 — Integer-safe ordering (root cause of the rejection)

In `useScreenplayDocument.ts`, replace the midpoint formula in `insertBlockAfter` with an integer-safe placement:

- If `after.order_index + 1 < before.order_index`, use `after.order_index + 1`.
- Otherwise (no gap), **renumber forward**: bump every block from `before` onward by `+1`, mark them dirty, and the new block takes `after.order_index + 1`.
- Add a `renumberFrom(localId, delta)` helper that updates local state and queues an update for each shifted block via the existing `scheduleUpdate`. Insert at end keeps `after.order_index + 1` unchanged.

This guarantees every value sent to the server is a valid integer.

### Fix 2 — Local-first draft mirror in `localStorage`

New module `src/components/editor/draftBackup.ts`:

- Key: `scenesmith.draft.v1.<projectId>`.
- Payload: `{ savedAt: number, blocks: LocalBlock[] }`.
- `writeDraft(projectId, blocks)` — throttled (~500 ms) snapshot of the entire local document. Called from a `useEffect` in `useScreenplayDocument` whenever `localBlocks` changes.
- `readDraft(projectId)` — returns the stored payload if any block is `dirty`, has no `serverId`, or differs from the server snapshot.
- `clearDraft(projectId)` — called when the adapter reports `pending === 0 && no errors` (full sync confirmed).
- `flushDraftSync(projectId, blocks)` — synchronous write fired from a `beforeunload` listener so the last keystroke is always captured.

### Fix 3 — Visible save failures + recovery banner

- `SupabasePersistenceAdapter`: track `failedIds: Set<localId>`. On final retry failure, add to the set, switch aggregator status to a new `"error"` mode that *stays* in error until the next successful flush. Expose `getFailedIds()` so the UI can highlight affected blocks.
- New component `src/components/editor/SaveStatusBanner.tsx`: renders above the paper when status is `"error"`. Copy: "Some of your text isn't saving to the cloud. It's still here on this device — keep writing while we retry, or copy to clipboard as a backup." Buttons: **Retry now**, **Copy all text**, **Open recovery panel**.
- `AutosaveIndicator` already shows status; add an `error` variant with red dot + tooltip listing affected blocks.

### Fix 4 — Recovery flow on editor mount

In `editor.$projectId.tsx`, on mount:

1. Wait for the server blocks query to resolve.
2. Call `readDraft(projectId)`. If it returns a payload **newer than the latest server `updated_at`** and contains blocks not represented on the server, render a non-dismissible modal:
   - Title: "Unsaved changes recovered"
   - Body: show a diff count ("12 lines on this device aren't on the server yet, from 3 minutes ago").
   - Buttons: **Restore drafts** (merges local-only blocks into the document and re-queues inserts) and **Discard** (deletes the local backup).
3. If the user picks Restore, drafts go through `insertBlockAfter` so the new integer-safe ordering applies, and the adapter persists them with the fixed logic.

### Fix 5 — Telemetry for post-hoc debugging

In the adapter, on every final failure write a row via the existing `useWriterEvents`/`emitEvent` path (`event_type: "save_failed"`, `context: { kind, error_message, attempts }`). Cheap, gives us visibility next time.

### Out of scope

- Switching `order_index` to `numeric`/`double` (would also fix Fix 1 but requires a migration and back-compat work; the renumber approach lands today).
- Real-time multiplayer / CRDT.
- Server-side draft sync (we already have a local-first contract).

### Files changed

- `src/components/editor/useScreenplayDocument.ts` — integer-safe `insertBlockAfter`, renumber helper, draft-mirror effect.
- `src/components/editor/draftBackup.ts` (new) — localStorage read/write/clear + sync flush.
- `src/components/editor/persistence/SupabasePersistenceAdapter.ts` — failed-id tracking, `getFailedIds`, exposed `retry()` hook, `"error"` status stays sticky.
- `src/components/editor/SaveStatusBanner.tsx` (new) — UI banner + actions.
- `src/components/editor/AutosaveIndicator.tsx` — error variant.
- `src/routes/_authenticated/editor.$projectId.tsx` — mount-time recovery modal, wire banner, wire telemetry on failure.
- `src/lib/i18n/keys.ts` — new strings for banner, modal, indicator.

### Verification

- Manual: type in the middle of an existing scene, refresh, confirm nothing is lost.
- Force a failure by setting `order_index` column briefly to text in a clone DB (or by intercepting the request) — confirm the banner appears and the recovery modal shows after reload.
- Unit-style sanity check on `insertBlockAfter` proving every produced `order_index` is an integer for sequences of 20 mid-document inserts.
- Confirm `clearDraft` is only called after `pending === 0 && failedIds.size === 0`.

### Re: your current lost content

Most of the dialogue from scene 3 (Hans/Stephan coffee exchange, Fritz line) never reached the server, so I can't recover it from the database. **Before you do anything else, open the editor for that project in the same browser, then check DevTools → Application → Local Storage** — if anything is there from before the reload, we may be able to paste it back manually. After this plan ships, that scenario is automatically caught and restored.