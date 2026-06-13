# collaboration.md — Writers' Room Collaboration Blueprint

## Product Name

The user-facing collaboration product is **Writers' Room**.

The internal sync, attribution, and version-protection layer is **ScriptSync**.

## Executive Standard

SceneSmith Studio should not copy Google Docs and slap screenplay margins on it.

Writers' Room must feel like a professional story room: writers can write, producers can give notes, collaborators can protect canon, and every change can be trusted. The product promise is simple:

> Collaborate like a room, protect the script like a vault.

Collaboration is not merely multiplayer typing. It is authorship, trust, roles, notes, assignments, drafts, approvals, scene locks, attribution, and eventually real-time presence.

## Current Repo Reality

This repo already establishes the correct foundation:

- `AGENTS.md` says the screenplay editor is the product.
- `docs/lovable/01_IMPLEMENTATION_ROADMAP.md` places Writers' Room after editor, project data, Script Brain, and draft revisions.
- `docs/lovable/04_WRITERS_ROOM_COLLAB.md` defines the early collaboration concept.
- `docs/lovable/11_DATABASE_AND_RLS.md` says project-owned data must be authorized through project ownership or membership.
- The editor architecture must remain **local-first**: user input goes to local state first, then background sync.

This file expands the collaboration spec into a buildable, market-grade workflow without violating the editor-first rule.

## The Non-Negotiable Rule

Do **not** build full live multiplayer editing until these foundations exist and pass acceptance tests:

1. Stable local-first screenplay editor.
2. Durable project data model.
3. Project membership and role-based authorization.
4. Comments and notes tied to project/scene/block records.
5. Draft snapshots and revision comparison.
6. Scene-level locks or claims.
7. Change attribution.
8. Conflict detection and safe recovery.

A broken multiplayer screenplay editor is worse than no collaboration. It creates mistrust, lost work, and rage-clicking — the unholy trinity.

## Market Bar

Writers' Room must compete with the best collaboration expectations users already have:

- **Google Docs expectation:** easy sharing, comments, suggestions, presence, and low-friction review.
- **Figma expectation:** visible collaborators, branch/restore confidence, contextual comments, ownership clarity.
- **WriterDuet expectation:** screenplay-native real-time collaboration, offline writing, autosave, revision history, and production-minded tooling.
- **Arc Studio expectation:** clean screenwriting UX with real-time co-writing, notes, and draft management.
- **Final Draft expectation:** industry-standard formatting, revision tracking, production readiness, and professional export trust.

SceneSmith's opportunity is to combine those expectations with screenplay-native structure, character intelligence, table reads, pitch packaging, and AI that behaves like an editor rather than a chaotic ghostwriter.

## Collaboration Maturity Ladder

Build collaboration as a ladder, not a cliff.

### Level 0 — Solo Writer Safety

The writer can write alone with no collaboration UI.

Required:

- local-first typing
- stable block IDs
- background save
- save status
- refresh persistence
- manual snapshots
- import rollback safety

This is the current priority.

### Level 1 — Share and Review

The owner can invite people to view or comment on the project.

Required:

- `project_members`
- invite flow
- roles: `owner`, `commenter`, `viewer`
- comments on project, scene, and block
- comment resolve/reopen
- notification-ready event log
- RLS membership checks

No co-writing yet.

### Level 2 — Asynchronous Co-Writing

The owner can allow selected collaborators to edit safely without true multiplayer typing.

Required:

- roles: `co_writer`, `editor`, `producer`
- permissions map
- scene assignment
- scene lock/claim
- draft snapshot before risky changes
- per-block `created_by`, `updated_by`, `last_edited_by_name`
- basic change feed
- conflict detection

This is the first meaningful paid collaboration tier.

### Level 3 — Review Mode and Suggestions

Collaborators can propose changes without altering the canonical script.

Required:

- suggestions table
- accept/reject flow
- suggested block edits
- suggested scene notes
- suggested character changes
- AI suggestions treated the same way as human suggestions
- snapshot before accepted batch changes

This is where Writers' Room becomes professional rather than merely shared.

### Level 4 — Presence and Soft Real-Time

Users can see who else is in the project and what scene they are viewing.

Required:

- presence channel
- collaborator avatars
- active scene indicator
- typing indicator at scene level, not character-level cursor yet
- last active timestamp
- no text merging through presence events

Presence should be delightful but non-invasive. It must not steal focus from the page.

### Level 5 — Live Scene Collaboration

Two or more users can edit the same scene in near real time.

Required:

- proven conflict strategy
- block-level revision event stream
- scene-scoped live editing session
- reconnect recovery
- offline queue reconciliation
- lock upgrade/downgrade behavior
- collaboration stress tests

Do this only after Levels 0–4 are boringly reliable.

### Level 6 — Full Writers' Room Operating System

This is the premium vision.

Required:

- project rooms
- staff roles
- assignments
- deadlines
- table read review sessions
- pitch deck review workflow
- season/episode room structure
- producer notes
- actor/table-read feedback
- AI room secretary summaries
- exportable change logs
- legal/authorship audit trail

## Roles

Use role names that match creative teams and make sense to non-technical users.

```text
owner
co_writer
editor
producer
commenter
viewer
actor_reader
assistant
```

### Role Meaning

| Role | Meaning | Default Trust Level |
| --- | --- | --- |
| `owner` | Project creator or transferred owner | Full control |
| `co_writer` | Can write script pages and story material | High |
| `editor` | Can revise, suggest, and comment; may edit if granted | Medium-high |
| `producer` | Can review, comment, export pitch materials if granted | Medium |
| `commenter` | Can add notes and reply to threads | Low-medium |
| `viewer` | Read-only access | Low |
| `actor_reader` | Can view assigned scenes/table-read scripts | Narrow |
| `assistant` | Can organize notes, summaries, and tasks; no script edits by default | Narrow |

## Permissions

Do not hardcode role checks across the UI. Centralize permission resolution.

Suggested permission keys:

```text
can_view_project
can_view_script
can_edit_script
can_edit_assigned_scenes
can_edit_characters
can_edit_world_lore
can_comment
can_resolve_comments
can_suggest_changes
can_accept_suggestions
can_invite
can_manage_members
can_manage_roles
can_lock_scenes
can_override_locks
can_create_snapshots
can_restore_snapshots
can_export_pdf
can_export_fountain
can_export_fdx_later
can_generate_pitch_deck
can_generate_table_read
can_run_ai
can_view_ai_outputs
can_manage_billing
can_delete_project
can_transfer_ownership
```

### Default Permission Matrix

| Permission | Owner | Co-writer | Editor | Producer | Commenter | Viewer | Actor Reader | Assistant |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| View project | yes | yes | yes | yes | yes | yes | limited | yes |
| View script | yes | yes | yes | yes | yes | yes | assigned | yes |
| Edit script | yes | yes | optional | no | no | no | no | no |
| Edit assigned scenes | yes | yes | optional | no | no | no | no | optional |
| Edit characters | yes | yes | optional | no | no | no | no | optional |
| Comment | yes | yes | yes | yes | yes | no | optional | yes |
| Suggest changes | yes | yes | yes | yes | yes | no | optional | yes |
| Accept suggestions | yes | yes | optional | no | no | no | no | no |
| Invite | yes | optional | no | optional | no | no | no | no |
| Manage members | yes | no | no | optional | no | no | no | no |
| Lock scenes | yes | yes | optional | no | no | no | no | no |
| Override locks | yes | no | optional | no | no | no | no | no |
| Export | yes | optional | optional | optional | no | no | no | no |
| Run AI | yes | optional | optional | optional | no | no | no | optional |
| Billing/delete/transfer | yes | no | no | no | no | no | no | no |

## Data Model

Use `project_members` as the center of collaboration authorization.

### `project_members`

```sql
create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer',
  status text not null default 'active',
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, user_id)
);
```

Status values:

```text
invited
active
suspended
left
removed
```

### `project_invites`

Use this when inviting people who may not yet have an account.

```sql
create table public.project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  email text not null,
  role text not null default 'viewer',
  token_hash text not null,
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Invite status values:

```text
pending
accepted
revoked
expired
```

### `comments`

Comments must attach to the smallest stable object possible.

```sql
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scene_id uuid references public.scenes(id) on delete cascade,
  script_block_id uuid references public.script_blocks(id) on delete cascade,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  status text not null default 'open',
  anchor_text text,
  anchor_offset_start integer,
  anchor_offset_end integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz
);
```

Comment status values:

```text
open
resolved
archived
```

### `scene_assignments`

```sql
create table public.scene_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scene_id uuid not null references public.scenes(id) on delete cascade,
  assignee_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  status text not null default 'assigned',
  due_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(scene_id, assignee_id)
);
```

### `scene_locks`

Scene locks are the safe bridge between solo writing and full multiplayer.

```sql
create table public.scene_locks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scene_id uuid not null references public.scenes(id) on delete cascade,
  locked_by uuid not null references auth.users(id) on delete cascade,
  lock_type text not null default 'soft',
  reason text,
  expires_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  unique(scene_id) where released_at is null
);
```

Lock types:

```text
soft      -- warns others, allows owner override
hard      -- prevents edit except owner/override role
session   -- temporary active editing claim
review    -- locked while owner reviews suggested changes
```

### `change_events`

Create a lightweight event log before building complex diffs.

```sql
create table public.change_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  summary text,
  before jsonb,
  after jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

Examples:

```text
script_block.created
script_block.updated
script_block.deleted
scene.locked
scene.unlocked
comment.created
comment.resolved
suggestion.accepted
snapshot.created
member.invited
member.role_changed
```

### `suggestions`

Human and AI suggestions should use the same approval model.

```sql
create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scene_id uuid references public.scenes(id) on delete cascade,
  script_block_id uuid references public.script_blocks(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  source text not null default 'human',
  suggestion_type text not null,
  status text not null default 'open',
  title text,
  rationale text,
  before jsonb,
  after jsonb not null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  rejected_by uuid references auth.users(id) on delete set null,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Source values:

```text
human
ai
import_diagnostic
script_brain
table_read
```

Suggestion types:

```text
replace_block_text
insert_block_after
delete_block
change_block_type
rewrite_scene
character_note
structure_note
continuity_fix
pitch_deck_note
```

## Existing Table Upgrades

When collaboration begins, extend existing tables carefully.

### `projects`

Add if missing:

```sql
visibility text not null default 'private'
collaboration_mode text not null default 'solo'
owner_id uuid generated or migrated from user_id
```

Keep `user_id` if current code depends on it. Do not break existing queries just to rename ownership.

### `script_blocks`

Add if missing:

```sql
created_by uuid references auth.users(id) on delete set null
updated_by uuid references auth.users(id) on delete set null
local_id text
revision integer not null default 1
```

Important:

- `local_id` is not the React key.
- The React key remains the stable local editor ID.
- `local_id` can help map offline-created blocks after sync.
- `revision` helps detect stale updates.

### `scenes`

Add if missing:

```sql
created_by uuid references auth.users(id) on delete set null
updated_by uuid references auth.users(id) on delete set null
assigned_to uuid references auth.users(id) on delete set null
revision integer not null default 1
```

## RLS Strategy

All project-owned tables must use membership-aware policies.

Create helper functions before writing repeated policies.

### Membership Helper

```sql
create or replace function public.is_project_member(_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = _project_id
      and pm.user_id = auth.uid()
      and pm.status = 'active'
  )
  or exists (
    select 1
    from public.projects p
    where p.id = _project_id
      and p.user_id = auth.uid()
  );
$$;
```

### Role Helper

```sql
create or replace function public.project_role(_project_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select pm.role
      from public.project_members pm
      where pm.project_id = _project_id
        and pm.user_id = auth.uid()
        and pm.status = 'active'
      limit 1
    ),
    (
      select case when p.user_id = auth.uid() then 'owner' end
      from public.projects p
      where p.id = _project_id
      limit 1
    )
  );
$$;
```

### Permission Helper

Start simple. Move to table-driven custom permissions later.

```sql
create or replace function public.can_edit_project(_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.project_role(_project_id) in ('owner', 'co_writer', 'editor');
$$;
```

Use this only as a first step. Long-term, permissions should be configurable per member.

## Collaboration UX Principles

### 1. The Page Remains Sacred

The writing page is never allowed to become a dashboard, notification center, or carnival midway.

Do:

- show small collaborator avatars in the top toolbar
- show scene lock status near the scene heading or side rail
- show comment pins subtly
- keep the caret stable
- keep typing instant

Do not:

- insert popups while typing
- steal focus for presence updates
- re-render the editor because a collaborator moved scenes
- auto-apply someone else's changes inside a dirty focused block

### 2. Collaboration Has Modes

Users should always know what mode they are in.

Suggested modes:

```text
Solo
Review
Co-write
Locked
Suggesting
Table Read Review
Pitch Review
```

Mode labels should be clear, human, and translated.

### 3. Nobody Accidentally Wrecks the Script

High-risk actions require protection:

- accepting a batch of suggestions
- restoring a snapshot
- replacing imported script content
- deleting a scene
- overwriting a locked scene
- changing someone's role
- removing a collaborator

Before high-risk changes, create a draft take automatically.

### 4. AI Is a Collaborator With a Leash

AI suggestions must be reviewable. AI must not directly overwrite canonical project content unless the user explicitly accepts the change.

AI output should include:

- source = `ai`
- created_by/requested_by
- context used
- rationale
- affected scene/block IDs
- confidence or severity when useful

## Core User Flows

### Flow A — Invite a Collaborator

1. Owner opens Writers' Room.
2. Owner clicks **Invite**.
3. Owner enters email.
4. Owner selects role.
5. UI shows role explanation and permissions summary.
6. Owner sends invite.
7. Invite email contains a secure token link.
8. Invitee accepts and joins project.
9. Member appears in Writers' Room member list.
10. `change_events` records the invite and acceptance.

Acceptance criteria:

- owner can invite by email
- invited email is normalized lowercase
- expired/revoked invites fail safely
- user cannot accept an invite for a different email unless owner allows it
- duplicate active member is not created
- RLS prevents outsiders from reading project data

### Flow B — Comment on a Script Block

1. Commenter selects or focuses a script block.
2. Commenter clicks **Add note** or uses a keyboard shortcut.
3. Comment is anchored to `script_block_id`.
4. Comment appears in the right rail and as a subtle marker on the page.
5. Owner/co-writer replies.
6. Authorized user resolves the thread.
7. Resolved thread remains available in history.

Acceptance criteria:

- comment creation never interrupts typing
- comment marker does not change screenplay formatting
- comment can survive block text changes
- deleting a block archives or preserves thread context safely
- resolved comments can be reopened

### Flow C — Assign a Scene

1. Owner opens Scene Board or Writers' Room.
2. Owner assigns Scene 12 to a co-writer.
3. Co-writer receives the assignment.
4. Scene shows assignee badge and status.
5. Co-writer locks/claims the scene while working.
6. Owner can review changes later.

Acceptance criteria:

- assigned user can see their assignments
- unassigned users cannot edit assigned-only scenes if policy says so
- overdue due dates are visible but not obnoxious
- assignments appear in the change feed

### Flow D — Lock a Scene

1. Co-writer opens a scene.
2. App asks or auto-claims a soft session lock.
3. Other collaborators see `Alex is working on this scene`.
4. If another user tries to edit, they can comment/suggest but not overwrite.
5. Lock expires or releases when user leaves/finishes.
6. Owner can override stale locks.

Acceptance criteria:

- lock acquisition is atomic
- stale locks expire
- owner override is logged
- lock failure has a calm UI message
- typing is never delayed while waiting for a lock on a scene already owned by the current user

### Flow E — Suggest a Change

1. Editor highlights a line or scene.
2. Editor chooses **Suggest change**.
3. Suggestion stores `before` and `after` payload.
4. Owner sees diff.
5. Owner accepts or rejects.
6. Accepted suggestion creates snapshot first, then applies change.
7. Rejected suggestion remains in history.

Acceptance criteria:

- suggestions do not alter canonical script until accepted
- accept/reject requires permission
- acceptance creates a `change_events` record
- AI suggestions use the same UI and data path

### Flow F — Review Draft Changes

1. Owner opens Draft History.
2. Owner filters changes by collaborator, scene, or date.
3. Owner compares current draft to previous snapshot.
4. Owner restores, branches, or exports.

Acceptance criteria:

- change history is understandable to humans
- actor names and scene headings make diffs readable
- restore creates a new snapshot before replacing content

## UI Surface Plan

### Writers' Room Panel

Primary location: project-level side panel or route.

Sections:

```text
Members
Invites
Assignments
Open Notes
Recent Changes
Project Rules
```

### Editor Surface

Small collaboration elements only:

- collaborator avatars in toolbar
- scene lock badge
- assigned writer badge
- comment markers
- right rail for open notes
- presence text: `Maya is viewing Act II`

### Scene Board Surface

Collaboration belongs naturally on scenes:

- assignee
- status
- due date
- notes count
- lock status
- last edited by

### Draft History Surface

Enhance existing Draft History with:

- collaborator filter
- change summaries
- snapshot labels
- restore protection
- accepted suggestion markers

## Technical Architecture

### Local-First Editing Remains the Core

Typing path remains:

```text
User input → local state → rendered page → background sync
```

Collaboration data should not invert this path.

For Levels 1–3, use database persistence and refetch/subscribe outside active typing.

For Levels 4–5, use realtime channels for presence and session state, but do not use realtime messages as the canonical text store.

### Recommended Realtime Split

Use realtime channels for ephemeral collaboration:

```text
presence: who is online, active scene, typing indicator
broadcast: cursor hints, scene claim pings, transient events
postgres changes: comments, locks, suggestions, membership updates
```

Canonical screenplay text remains in `script_blocks` with background sync and conflict protection.

### Conflict Strategy

Start with optimistic concurrency, not complex CRDTs.

For `script_blocks`, use:

- `revision` integer
- `updated_at`
- `updated_by`
- current local dirty state
- server snapshot before update

When saving:

1. Client sends current `serverId`, `revision`, and desired change.
2. Server accepts only if revision matches.
3. Server increments revision.
4. If revision does not match, client shows conflict UI.

Conflict UI options:

```text
Keep mine
Use theirs
Compare
Save mine as alternate take
Ask owner
```

Do not silently overwrite.

### Event Logging

Every meaningful collaboration action creates `change_events`.

Do not log every keystroke in Level 1–3. Log meaningful changes:

- block created/updated/deleted after debounce/save
- scene assignment changed
- comment created/resolved
- suggestion accepted/rejected
- snapshot created/restored
- member invited/removed/role changed

## Security and Privacy

### Invitation Safety

- Store token hashes, not raw tokens.
- Expire invites.
- Allow owner to revoke invites.
- Rate-limit invite sending.
- Do not reveal whether an email has an account.

### Project Access

- Every project-owned query must check membership.
- Every AI function must check membership before reading project content.
- Exports must check `can_export_*` permissions.
- Billing and ownership actions remain owner-only.

### Audit Trail

Maintain enough history to answer:

- Who wrote this?
- Who changed this?
- Who approved this?
- When did this happen?
- What did it look like before?

This is not paranoia. This is professional creative trust.

## AI Collaboration Rules

AI can assist collaboration by:

- summarizing open notes
- grouping conflicting feedback
- generating revision missions
- turning producer notes into actionable tasks
- comparing drafts
- checking character consistency after a collaborator's changes
- creating meeting summaries

AI must not:

- edit canonical script without acceptance
- impersonate a collaborator
- hide its source
- invent approvals
- bypass permissions
- train on private project data without explicit policy

## Internationalization

All collaboration UI must use translation keys.

Suggested key namespace:

```text
collab.room.title
collab.invite.button
collab.invite.emailLabel
collab.invite.roleLabel
collab.role.owner
collab.role.coWriter
collab.role.editor
collab.role.producer
collab.role.commenter
collab.role.viewer
collab.lock.sceneLocked
collab.lock.claimScene
collab.comment.add
collab.comment.resolve
collab.suggestion.accept
collab.suggestion.reject
collab.presence.viewingScene
collab.permissions.denied
```

Do not hardcode collaboration labels.

## Lovable Build Plan

### Pass 0 — Documentation Only

Create or update this file. Do not code collaboration yet if Stage 1 editor is still unstable.

### Pass 1 — Membership Foundation

Implement database migration only:

- `project_members`
- `project_invites`
- helper RLS functions
- update project-owned RLS policies carefully
- seed owner membership for existing projects

No collaboration UI yet except perhaps internal dev verification.

Acceptance tests:

- project owner remains able to read/write their projects
- non-member cannot read/write
- inserted active member can read project
- role helper returns expected role
- existing editor still works

### Pass 2 — Members and Invites UI

Implement Writers' Room member management:

- members list
- invite modal
- role selector
- revoke invite
- remove member
- change role

Acceptance tests:

- owner can invite
- non-owner cannot manage members
- role copy is clear
- all strings use i18n keys
- no editor behavior changes

### Pass 3 — Comments

Implement comments anchored to project, scene, and block.

Acceptance tests:

- commenter can comment but not edit script
- viewer cannot comment unless permission allows
- comments resolve/reopen
- comment markers do not affect screenplay layout
- typing remains stable

### Pass 4 — Assignments and Scene Locks

Implement scene assignments and locks.

Acceptance tests:

- co-writer can claim scene
- other collaborator sees lock
- owner can override stale lock
- lock conflict cannot corrupt content
- lock release is logged

### Pass 5 — Suggestions

Implement human suggestions first, then AI suggestions through the same path.

Acceptance tests:

- suggestions do not change canonical script until accepted
- owner can accept/reject
- accept creates snapshot first
- suggestion diff is readable
- rejected suggestions remain in history

### Pass 6 — Presence

Implement presence only after async collaboration is stable.

Acceptance tests:

- avatars show active collaborators
- active scene indicator works
- no focus loss
- no editor remount
- no active typing interruption

### Pass 7 — Live Scene Collaboration Experiment

Create a separate lab route or feature flag.

Do not ship to production editor until stress-tested.

Acceptance tests:

- two users edit separate blocks in same scene
- reconnect recovers state
- stale updates produce conflict UI
- no silent overwrites
- no duplicate blocks
- no caret jumps

## Feature Flags

Use feature flags to prevent accidental launch:

```text
collaboration_members_enabled
collaboration_comments_enabled
collaboration_assignments_enabled
collaboration_locks_enabled
collaboration_suggestions_enabled
collaboration_presence_enabled
collaboration_live_scene_editing_enabled
```

Default all to false except in dev/staging.

## Product Tiering

Suggested monetization:

### Free

- solo projects
- export limits
- no collaborators or maybe 1 viewer

### Writer

- private projects
- comments from invited reviewers
- limited snapshots

### Pro

- co-writers
- unlimited comments
- draft history
- suggestions
- scene assignments

### Studio

- larger teams
- role management
- producer review
- table-read review sessions
- pitch review workflow
- audit logs
- priority export and team billing

Do not block core writing behind collaboration complexity. The editor must remain excellent for solo writers.

## Definition of Done

Writers' Room is not done when avatars appear.

It is done when:

- the owner can control access
- collaborators understand their permissions
- comments and suggestions are anchored to the script
- scene locks prevent accidental overwrites
- all major changes are attributable
- revision history can recover mistakes
- AI suggestions require approval
- RLS protects private work
- typing remains fast and stable
- the UI feels like a professional creative room, not enterprise sludge

## Lovable Prompt

Use this prompt when asking Lovable to begin collaboration work:

```text
Read AGENTS.md, docs/lovable/01_IMPLEMENTATION_ROADMAP.md, docs/lovable/11_DATABASE_AND_RLS.md, docs/lovable/04_WRITERS_ROOM_COLLAB.md, and docs/lovable/collaboration.md.

Task: implement only the next smallest safe collaboration step. Do not build live multiplayer editing. Do not change the typing path. Do not touch editor key handling. Do not add collaboration UI inside the screenplay page except where explicitly requested.

Current goal: [INSERT PASS NUMBER AND NAME]

Requirements:
- preserve local-first editor behavior
- keep RLS membership-safe
- use i18n keys for all UI strings
- create migrations for new tables only when needed
- add calm error states
- add acceptance-test notes in the PR summary
- stop after the requested pass

Non-negotiable: the screenplay editor is the product. Collaboration must protect writing, not interrupt it.
```

## Final Product Vision

The best version of Writers' Room lets a creator run a real creative team from inside the script:

- Writers draft scenes.
- Editors suggest line changes.
- Producers give notes.
- Actors read assigned sides.
- AI summarizes feedback and detects story drift.
- Owners approve what becomes canon.
- Draft history protects every experiment.
- Pitch decks and table reads inherit approved project truth.

That is not just collaboration. That is a story operating system.
