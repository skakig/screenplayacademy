## Pass 8 — QA & Hardening for Writers' Room

Five focused changes. No edits to the screenplay editor typing path, keys, formatting, or keymap. No live cursors. No screenplay-content broadcast. No editor bridge wired in this pass — Live Lab stays coordination-only and the copy will say so.

---

### 1. Double-gated feature flag (`src/lib/featureFlags.ts`)

Keep the build-time env gate, add a per-browser local switch on top.

- `isLiveSceneCollabAvailable()` — reads `VITE_COLLAB_LIVE_SCENE_EDITING` (current behavior).
- `isLiveSceneCollabUserEnabled()` — reads `localStorage["scenesmith.experimental.liveCollab.enabled"] === "1"`, guarded with `typeof window !== "undefined"` (false during SSR).
- `setLiveSceneCollabUserEnabled(enabled)` — writes the key, dispatches a `window` CustomEvent `scenesmith:experimental-flags-changed` so listeners refresh without a reload.
- `isLiveSceneCollabEnabled()` — `available && userEnabled` (replaces current env-only impl; all existing call sites keep working).
- `useLiveSceneCollabEnabled()` React hook — subscribes to the custom event + `storage` event, returns the current effective value. Used by Writers' Room to re-render the tab.

Defaults: both gates false. Off-by-default preserved.

### 2. In-app Experimental Features card

New component `src/components/writers-room/ExperimentalFeaturesCard.tsx`, rendered inside the existing **Access** tab in `writers-room.$projectId.tsx` (below `AccessRulesPanel`). Visible to project members only (route is already member-gated).

- If env gate off: small muted note "Live Collaboration Lab is disabled for this build."
- If env gate on: shadcn `Switch` (`src/components/ui/switch.tsx`), label "Live Collaboration Lab", description matching the spec ("Turn on experimental scene-scoped co-writing tools for this browser. This does not enable production live co-writing. It only exposes the testing lab."), bound to `setLiveSceneCollabUserEnabled`.

No DB writes. Per-browser only.

### 3. Live tab visibility + graceful teardown

In `writers-room.$projectId.tsx`:

- Replace `isLiveSceneCollabEnabled()` call with `useLiveSceneCollabEnabled()` so toggling refreshes the tab list immediately.
- When the hook flips from true → false while the user is on the Live tab: switch active tab back to "Access", show a sonner toast ("Live Collaboration Lab disabled. Your normal writing flow is unchanged.").
- Session teardown: `LiveCollabLabPanel` unmounts when the tab disappears, which already triggers `useLiveSceneSession`'s cleanup (channel unsubscribe + presence leave). Add an explicit `useEffect` cleanup check in `LiveCollabLabPanel` that calls `session.leave()` on unmount if `session.active`, so an in-progress session is left cleanly rather than just dropped.

### 4. Honest Live Lab copy

In `LiveCollabLabPanel.tsx` and i18n keys:

- Subtitle changes to: "Live Collaboration Lab is currently a scene-session coordination test. Real co-editing is not connected to the Writer's Desk yet."
- Remove/avoid any "Co-write in real time" phrasing in panel and i18n.
- Keep the existing "experimental" badge.

No editor bridge work in this pass (deferred — would require safe integration with `useScreenplayDocument`, dirty/focused-block guards, real query keys, two-browser verification; out of scope).

### 5. Real `/accept-invite` route

Approach: SECURITY DEFINER RPC + thin client route, so token hashing + member upsert + invite update happen atomically server-side under the caller's `auth.uid()`.

**Migration** (`supabase/migrations/<ts>_accept_invite_rpc.sql`):

```sql
create or replace function public.accept_project_invite(_token text)
returns table(project_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_hash text;
  v_invite public.project_invites%rowtype;
begin
  if v_uid is null then
    return query select null::uuid, 'unauthenticated'::text; return;
  end if;
  v_hash := encode(digest(_token, 'sha256'), 'hex');
  select * into v_invite from public.project_invites
    where token_hash = v_hash limit 1;
  if not found then
    return query select null::uuid, 'invalid'::text; return;
  end if;
  if v_invite.status <> 'pending' then
    return query select v_invite.project_id, v_invite.status; return;
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    update public.project_invites set status='expired' where id=v_invite.id;
    return query select v_invite.project_id, 'expired'::text; return;
  end if;
  if lower(v_invite.email) <> v_email then
    return query select v_invite.project_id, 'email_mismatch'::text; return;
  end if;

  insert into public.project_members
    (project_id, user_id, role, status, invited_by, joined_at)
  values
    (v_invite.project_id, v_uid, v_invite.role, 'active', v_invite.invited_by, now())
  on conflict (project_id, user_id) do update
    set role = excluded.role, status = 'active', joined_at = coalesce(public.project_members.joined_at, now());

  update public.project_invites
     set status='accepted', accepted_by=v_uid, accepted_at=now()
   where id=v_invite.id;

  return query select v_invite.project_id, 'accepted'::text;
end $$;

revoke execute on function public.accept_project_invite(text) from public, anon;
grant  execute on function public.accept_project_invite(text) to authenticated;
```

(Relies on the existing `pgcrypto` `digest()` — already used elsewhere; falls back to a JS hash + parameter if the linter flags it.)

**Route** `src/routes/_authenticated/accept-invite.tsx`:

- Lives under `_authenticated/` so the auth gate redirects unauthenticated users to `/auth` and back (using existing `redirect` query support if present, otherwise a sessionStorage stash of the token before redirect).
- Reads `?token=` via `Route.useSearch()` with a Zod validator.
- Calls `supabase.rpc("accept_project_invite", { _token })`.
- Maps status → calm UI:
  - `accepted` / already-active: redirect to `/writers-room/$projectId`.
  - `email_mismatch`: explain the invite was sent to a different email; offer sign-out.
  - `expired` / `revoked` / `invalid`: friendly message + link to dashboard.
- Uses `Card`/`Button` and existing brand tokens. New i18n keys under `collab.invite.accept.*`.

`buildInviteUrl` already produces `/accept-invite?token=...` — no change.

### Acceptance & verification

- Typecheck after edits (no manual build, harness handles it).
- Manual flow: toggle switch off → Live tab disappears, active session leaves; toggle on → tab reappears. Generate invite → open link in second session → membership added, redirect to Writers' Room.

### Deferred

- Real editor bridge from live session into `useScreenplayDocument` (explicitly out of scope; copy now reflects this).
- Cross-email invite acceptance / owner override.
- Server-issued invite emails.

### Files

- edit `src/lib/featureFlags.ts`
- new  `src/components/writers-room/ExperimentalFeaturesCard.tsx`
- edit `src/routes/_authenticated/writers-room.$projectId.tsx`
- edit `src/components/writers-room/live/LiveCollabLabPanel.tsx`
- edit `src/lib/i18n/keys.ts`
- new  `src/routes/_authenticated/accept-invite.tsx`
- new  migration `supabase/migrations/<ts>_accept_invite_rpc.sql`
