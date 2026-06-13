# Writers' Room — Pass 1: Membership Foundation

Backend-only foundation. No collaboration UI. No changes to the screenplay editor, typing flow, keymap, or block rendering.

## Scope

- Two new tables: `project_members`, `project_invites`.
- Three new SECURITY DEFINER helpers: `is_project_member`, `project_role`, `can_edit_project`.
- RLS policies for the two new tables.
- Idempotent backfill of an `active` `owner` row in `project_members` for every existing `projects.user_id`.
- Optional small TypeScript permission helper file mirroring the SQL helpers.
- Existing `projects` ownership policy stays untouched. `owns_project()` stays untouched. No other table policies are rewritten.

## Out of Scope (explicitly deferred)

Invites UI/flow, comments, scene assignments, scene locks, suggestions, change_events, presence, realtime, role-change UI, editor changes.

## Migration 1 — `project_members`

Single migration containing CREATE TABLE → GRANT → ENABLE RLS → POLICIES → trigger → indexes.

Columns: `id`, `project_id` (FK projects, ON DELETE CASCADE), `user_id` (FK auth.users, ON DELETE CASCADE), `role text not null default 'viewer'`, `status text not null default 'active'`, `invited_by` (FK auth.users, ON DELETE SET NULL), `joined_at timestamptz`, `last_seen_at timestamptz`, `created_at`, `updated_at`, `UNIQUE(project_id, user_id)`.

CHECK constraints restrict values to the documented role set (`owner, co_writer, editor, producer, commenter, viewer, actor_reader, assistant`) and status set (`invited, active, suspended, left, removed`).

Indexes on `project_id`, `user_id`, `(project_id, status)`.

GRANT `SELECT, INSERT, UPDATE, DELETE` to `authenticated`; `ALL` to `service_role`. No `anon`.

Trigger `update_updated_at_column` on update.

## Migration 2 — `project_invites`

Same four-step structure.

Columns: `id`, `project_id` (cascade), `email text not null` (stored lowercased via trigger or `lower()` default), `role text not null default 'viewer'`, `token_hash text not null` (raw tokens never stored), `invited_by` (FK auth.users, NOT NULL, cascade), `status text not null default 'pending'`, `expires_at timestamptz not null`, `accepted_by` (FK auth.users, ON DELETE SET NULL), `accepted_at timestamptz`, `created_at`, `updated_at`.

CHECK constraints for role set and invite status set (`pending, accepted, revoked, expired`).

Index on `(project_id, status)`, unique on `token_hash`.

GRANT same as above. No `anon`.

## Migration 3 — Helpers + Policies + Backfill

Single migration that:

1. Creates SECURITY DEFINER, STABLE helpers in `public`:

   - `is_project_member(_project_id uuid) returns boolean` — true if `auth.uid()` owns the project (via `projects.user_id`) OR has a `project_members` row with `status='active'`.
   - `project_role(_project_id uuid) returns text` — returns `'owner'` for the owner; else the `role` from the active `project_members` row; else NULL.
   - `can_edit_project(_project_id uuid) returns boolean` — true for owner; true for active members whose role is in (`co_writer`, `editor`). (Producer/commenter/viewer/etc. excluded from edit by default; matches Pass-1 default permission matrix.)

   All three: `LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public`.

2. Adds RLS policies on the two new tables (kept minimal and owner-centric for Pass 1):

   **`project_members`**
   - `SELECT`: project owner OR the row's own `user_id = auth.uid()`.
   - `INSERT` / `UPDATE` / `DELETE`: project owner only (`public.owns_project(project_id)`).

   **`project_invites`**
   - `SELECT`: project owner only.
   - `INSERT` / `UPDATE` / `DELETE`: project owner only.
   - (Invitee-side acceptance flow is deferred to a later pass.)

3. Idempotent owner backfill:

   ```sql
   INSERT INTO public.project_members (project_id, user_id, role, status, joined_at)
   SELECT p.id, p.user_id, 'owner', 'active', now()
   FROM public.projects p
   ON CONFLICT (project_id, user_id) DO NOTHING;
   ```

   Safe to re-run.

## Why no edit to existing policies

The existing `projects` policy is `auth.uid() = user_id`. Owners keep full access through ownership. Membership-based access for non-owners on existing tables (scenes, script_blocks, characters, etc.) is intentionally deferred — Pass 1 only proves membership can be recognized. Touching those policies now would risk the editor and break the "no editor behavior changes" guardrail.

## TypeScript helpers (small, additive)

New file: `src/lib/permissions.ts` exporting thin wrappers that call the SQL helpers via `supabase.rpc(...)`:

- `getProjectRole(projectId)` → calls `project_role`.
- `canViewProject(projectId)` → calls `is_project_member`.
- `canEditProject(projectId)` → calls `can_edit_project`.
- `canManageProjectMembers(projectId)` → owner check via existing `owns_project` RPC.

Not wired into any UI. No imports added elsewhere. Pure scaffolding for later passes.

`src/integrations/supabase/types.ts` regenerates automatically after migrations run — no manual edit.

## Verification Plan

- Confirm no files under `src/components/editor/**`, `src/routes/_authenticated/editor.*`, or `src/hooks/use*Editor*` are modified.
- After migrations: `supabase--read_query` to confirm every existing project has exactly one `('owner','active')` row, and re-running the backfill SQL produces zero new rows.
- App build runs automatically; check that build/lint pass.
- Spot-check: owner can still SELECT their project (RLS unchanged on `projects`); a second user cannot SELECT rows from `project_members` for a project they don't own and aren't in.

## Files Changed

- `supabase/migrations/<ts>_project_members.sql` (new)
- `supabase/migrations/<ts>_project_invites.sql` (new)
- `supabase/migrations/<ts>_collab_helpers_and_backfill.sql` (new)
- `src/lib/permissions.ts` (new, additive, unused by UI)
- `src/integrations/supabase/types.ts` (auto-regenerated)

Stop after Pass 1.
