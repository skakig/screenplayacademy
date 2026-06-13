# Pass 6 — Presence Indicators

Adds project-scoped presence awareness to Writers' Room using Supabase Realtime presence. No DB tables for heartbeats. No editor changes. No live cursors or text sync.

## Architecture

- **Channel:** `project-presence:{projectId}` via `supabase.channel(..., { config: { presence: { key: userId } } })`.
- **Access gate:** subscribe only after `project_role(_project_id)` resolves to a non-null role. Non-members never join.
- **Cleanup:** untrack + `removeChannel` on unmount, route change, sign-out, or permission loss.
- **State boundary:** presence lives in its own hook/context, completely separate from editor state. Editor files are not touched.

## Presence Payload

```ts
type ProjectPresenceState = {
  user_id: string;
  display_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  project_id: string;
  active_area: "script" | "writers_room" | "comments" | "assignments"
             | "suggestions" | "pitch" | "settings" | "unknown";
  active_scene_id?: string | null;
  active_scene_label?: string | null;   // e.g. "Scene 12" — never raw UUID
  is_typing_scene_id?: string | null;
  last_active_at: string;               // ISO
};
```

No script text, no selection, no AI/prompt data.

## New Files

- `src/lib/presence/types.ts` — `ProjectPresenceState`, area enum, helpers.
- `src/lib/presence/usePresenceChannel.ts` — core hook: gates on role, subscribes, tracks self, exposes `peers`, `setActiveArea`, `setActiveScene(id, label)`, `pingTyping(sceneId)`. Throttles updates (~1.5s), debounces typing-clear (~7s), clears typing on scene change/unmount.
- `src/lib/presence/PresenceProvider.tsx` — React context wrapping the hook so multiple UI surfaces share one channel per project.
- `src/components/writers-room/presence/PresenceAvatarStack.tsx` — small overlapping avatar stack (max ~5 + "+N"), tooltip/hover card per peer (name, role badge, active area label, last active relative time).
- `src/components/writers-room/presence/PresenceAvatar.tsx` — single avatar with subtle online status dot.
- `src/components/writers-room/presence/PresencePanel.tsx` — "In the Room" panel for the Writers' Room header area with subtitle copy from spec and empty state.
- `src/components/writers-room/presence/ActiveAreaLabel.tsx` — i18n label for `active_area` (+ scene label when present).
- `src/components/writers-room/presence/ScenePresenceBadge.tsx` — optional "Maya is viewing this scene" / "Alex is editing this scene" badge used in the Production Board scene row.
- `src/lib/presence/displayName.ts` — name fallback chain: display_name → email → `t("collab.presence.collaborator")`. Never UUIDs.

## Edited Files

- `src/routes/_authenticated/writers-room.$projectId.tsx` — wrap body in `PresenceProvider`; render `PresencePanel` above tabs; call `setActiveArea("writers_room")` and switch to `"comments" | "assignments" | "suggestions"` based on active tab via a small effect.
- `src/components/writers-room/board/ProductionBoardPanel.tsx` — pass scene id/label into `ScenePresenceBadge` per row (read-only; no row remounts on presence change — memoized).
- `src/components/writers-room/board/SceneRow.tsx` — render `ScenePresenceBadge` next to lock badge.
- `src/components/ProjectNav.tsx` — render small `PresenceAvatarStack` on the right side of the project top bar (only when a presence context is mounted; degrade silently when not).
- `src/lib/i18n/keys.ts` — add all `collab.presence.*` keys from spec.

## Editor Safety

- Editor files (`src/components/editor/**`, `src/routes/_authenticated/editor.$projectId.tsx`) are not modified in this pass. The avatar stack in `ProjectNav` is presence-context-aware and only renders when a `PresenceProvider` is mounted above it — i.e. on the Writers' Room route. The editor route is unchanged, so no remount risk, no key changes, no keystroke broadcasting.
- A follow-up pass can add an editor-route `PresenceProvider` once we are confident; deferred here to keep this pass minimal and safe.

## Scene-Level Features

- **Active scene tracking:** implemented at the Production Board level (we already have scene ids + ordinal labels there). The board calls `setActiveScene` on row hover/focus only inside the board context; deferred for the editor surface.
- **Typing indicator:** deferred. The editor is not yet wrapped in `PresenceProvider`, and we will not touch keystroke paths. Scene presence shows "viewing" only this pass.

## Last-Seen

- Lightweight `update_my_project_last_seen(project_id uuid)` RPC (security definer), called once on channel subscribe and on unmount. Updates only the caller's row when `status = 'active'`. No table changes — uses existing `project_members.last_seen_at`.
- Migration: create the RPC + `GRANT EXECUTE ... TO authenticated`. No new tables, no RLS changes to existing ones.

## RLS / Security

- Presence channel is ephemeral; access gated client-side by `project_role` check before `subscribe()`. Non-members never receive a tracked payload.
- `update_my_project_last_seen` is the only DB write; hard-scoped to `auth.uid()` and active membership.
- Removed/suspended members are excluded by the membership check before subscribe; on permission loss the hook untracks and removes the channel.
- Pending invitees (no `project_members` row) cannot subscribe.

## i18n Keys (added to `src/lib/i18n/keys.ts`)

`collab.presence.title`, `.subtitle`, `.onlineNow`, `.noOneOnline`, `.inWritersRoom`, `.viewingScript`, `.viewingScene`, `.reviewingComments`, `.reviewingSuggestions`, `.viewingAssignments`, `.inSettings`, `.unknownArea`, `.typingInScene`, `.workingNearby`, `.you`, `.lastSeen`, `.connectionLost`, `.collaborator`.

## Visual Design

- Small overlapping circular avatars (28px) with 2px surface ring, soft online dot in accent color.
- Hover card: warm off-white surface in light mode / midnight surface in dark, subtle border, name + role chip + active area line + relative last-active. Playfair display for the panel title, Inter for body. Matches existing Writers' Room cards.
- "In the Room" panel: muted card with title, subtitle, avatar stack, empty state copy from spec. No flashing, no loud colors.

## What This Pass Does NOT Do

- No live cursors, no text sync, no multiplayer editing.
- No keystroke broadcasting.
- No editor file changes.
- No `change_events` writes for presence.
- No presence in the screenplay editor route (deferred).
- No typing indicator (deferred).
- No per-keystroke realtime events.

## Acceptance Checks

- Two browser sessions on the same project see each other's avatars in the Writers' Room.
- Switching tabs (Notes / Board / Suggestions) updates the active area label for peers.
- Hovering scene rows on the board shows "viewing this scene" for the other session.
- Leaving the route removes the avatar for peers within a few seconds.
- Non-member loading the route sees the existing access-denied card; no presence subscription happens.
- Editor route + typing flow unchanged. `bunx tsc --noEmit` clean.
