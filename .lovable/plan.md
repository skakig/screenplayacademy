## Goal

1. Make Character Arc edits **persist to Supabase** and the **TMH sparkline reload** when the dialog reopens.
2. Add a **comprehensive debounced autosave** to the whole Character dialog so nothing typed is lost, with a visible save-status indicator.

## What's already in place

- `CharacterArcSection` commits each field via the existing `upsertCharacterArc` server fn on slider commit / textarea blur, and invalidates `["character-arc", characterId]`. That row is keyed by `character_id`, so reopening already refetches.
- The rest of the dialog only saves when the user clicks the per-tab "Save" button, so typed text can be lost on close.

## Changes

### 1. New hook `src/hooks/use-autosave.ts`

Generic debounced field-diff autosaver.

- Inputs: `local`, `remote`, `delay` (default 800 ms), `onSave(patch)`, `ignoreKeys` (e.g. `id`, `created_at`, `updated_at`, `project_id`).
- Behavior:
  - Computes `patch = shallow diff(local, remote)` whenever `local` changes.
  - Debounces and calls `onSave(patch)` when patch is non-empty.
  - Tracks `status: "idle" | "dirty" | "saving" | "saved" | "error"` and `lastSavedAt`.
  - Flush-on-unmount: on cleanup or when `flush()` is called (dialog close), it immediately fires the pending save synchronously via the latest patch.
- Returns `{ status, lastSavedAt, flush }`.

### 2. Wire autosave into `CharacterProfileDialog`

- Use the hook against `local` (all character fields) and `character` (server snapshot), saving via the existing `upsertCharacter` server fn — same shape already used by per-tab Save.
- Call `flush()` in `onOpenChange(false)` so closing the dialog forces a final save.
- Replace each tab's `<SaveBar>` with a single header **SaveStatus** indicator next to the "Generate Full" button:
  - `"Saving…"` (spinner) / `"Saved · just now"` / `"Saved · 12s ago"` / `"Unsaved changes"` / `"Save failed — retry"` (clickable).
- Keep a small manual "Save now" link inside the indicator for power users / error retry.
- Suppress autosave for fields already saved imperatively (group select, ElevenLabs voice, TMH sliders) by filtering them out of the diff via `ignoreKeys` — they continue to write through their own `save.mutate` calls.

### 3. Tighten `CharacterArcSection` autosave

- Switch its per-field commits from `onBlur` to the same `useAutosave` hook against the local arc state, so typing autosaves after 800 ms without needing to leave the field.
- Keep slider `onValueCommit` for instant TMH saves (sliders don't blur in a useful way).
- Render the same SaveStatus chip inside the Character Arc card header.
- On mount / reopen, the existing `useQuery(["character-arc", characterId])` already refetches; add `refetchOnMount: "always"` to guarantee fresh server values populate the sparkline immediately when the dialog reopens.

### 4. Reopen behavior

In `CharacterProfileDialog`, set `refetchOnMount: "always"` on the `["character", characterId]` query so reopening pulls the latest character row (mirrors the same change in the arc query).

### 5. UX details

- Indicator placement: dialog header, right of the "Generate Full" button.
- Network-failure handling: hook keeps `local` dirty, surfaces `"Save failed — retry"`, retries automatically on the next change or on click.
- No new tables, no new server fns, no schema changes.

## Out of scope

- Optimistic per-keystroke server writes (single debounced batch per 800 ms is enough).
- Conflict resolution against concurrent edits in another tab.
- Autosave for `RelationshipsTab` (it already writes per-row via its own server fns).