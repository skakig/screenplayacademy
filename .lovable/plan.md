# Writers' Room — Pass 2: Members & Invites UI

Build the first visible collaboration surface. Backend tables/RLS from Pass 1 are assumed present. Editor files are off-limits.

## Placement

New route: `src/routes/_authenticated/writers-room.$projectId.tsx` → URL `/writers-room/:projectId`. Reached from the project header/nav (small "Writers' Room" link added to `src/components/ProjectNav.tsx`). Project-route pattern mirrors `editor.$projectId.tsx`, `pitch.$projectId.tsx`, etc. — smallest fit for the existing architecture.

## UI Composition

Single page wrapped in `AppShell`, max-width container, three stacked cards (paper-feel, subtle border, restrained shadow per `visualdesign.md`):

1. **Header** — "Writers' Room" title (Playfair), subtitle copy. Permission-denied state replaces the page body when `is_project_member` is false.
2. **Members card** — list of active `project_members` for this project.
3. **Pending Invites card** — owner-only; hidden for non-owners.
4. **Invite Collaborator** — primary button in Members card header → opens `InviteCollaboratorDialog` (shadcn Dialog).
5. **Project Access Rules** — small read-only panel listing what's enabled vs. not enabled yet.

No collaboration UI is added inside `editor.$projectId.tsx` or any `src/components/editor/**` file.

## New Files

- `src/routes/_authenticated/writers-room.$projectId.tsx` — route + page shell, permission gate, data loading, layout.
- `src/components/writers-room/MembersList.tsx` — renders members, row actions.
- `src/components/writers-room/InvitesList.tsx` — renders pending invites, revoke action.
- `src/components/writers-room/InviteCollaboratorDialog.tsx` — invite form (Dialog + form + role select).
- `src/components/writers-room/RoleSelect.tsx` — shared shadcn Select with labels + descriptions; accepts an `excludeOwner` prop.
- `src/components/writers-room/AccessRulesPanel.tsx` — static "what's enabled" panel.
- `src/components/writers-room/roles.ts` — single source of truth: `ROLES`, labels, descriptions, ordered list, helpers (`roleLabel`, `roleDescription`).
- `src/lib/collab.ts` — data-access helpers (small wrappers over `supabase.from(...)`); colocates query keys.

## Edits to Existing Files

- `src/components/ProjectNav.tsx` — add a "Writers' Room" link (only if file already builds nav for a project context; otherwise add link from `dashboard.tsx`/`projects.tsx` project cards). No structural rework.
- `src/lib/i18n/keys.ts` — add the `collab.*` keys listed in the request (room/members/invites/invite form/roles/permissions/access-rules). Existing `t()` helper covers it.

Nothing under `src/components/editor/**`, `src/routes/_authenticated/editor.$projectId.tsx`, or `src/hooks/use*` is touched.

## Data Access

Uses the existing pattern: `@tanstack/react-query` + `supabase` client (matches `projects.tsx`). No new architecture.

Query keys:

- `["wr","members", projectId]` → `select * from project_members where project_id = … order by role,created_at`. Joined display name/email comes from a left join to `profiles` (id, full_name, avatar_url, email) — already exists.
- `["wr","invites", projectId]` → `select * from project_invites where project_id = … and status = 'pending' order by created_at desc`. RLS already restricts this to the owner; non-owner reads return `[]` and we render the empty/owner-only path accordingly.
- `["wr","role", projectId]` → `supabase.rpc("project_role", { _project_id })` to drive UI gating (`owner` / `co_writer` / etc. / null).
- `["wr","canView", projectId]` → `supabase.rpc("is_project_member", …)` for the permission-denied page state.

Mutations (all RLS-protected on the server, so failures surface as toast errors regardless of client gating):

- **Create invite** — `insert into project_invites { project_id, email: email.toLowerCase().trim(), role, token_hash, invited_by: auth.uid(), expires_at: now()+7d, status: 'pending' }`. Token generated client-side via `crypto.getRandomValues` → URL-safe base64 (32 bytes), hashed with `crypto.subtle.digest("SHA-256", …)` → hex. Raw token is shown once in the success state with a copy-to-clipboard ("Send this invite link" — actual email delivery deferred), then discarded. Only the hash is persisted.
- **Revoke invite** — `update project_invites set status='revoked' where id=…`. Confirm dialog.
- **Change role** — `update project_members set role=… where id=…`. Confirm dialog for high-impact moves (anything to/from `editor`/`co_writer`). Owner row is read-only — owner transfer is explicitly deferred.
- **Remove member** — `delete from project_members where id=…`. Confirm dialog. Owner row's remove button is disabled with tooltip "Owner cannot be removed yet — ownership transfer arrives in a later pass."

## Validation

`src/components/writers-room/InviteCollaboratorDialog.tsx` uses zod:

```ts
const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  role: z.enum(['co_writer','editor','producer','commenter','viewer','actor_reader','assistant']),
});
```

`owner` is excluded from the invite role enum. Client errors → inline form messages; server errors → sonner `toast.error`.

## Permission Gating (UI layer; RLS is authoritative)

Driven by `project_role` RPC result:

- `null` → render full-page "You don't have access to this Writers' Room" state with a link back to dashboard.
- `'owner'` → all actions visible.
- anything else → Members list visible (read-only), invites card hidden, no action buttons, access-rules panel visible.

Last-owner protection: client checks `members.filter(m => m.role === 'owner').length`; remove/role-change buttons on the only owner are disabled with tooltip. Server-side enforcement of last-owner is out of scope for Pass 2 (no role-change to/from owner is exposed in the UI at all).

## Role Labels & Descriptions (single source)

`src/components/writers-room/roles.ts` exports:

```ts
export const ROLE_ORDER = ['owner','co_writer','editor','producer','commenter','viewer','actor_reader','assistant'] as const;
export const INVITABLE_ROLES = ROLE_ORDER.filter(r => r !== 'owner');
```

Labels and descriptions are looked up via `t('collab.role.<camel>')` + `t('collab.role.<camel>.desc')` keys added to `keys.ts`.

## UI States Covered

- Loading skeleton rows (members + invites cards).
- Empty members ("Just you in the room so far.").
- Empty invites ("No pending invites.").
- Permission denied (full-page calm message).
- Mutation success → sonner `toast.success`; invite success additionally surfaces the one-time invite link with copy button inside the dialog.
- Mutation error → sonner `toast.error(message)`.
- Confirm destructive actions via shadcn `AlertDialog`.

## Visual Design

Per `visualdesign.md`:

- Warm paper background on cards (`bg-card` token already maps to warm paper in light; midnight surface in dark).
- Playfair Display for the "Writers' Room" title; Inter body.
- Subtle 1px borders, small shadow, generous whitespace.
- Role badges use muted/secondary tones — no neon role colors.
- Copy avoids SaaS jargon: "Invite collaborators into your Writers' Room. Control who can write, review, comment, or simply read."

## Acceptance Verification

- Manually walk: open `/writers-room/:projectId` as owner → see self in Members, no invites; create an invite → appears in Pending Invites; revoke it → row disappears; remove member confirmation flow exists; owner row protected.
- Read `src/components/editor/**` git status: must be unchanged. Read `editor.$projectId.tsx`: must be unchanged.
- Build runs automatically; verify no errors.

## Files Changed Summary

New: 7 files (1 route + 6 components/utilities).
Edited: 2 files (`ProjectNav.tsx`, `i18n/keys.ts`).
Untouched: editor, screenplay typing, block rendering, autosave, formatter — all guard files.

Stop after Pass 2. No comments, locks, suggestions, presence, or live editing.
