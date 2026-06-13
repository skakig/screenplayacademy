# Writers' Room — Pass 3: Comments & Review Notes

Add the review layer. No editor changes, no suggestions, no locks, no presence, no live editing. Block-level comments are **deferred** for now per the "don't touch the editor" guardrail; project- and scene-level anchors ship in this pass and the schema already supports script_block_id for a later pass.

## Database

No existing `comments` table — new table per the blueprint, plus the four indexed lookups we actually use. Single migration, CREATE → GRANT → ENABLE RLS → POLICIES → trigger → indexes.

```sql
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES public.scenes(id) ON DELETE CASCADE,
  script_block_id UUID REFERENCES public.script_blocks(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','resolved','archived')),
  anchor_text TEXT,
  anchor_offset_start INTEGER,
  anchor_offset_end INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ
);
```

Grants: `SELECT/INSERT/UPDATE/DELETE` to `authenticated`, `ALL` to `service_role`, no `anon`. `updated_at` trigger. Indexes on `project_id`, `scene_id`, `script_block_id`, `parent_comment_id`, `author_id`, `status`, `created_at`.

### Permission helpers (security definer)

Two new helpers — declarative and reusable from RLS and app code:

- `public.can_comment_on_project(_project_id uuid)` → owner OR active member whose role ∈ (`co_writer`,`editor`,`producer`,`commenter`,`assistant`). Viewer/actor_reader excluded.
- `public.can_resolve_project_comments(_project_id uuid)` → owner OR active member whose role ∈ (`co_writer`,`editor`,`producer`).

Both `STABLE SECURITY DEFINER SET search_path = public`; `EXECUTE` revoked from `anon`, granted to `authenticated, service_role` (matches the Pass-1 pattern).

### RLS policies on `comments`

- **SELECT** — `public.is_project_member(project_id)` (owners + active members of any role).
- **INSERT** — `public.can_comment_on_project(project_id) AND author_id = auth.uid()`.
- **UPDATE** — `author_id = auth.uid()` (author can edit their own) OR `public.can_resolve_project_comments(project_id)` (owner / co_writer / editor / producer can resolve/reopen/edit status).
- **DELETE** — `public.owns_project(project_id)` only. UI never wires hard-delete; archival is via `status='archived'` (PATCH).

`change_events` table doesn't exist yet — logging is intentionally deferred per the spec's "do not block Pass 3" clause. A comment in the data-access layer flags the call sites where event inserts should be added once that table lands.

## Permission helper layer (TS)

New: `src/components/writers-room/permissions.ts`

```ts
const COMMENTERS: ProjectRole[] = ['owner','co_writer','editor','producer','commenter','assistant'];
const RESOLVERS:  ProjectRole[] = ['owner','co_writer','editor','producer'];
const ARCHIVERS:  ProjectRole[] = ['owner'];

export const canViewComments    = (role: ProjectRole | null) => role !== null;
export const canCreateComment   = (role: ProjectRole | null) => !!role && COMMENTERS.includes(role);
export const canResolveComment  = (role: ProjectRole | null) => !!role && RESOLVERS.includes(role);
export const canArchiveComment  = (role: ProjectRole | null) => !!role && ARCHIVERS.includes(role);
```

`actor_reader` and `viewer` cannot comment. Centralised — components never inline role checks.

## Data access layer

New: `src/lib/comments.ts` — wraps `supabase.from("comments")`. Query keys:

- `["comments","project", projectId, "open"]` — `select * where project_id=… and status='open' order by created_at desc`.
- `["comments","project", projectId, "resolved"]` — same with `status='resolved'`. Loaded lazily when the resolved tab is opened.

`fetchScene(sceneId)` is reused for the scene-anchor label (single lookup, cached by scene id) — small wrapper over an existing select.

Mutations: `createComment`, `createReply` (sets `parent_comment_id`), `setCommentStatus(id, 'open'|'resolved'|'archived')`, `updateCommentBody`. All invalidate the open + resolved keys for the project.

## UI

### Placement — inside Writers' Room, as a tab

The Writers' Room page (`/writers-room/:projectId`) gains a `Tabs` component with two tabs:

1. **Team** — existing Members + Pending Invites + Access Rules (everything from Pass 2).
2. **Review Notes** — new comments surface.

This avoids editor changes entirely. The page is already the home of collaboration; a "Review Notes" rail in the editor route would touch fragile files and is explicitly deferred to a later optimisation.

### New components (`src/components/writers-room/comments/`)

- `ReviewNotesPanel.tsx` — top-level: title, subtitle, "Add note" composer (anchor selector: Project / Scene), two collapsible sections "Open notes" + "Resolved notes" (lazy-loaded), permission-aware empty/denied states.
- `CommentThread.tsx` — top-level card: author, role badge, timestamp, anchor label, body, reply count, status pill, action buttons (Reply, Resolve/Reopen). Replies rendered inline in chronological order. Resolving a top-level comment keeps replies visible; the card moves to "Resolved notes".
- `CommentCard.tsx` — single comment row used for both root + replies.
- `CommentComposer.tsx` — textarea + anchor selector (radio: Project / Scene `<select>`) + submit/cancel + zod validation (`body.trim().min(1).max(5000)`). Used for both new comments and replies (reply form hides the anchor selector and reuses parent anchor).
- `AnchorLabel.tsx` — formats `"Project note"`, `"Scene note: INT. DINER – NIGHT"`, falls back to `"Scene note"` when title is empty. Never exposes UUIDs.
- `useProjectComments.ts` — `useQuery` hooks returning open/resolved arrays and a derived count.

Scene picker: small `select` listing scenes (`select id, title, scene_heading from scenes where project_id=… order by created_at`) so a reviewer can attach a note to a specific scene without ever opening the editor.

### Visual

Per `visualdesign.md` — warm card surfaces (`bg-card/60`), Playfair section heads, generous whitespace, muted status pills (`open` = subtle ring, `resolved` = ghost), restrained icons (`MessageSquare`, `CornerDownRight`, `CheckCircle2`, `RotateCcw`). No badges with red dots, no enterprise spam. Empty state copy: "No notes yet. Invite your collaborators to leave thoughtful feedback when the draft is ready."

### States covered

- Loading skeleton (3 rows).
- Empty open / empty resolved.
- Permission denied (non-member): the existing page-level gate from Pass 2 already covers it.
- Cannot-comment but can-view (viewer/actor_reader): composer hidden, notes shown read-only.
- Cannot-resolve but author of the comment: edit-own + status buttons hidden, only the author's own edit action surfaces.
- Mutation success → sonner toast; mutation error → sonner toast with message.

## i18n

Add the `collab.comments.*` key bundle from the spec to `src/lib/i18n/keys.ts`. All visible strings flow through `t()`.

## Editor safety

- Zero edits under `src/components/editor/**`.
- Zero edits to `src/routes/_authenticated/editor.$projectId.tsx`.
- Zero edits to `src/hooks/use-autosave.ts`, parser, formatter, persistence, keymap.
- Block-level (`script_block_id`) anchors are supported in the schema but not exposed in UI this pass — adding a per-block button requires touching `ScreenplayLine.tsx`, which the guardrails forbid. A clear comment in `comments.ts` notes that `createComment` already accepts `script_block_id` for the next pass.

## Files

**Migration (1)**
- `supabase/migrations/<ts>_comments.sql` — table + grants + RLS + two helper functions + indexes + trigger.

**New TS (8)**
- `src/lib/comments.ts`
- `src/components/writers-room/permissions.ts`
- `src/components/writers-room/comments/ReviewNotesPanel.tsx`
- `src/components/writers-room/comments/CommentThread.tsx`
- `src/components/writers-room/comments/CommentCard.tsx`
- `src/components/writers-room/comments/CommentComposer.tsx`
- `src/components/writers-room/comments/AnchorLabel.tsx`
- `src/components/writers-room/comments/useProjectComments.ts`

**Edited (2)**
- `src/routes/_authenticated/writers-room.$projectId.tsx` — wrap existing content in shadcn `Tabs` (Team / Review Notes). All Pass-2 UI stays in the Team tab. Total head-count count chip on the Review Notes tab trigger when count > 0.
- `src/lib/i18n/keys.ts` — add `collab.comments.*` keys.

`src/integrations/supabase/types.ts` regenerates automatically.

## Verification

- Run the migration (review + approval flow).
- After regen, exercise the page as the project owner: add project note, add scene note (pick a scene), reply, resolve, reopen, switch tabs to see counts. Confirm permission-denied path renders for a non-member.
- `git diff --stat src/components/editor src/hooks/use-autosave* src/routes/_authenticated/editor.\$projectId.tsx` must be empty.

## Out of scope

- Block-level comment UI.
- `change_events` table (deferred — comments mark the future insertion points).
- Email/in-app notifications.
- AI-authored comments / summaries.
- Suggestions, locks, presence, live editing.

Stop after Pass 3.
