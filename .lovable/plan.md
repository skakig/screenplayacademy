# Pass 7 — Live Scene Collaboration Experiment

Final, highest-risk pass. Strictly experimental, off by default, scene-scoped, additive only.

## Guardrails (non-negotiable)

- Flag `collaboration_live_scene_editing_enabled` defaults **false**. No UI surfaces unless on.
- Zero changes to `src/components/editor/**` typing/keymap/parser/persistence. Live layer reads/writes through a thin adapter that observes block state — it does NOT replace the local-first path.
- Realtime payloads carry single-block deltas only. No screenplay/project blobs.
- No live cursors. Text-update only in 7A (insert/delete/move deferred and documented).
- All gates re-checked client-side AND backed by RLS / security-definer helpers server-side.

## Feature flag

New file `src/lib/featureFlags.ts`:
- Reads `import.meta.env.VITE_COLLAB_LIVE_SCENE_EDITING` (string `"true"` → on).
- Exports `isLiveSceneCollabEnabled()` + `useFeatureFlag("collaboration_live_scene_editing_enabled")`.
- `.env.development` gets the flag commented out; `.env`/`.env.production` untouched (stays off in prod).

## Database (single migration)

1. `ALTER TABLE public.script_blocks ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1, ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);`
2. Trigger `bump_script_block_revision` on `BEFORE UPDATE` of `content`/`block_type` → `NEW.revision = OLD.revision + 1; NEW.updated_at = now();`
3. `CREATE TABLE public.live_scene_sessions (id, project_id, scene_id, started_by, status text default 'active', started_at, ended_at, metadata jsonb)` — with GRANT to authenticated + service_role, RLS, policies using `is_project_member` / `can_edit_project`.
4. Skip `live_scene_events` table for this pass — events ride realtime + (optional) existing change_events log entries: `live_session.started/joined/left`, `live_edit.conflict_detected`. No per-keystroke rows.
5. `ALTER PUBLICATION supabase_realtime ADD TABLE public.live_scene_sessions;` so participant lists update.

## Realtime channel

- Name: `scene-collab:{projectId}:{sceneId}`
- Subscribe only after: authed + `project_role` ≠ null + role in `{owner, co_writer, editor}` + flag on + scene not hard-locked by another (Pass 4) OR current user holds lock.
- Two message types broadcast on the channel:
  - `presence` (track) — `{user_id, display_name, avatar_url, role}`
  - `broadcast: "block_update"` — payload `LiveBlockUpdateEvent` (only `operation:"update_text"` in 7A; `update_type` behind sub-flag check, deferred otherwise).
- Origin tag `origin: "local"` set before send; receiver ignores own `user_id` to prevent echo loops.

## New files

```text
src/lib/featureFlags.ts
src/lib/live-collab/types.ts                  # event + held-conflict types
src/lib/live-collab/useLiveSceneSession.ts    # subscribe/track/emit/receive
src/lib/live-collab/useLiveBlockBridge.ts     # adapter: observe local block, debounce-emit; apply safe remote
src/lib/live-collab/conflictQueue.ts          # in-memory store hook
src/lib/live-collab/permissions.ts            # canStartLiveSession / canJoin / lock checks
src/components/writers-room/live/LiveCollabLabPanel.tsx
src/components/writers-room/live/LiveSessionControls.tsx   # Start / Join / Leave
src/components/writers-room/live/LiveParticipants.tsx
src/components/writers-room/live/LiveConnectionBadge.tsx
src/components/writers-room/live/LiveConflictsPanel.tsx
src/components/writers-room/live/LiveConflictCard.tsx      # Keep mine / Use theirs / Resolve later
src/components/writers-room/live/ExperimentalBadge.tsx
supabase/migrations/<ts>_live_scene_collab.sql
```

## Edited files (small, surgical)

- `src/components/writers-room/permissions.ts` — add `canStartLiveSession`, `canJoinLiveSession`.
- `src/routes/_authenticated/writers-room.$projectId.tsx` — add 5th tab **Live Lab** (only when flag on), routes to `LiveCollabLabPanel`. Tab hidden entirely when flag off.
- `src/lib/i18n/keys.ts` — add `collab.live.*` keys listed in the spec.
- `src/integrations/supabase/types.ts` — regenerated after migration.
- `src/components/writers-room/board/SceneRow.tsx` — add small "Live Lab" link (flag-gated) opening the lab scoped to that scene.

**Not edited**: any file under `src/components/editor/**`. The bridge reads the script-blocks query cache + applies remote updates by patching the cached rows; the editor reacts via its existing query subscription, no new wiring inside the editor.

## Live session lifecycle

1. **Start**: permission + lock check → insert row into `live_scene_sessions` → subscribe channel → `track()` presence → log `live_session.started`.
2. **Join**: same checks; no new row, just subscribe + track.
3. **Local edit emit**: bridge watches `script_blocks` cache for the active scene; on changed `content`, debounce 500ms → broadcast `{operation:"update_text", script_block_id, base_revision, text, client_timestamp}`. Skip if user lacks edit role, scene locked by other, value unchanged.
4. **Remote apply**:
   - Drop if `actor_id === self`.
   - Drop if flag off, channel scene mismatch, op unsupported.
   - Look up block in cache. Missing → hold (`missing_block`).
   - Block focused locally OR marked dirty → hold (`local_dirty`).
   - `base_revision !== cached.revision` → hold (`revision_mismatch`).
   - Else patch cache: `{...block, content: text, revision: base_revision+1}` via `queryClient.setQueryData`. No editor remount (stable keys preserved).
5. **Leave / unmount**: flush pending debounce, `untrack`, `removeChannel`, mark session row `ended`. Best-effort.
6. **Reconnect**: on `CHANNEL_ERROR`/`CLOSED`, flip badge to "Reconnecting", retry once; on success refetch scene blocks via React Query invalidation (preserving any dirty local state by checking editor's dirty map first) and emit `live_edit.recovered`.

## Conflict UI

`LiveConflictsPanel` shows held items with:
- "View incoming" (read-only preview of remote text)
- "Keep mine" → drop held item
- "Use theirs" → apply to cache + bump revision
- "Resolve later" → no-op
- Banner copy from i18n; calm card styling per visualdesign.md (paper surface, warm border, restrained "Experimental" badge).

## Scene-lock interaction

- Pre-start: refuse if `scene_locks` row exists for another user without override role.
- Mid-session: subscribe to `scene_locks` postgres_changes filtered by scene; if another lock appears, pause apply (`paused` state) and hold incoming until resolved.

## Presence interaction

If `PresenceProvider` is mounted (Writers' Room route), set `active_area="script"` + `active_scene_id` when live session starts. Presence remains awareness-only; no text in presence payloads.

## Visual design

LiveCollabLabPanel: paper-tone card, Playfair Display title "Live Collaboration Lab", small amber "Experimental" pill, two-column layout — left = controls + participants + connection badge, right = conflicts panel. Mirrors `PresencePanel` styling. No flashy multiplayer chrome.

## Testing checklist (manual, 2 sessions)

- Flag off → no Live Lab tab, no scene-row link, editor unchanged.
- Flag on, non-member → tab hidden / access denied card.
- Owner + co_writer same scene → text edits propagate, caret stable, no remount.
- Both edit same block → second arrival lands in conflicts panel, no overwrite.
- Other user holds lock → Start blocked with `collab.live.errorLocked`.
- Kill network → badge "Disconnected", typing continues, autosave continues; restore → "Reconnected".
- Refresh → canonical content intact, no duplicate blocks.

## Deferred (documented in PR summary)

- `update_type`, `insert_block_after`, `delete_block`, `move_block` — structural ops require deeper editor coordination; not safe yet.
- Live cursors / selections.
- `live_scene_events` audit table — using ephemeral broadcast + sparse change_events instead.
- Snapshot-before-apply (Pass 5 already covers heavy mutations).
- Production rollout / default-on.

## Acceptance

Build passes (`bunx tsc --noEmit`), lint clean, editor acceptance test still passes with flag off AND with flag on solo, two-session smoke test shows safe text propagation + conflict hold.
