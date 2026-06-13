# Writers' Room — Pass 4: Scene Assignments & Scene Locks

Add the "who owns this scene right now?" layer. Everything lives inside Writers' Room. No editor changes, no presence, no live cursors, no suggestions. Editor-level lock enforcement is **deferred** (rationale below).

## Database — single migration

Two new tables + helpers. CREATE → GRANT → ENABLE RLS → POLICIES → trigger → indexes per house style.

### `scene_assignments`

```sql
CREATE TABLE public.scene_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scene_id UUID NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
  assignee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned','in_progress','ready_for_review','approved','blocked','unassigned')),
  due_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scene_id, assignee_id)
);
```

Indexes: `project_id`, `scene_id`, `assignee_id`, `status`, `due_at`. `updated_at` trigger.

A scene can be assigned to multiple collaborators (the `UNIQUE(scene_id, assignee_id)` matches the blueprint and lets you have, say, a writer + an editor on the same scene with different statuses). "Clear assignment" deletes the row; "Unassigned" status is reserved for soft hand-back.

### `scene_locks`

```sql
CREATE TABLE public.scene_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scene_id UUID NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
  locked_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lock_type TEXT NOT NULL DEFAULT 'soft'
    CHECK (lock_type IN ('soft','hard','session','review')),
  reason TEXT,
  expires_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX scene_locks_one_active_per_scene
  ON public.scene_locks (scene_id) WHERE released_at IS NULL;
```

Indexes: `project_id`, `scene_id`, `locked_by`, `released_at`, `expires_at`. Released locks stay in history.

### Permission helpers (security definer)

- `public.can_manage_scene_assignments(_project_id)` → owner OR active member ∈ (`co_writer`,`editor`,`producer`).
- `public.can_claim_scene(_project_id)` → owner OR active member ∈ (`co_writer`,`editor`).
- `public.can_override_scene_lock(_project_id)` → owner OR active member ∈ (`editor`).

All `STABLE SECURITY DEFINER SET search_path = public`. `EXECUTE` revoked from `anon`, granted to `authenticated, service_role` (matches Pass 1/3 baseline; the same expected `0028/0029` warnings will surface and are inherent).

### RLS

`scene_assignments`:
- SELECT — `is_project_member(project_id)`.
- INSERT — `can_manage_scene_assignments(project_id) AND assigned_by = auth.uid()` AND assignee must be an active project member (enforced via subquery in WITH CHECK).
- UPDATE — `can_manage_scene_assignments(project_id)`.
- DELETE — `can_manage_scene_assignments(project_id)`.

`scene_locks`:
- SELECT — `is_project_member(project_id)`.
- INSERT — `can_claim_scene(project_id) AND locked_by = auth.uid()`.
- UPDATE — `locked_by = auth.uid()` OR `can_override_scene_lock(project_id)`. (UI only ever PATCHes `released_at`; we don't expose lock body editing.)
- DELETE — none (no policy). Locks are never hard-deleted; release sets `released_at`.

The `UNIQUE` partial index gives us atomic "only one active lock per scene" semantics — a second claim hits a 23505 violation we translate into "already locked" in the client.

## TS permission helpers

Extend `src/components/writers-room/permissions.ts`:

```ts
const ASSIGN_MANAGERS: ProjectRole[] = ['owner','co_writer','editor','producer'];
const CLAIMERS:        ProjectRole[] = ['owner','co_writer','editor'];
const LOCK_OVERRIDERS: ProjectRole[] = ['owner','editor'];

canViewSceneAssignments(role)       // any member
canManageSceneAssignments(role)
canClaimScene(role)
canReleaseOwnSceneLock(role)        // any claimer-eligible role
canOverrideSceneLock(role)
canEditLockedScene(role, lock, userId)  // true when no active lock OR lock.locked_by === userId
```

UI never inlines a role list.

## Data access

New `src/lib/assignments.ts`:

- `fetchSceneAssignments(projectId)` — joined to scenes for ordering; returns assignment rows + scene meta.
- `fetchActiveLocks(projectId)` — `released_at IS NULL`, returns lock rows.
- `fetchActiveProjectMembers(projectId)` — small wrapper used by the assignee picker; reuses the same `project_members` select pattern as Pass 2.
- `assignScene({ projectId, sceneId, assigneeId, status, dueAt?, note? })` — upserts on `(scene_id, assignee_id)`.
- `updateAssignment(id, patch)`, `clearAssignment(id)`.
- `claimScene({ projectId, sceneId, expiresInMinutes = 30 })` — inserts a lock with `lock_type='session'`; surfaces a friendly error when the partial unique index trips.
- `releaseLock(lockId)` — patches `released_at = now()`. The RLS policy decides whether the caller is the original locker (own release) or an override.
- `overrideLock(lockId, reason)` — same patch + `reason` text; RLS gates on `can_override_scene_lock`.

Query keys under `["wr","assignments",projectId]`, `["wr","locks",projectId]`, `["wr","activeMembers",projectId]`. All mutations invalidate the relevant keys; toasts via sonner.

`change_events` still doesn't exist — TODO markers placed at the five event sites (`scene_assignment.{created,updated,cleared}`, `scene_lock.{created,released,overridden,expired_detected}`).

## UI

### Placement — third tab inside Writers' Room

`Tabs`: **Team** (Pass 2) · **Review Notes** (Pass 3) · **Production Board** (new).

No edits to the editor route. No edits to `scenes.$projectId.tsx` (Scene Board) — adding a column there would risk touching unrelated state; scope stays in Writers' Room for this pass.

### New components (`src/components/writers-room/board/`)

- `ProductionBoardPanel.tsx` — header copy ("Give each scene a clear steward."), permission-gated empty/error/denied states, list of `SceneRow`s ordered by scene `order_index`.
- `SceneRow.tsx` — one row per scene. Shows scene heading (or `Scene {n}`), current assignees as chips (each with status badge), lock status badge, due-date badge if set, and an action menu:
  - **Assign / Change assignee** (owner + assign-managers) → `AssignSceneDialog`.
  - **Status** select inline (assign-managers).
  - **Clear assignment** (assign-managers) → `AlertDialog` confirm.
  - **Claim scene / Release / Override** (per-role).
- `AssignSceneDialog.tsx` — pick assignee from `fetchActiveProjectMembers`, status default `assigned`, optional due date (shadcn `Calendar` in a `Popover`), optional note (`Textarea`, 500 chars). Client validation: assignee must be present and an active member.
- `AssignmentStatusSelect.tsx` — shadcn `Select` with `roleLabel`-style i18n labels for the six statuses.
- `LockStatusBadge.tsx` — derives one of `Unlocked` / `Locked by you` / `Locked by Member abcdef` / `Lock expired` from the lock + current user id. Subtle ring, no traffic-light colors.
- `LockActions.tsx` — small inline buttons: Claim / Release / Override. Override is gated to `canOverrideSceneLock` and opens an `AlertDialog` explaining whose lock will be released; the confirm posts with `reason='owner_override'` (or `editor_override`).
- `useProductionBoard.ts` — combines the three queries (scenes, assignments, locks) and folds them into `Array<{ scene, assignments[], activeLock|null }>`, also exposing `isLoading` / `isError`.

### Stale lock handling

`activeLock` is decorated client-side with `isStale = expires_at && new Date(expires_at) < new Date()`. UI:

- Stale lock → badge reads `Lock expired`.
- Owner/editor → Override action available, button text "Clear expired lock".
- Anyone else → button disabled with tooltip "Ask an editor to clear the expired lock." We do **not** auto-release on client claim; release happens explicitly through `releaseLock` / `overrideLock` so the audit trail in `released_at` is honest.

### Editor enforcement — deferred (with rationale documented)

The editor route renders blocks directly out of `useScreenplayDocument` with a single autosave-debounce path. Adding a "scene locked by another user → make blocks non-editable" gate would require:

1. resolving the active lock for every visible block's `scene_id` inside the editor render path,
2. flipping `contentEditable` per block live as locks change,
3. preventing keymap mutations for locked scenes.

That work crosses the explicit guardrail "Do not change editor keyboard behavior / block key handling / local-first state". The plan therefore ships **indicators only** for Pass 4 (visible in Writers' Room) and a documented next step: an editor-side enforcement pass that can be done in isolation once the lock model is proven. This matches the spec's escape hatch:

> if enforcement cannot be safely added without editor refactor, add lock indicators and document enforcement as a required next step.

### Visual

Warm `bg-card/60` paper cards, Playfair section heads, restrained badges (assignments = secondary, locks = outline, expired = outline + dashed border, "locked by you" = primary-toned ring), generous spacing, no notification reds. Studio copy:

- "Production Board"
- "Give each scene a clear steward."
- "Scene locks protect active work before live co-writing arrives. A lock does not mean ownership forever — it tells the room someone is working here right now."

### Safety dialogs

- Override another user's lock → `AlertDialog` naming the locker and noting it's recorded.
- Clear assignment → `AlertDialog` ("This removes the assignment but doesn't delete the scene.").
- Claim that hits unique-index conflict → toast "Already claimed by another collaborator. Refreshing." + invalidate locks query.

## i18n

Append the `collab.assignments.*`, `collab.assignmentStatus.*`, `collab.locks.*`, `collab.tabs.board` keys from the spec to `src/lib/i18n/keys.ts`. All visible strings flow through `t()`.

## Files

**Migration (1)**
- `supabase/migrations/<ts>_scene_assignments_and_locks.sql` — both tables + grants + RLS + three helper functions + indexes + trigger.

**New TS (8)**
- `src/lib/assignments.ts`
- `src/components/writers-room/board/ProductionBoardPanel.tsx`
- `src/components/writers-room/board/SceneRow.tsx`
- `src/components/writers-room/board/AssignSceneDialog.tsx`
- `src/components/writers-room/board/AssignmentStatusSelect.tsx`
- `src/components/writers-room/board/LockStatusBadge.tsx`
- `src/components/writers-room/board/LockActions.tsx`
- `src/components/writers-room/board/useProductionBoard.ts`

**Edited (3)**
- `src/components/writers-room/permissions.ts` — add the five new helpers.
- `src/routes/_authenticated/writers-room.$projectId.tsx` — add third `Tabs` trigger + content.
- `src/lib/i18n/keys.ts` — add the new key set; move "Scene locks" out of `collab.accessRules.upcoming` into `enabled`.
- `src/components/writers-room/AccessRulesPanel.tsx` — reflect the move.

`src/integrations/supabase/types.ts` regenerates automatically.

## Verification

- After migration approval, exercise as owner: assign a scene to self, change status, clear it. Claim a scene, see "Locked by you", release. Manually expire (`update scene_locks set expires_at = now() - interval '1 hour'`) to see "Lock expired" + override flow.
- Confirm a viewer-role user sees the board read-only with disabled actions.
- `git diff --stat src/components/editor src/hooks/use-autosave* src/routes/_authenticated/editor.\$projectId.tsx src/routes/_authenticated/scenes.\$projectId.tsx` must be empty — editor + Scene Board untouched.

## Out of scope

- Editor-side lock enforcement (deferred — see rationale above).
- Heartbeat / auto-extend of locks.
- Scene Board column changes.
- Presence, live cursors, suggestions, real-time merging.
- `change_events` table (deferred — TODOs flagged).
- Per-assignee notifications.

Stop after Pass 4.
