## Goal
After deleting one or many characters (row menu, bulk action bar, or Cast Cleanup panel), show an "Undo" toast for ~10 seconds. Clicking Undo fully restores the character(s) plus all cascaded rows (relationships, scene states, arcs, snapshots, evidence, arc-beat states) exactly as they were.

## Approach — snapshot on delete, restore on undo

Change `deleteCharacter` / `bulkDeleteCharacters` to return a **snapshot payload** of everything they removed, then add a `restoreCharacters` server fn that re-inserts that payload inside RLS. The client keeps the snapshot in memory only for the length of the toast; if the user does nothing, it's discarded (no scheduled server cleanup needed — the rows are already gone).

### Server (`src/lib/characters.functions.ts`)

1. Before deleting, `SELECT *` from each dependent table for the target character ids and collect them into a `snapshot` object:
   ```
   { characters: [...], character_relationships: [...],
     character_scene_states: [...], character_scene_arc_states: [...],
     character_arcs: [...], character_evidence_events: [...],
     character_snapshots: [...] }
   ```
   Include rows where `character_id` OR `related_character_id` is in the id set (for relationships).
2. Perform the existing cascaded deletes.
3. Return `{ ok: true, deleted, snapshot }` from both `deleteCharacter` and `bulkDeleteCharacters`.
4. Add `restoreCharacters` server fn (auth-required, Zod-validated):
   - Input: the snapshot object.
   - Verifies every `characters` row's `project_id` belongs to the caller via a `projects` ownership check (RLS on insert already enforces this, but we double-check to fail fast with a clean error).
   - Re-inserts in dependency order: `characters` first, then relationships / scene states / arcs / evidence / snapshots / arc-beat states — using the original `id`s so foreign keys line up and any other references (e.g. `script_blocks.character_id` if present) keep working.
   - Uses `upsert(..., { onConflict: 'id', ignoreDuplicates: true })` per table so a partial re-click is safe.
   - Returns `{ restored: <n> }`.

### Client (`src/routes/_authenticated/characters.$projectId.tsx`)

1. On `del.mutate` / `bulkDel.mutate` success, take the returned `snapshot` and call `sonner`'s `toast.success("Deleted <label>", { action: { label: "Undo", onClick: () => restore.mutate(snapshot) }, duration: 10000 })` instead of the current plain success toast.
2. Add a `restore` mutation that calls the new `restoreCharacters` server fn, then invalidates the same three queries `invalidate()` already refreshes (`characters`, `relationship-counts`, `scene-counts`). On success show `toast.success("Restored")`.
3. Same treatment inside `CastCleanupPanel` (`src/components/characters/CastCleanupPanel.tsx`) — its Delete / Bulk-delete actions currently go through the same server fns, so wire the returned snapshot into an identical Undo toast there. No other delete surfaces exist for characters.

### Non-goals / untouched
- No new database tables, migrations, or scheduled jobs.
- No changes to scene deletion, script blocks, or the editor.
- No change to bulk-delete confirmation UX — Undo is the safety net *after* confirm.
- Portrait storage: we only reference `portrait_url` (already stored in the `characters` row); we do not copy Storage objects, and none are deleted today, so restore reattaches the same URL.

### Edge cases handled
- Undo after another mutation touched the project → `upsert` with original ids is idempotent; already-existing rows are skipped.
- User navigates away before clicking Undo → snapshot lives in the toast closure; when the toast disposes, the snapshot is GC'd. Data stays deleted, which matches "short time window."
- Snapshot too large (hundreds of characters bulk-deleted) → payload is JSON over the existing server-fn transport; acceptable for the ≤500 cap already enforced by `BulkDeleteInput`.

## Files touched
- `src/lib/characters.functions.ts` — extend `deleteCharacter` + `bulkDeleteCharacters`, add `restoreCharacters`.
- `src/routes/_authenticated/characters.$projectId.tsx` — Undo toast + restore mutation.
- `src/components/characters/CastCleanupPanel.tsx` — same Undo toast on its delete paths.

## Manual test
1. Delete a single character via the `•••` menu → toast shows "Undo" → click within 10s → character reappears with portrait, relationships, scene notes intact.
2. Bulk select 3 characters, delete → Undo restores all 3 and their cross-relationships.
3. Delete via Cast Cleanup panel → Undo works there too.
4. Let toast expire → character stays gone; no console errors.
