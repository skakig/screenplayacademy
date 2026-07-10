## Arena Mode v1 — Hardening Pass

Your comments are spot-on. The current Arena is a working prototype but it treats the client as authority in several places (winner selection, host checks, promotion race, entry edits, live vote reads). This pass moves authority into the database, closes the RLS gaps, and lands the restrained authorship system you described (thin rail + avatar + tint, not neon cards). Writer's Desk and canonical script tables are not touched.

---

### Migration 1 — Lifecycle, integrity, and privacy

Single migration, in order:

1. `**create_arena_session(project_id, title, mode, prompt, duration_seconds, submission_grace_seconds, judging_mode, entry_reveal)` RPC** — SECURITY DEFINER. Validates member + role, inserts session, inserts creator into `arena_participants` as `writer`, returns row. Both rows or neither.
2. **State-machine trigger** on `arena_sessions` BEFORE UPDATE — allows only: `draft→open|archived`, `open→running|archived`, `running→voting`, `voting→complete`, `complete→archived`. Rejects everything else with `ARENA: invalid transition`.
3. **Revoke direct lifecycle UPDATE** — RLS update policy on `arena_sessions` allows non-lifecycle metadata edits (title/prompt/duration) only while `status IN ('draft','open')` AND `status` unchanged. Status transitions must go through the existing `start_arena_round` / `advance_arena_round_if_due` / `end_arena_round` / `finalize_arena_round` RPCs.
4. **Partial unique index** on `arena_sessions(project_id) WHERE status IN ('open','running','voting')` — enforces one active round per project.
5. **Tighten `arena_entries` UPDATE RLS** — allow only when `OLD.status = 'draft'` AND parent session `status = 'running'` AND `author_id = auth.uid()`. Add trigger blocking changes to `session_id`, `project_id`, `author_id`, `status` (only exception: via RPC below).
6. `**submit_arena_entry(entry_id)` RPC** — verifies ownership, session running, `now() <= ends_at + submission_grace_seconds`, non-empty body, sets `status='submitted'`, `submitted_at=now()`. Idempotent-reject on already-submitted.
7. **Vote privacy** — replace `arena_votes` SELECT policy with two policies: (a) voter reads own rows always; (b) all members read all vote rows only when session `status = 'complete'`. Add `get_arena_voting_progress(session_id)` RPC returning `{eligible_voters, completed_voters, entries_with_votes, current_user_has_voted}` — no scores.
8. `**join_arena_session(session_id, role)` RPC** — enforces stage/role rules: writers only during `open`; judges per `judging_mode`; viewers cannot self-upgrade. Revoke direct INSERT on `arena_participants` (leave DELETE for leave).
9. `**award_arena_entry(session_id, entry_id, award_type, title)` RPC** — SECURITY DEFINER. Verifies caller is host (`session.created_by`) or project owner; session in `voting|complete`; entry belongs to session; derives `project_id` from session and `awarded_to` from entry author; inserts with ON CONFLICT DO NOTHING against `(session_id, entry_id, award_type)`.
10. `**promote_arena_entry(session_id, entry_id)` RPC** — verifies session complete, entry submitted, caller is host/owner/co_writer/editor. Writes `suggestions` row with provenance JSON `{source:'arena', arena_session_id, arena_entry_id, arena_award_type, original_author_id}`. Uniqueness enforced by partial unique index on `suggestions((provenance->>'arena_entry_id')) WHERE provenance->>'source' = 'arena'`. Returns existing row on conflict (idempotent).
11. **Update `finalize_arena_round**` — apply the new tie rules (avg total → Character Truth → Cinematic Value → co-winners) and insert one `studio_winner` award per co-winner.

All GRANTs on new RPCs: `authenticated`, `service_role`. All RPCs `SET search_path = public`.

---

### Client — `src/lib/arena.ts`

- `createArenaSession` → `rpc('create_arena_session', …)`.
- `joinArenaSession` → `rpc('join_arena_session', …)`.
- `submitEntry` → `rpc('submit_arena_entry', …)`.
- `awardArenaEntry` → `rpc('award_arena_entry', …)` (drop client-supplied `project_id`/`awarded_to`).
- `promoteEntryToSuggestion` → `rpc('promote_arena_entry', …)`.
- New `getVotingProgress(sessionId)`.
- New `resolveArenaWinner(sessionId)` → reads `arena_awards` where `award_type='studio_winner'`, returns entry rows (supports co-winners).
- New `getArenaParticipantIdentity(userId, projectId)` — resolves via `profiles` (display_name/full_name/email) with UUID never rendered as fallback ("Unknown writer" instead).
- New `assignAuthorColor(sessionId, userId)` — deterministic hash → 8-color muted palette (amber/teal/indigo/rose/emerald/violet/sky/orange) as CSS tokens.

---

### Client — UI corrections

- `**ResultsPanel.tsx**`: winner comes from `resolveArenaWinner` (DB), not `ranked[0]`. Support co-winner array. Fix `isHostOrOwner = uid === session.created_by || role === 'owner'`. Same fix in `RoundLobby.tsx` for start/end.
- `**VotingRoom.tsx**`: stop calling `listVotes` during `voting`. Use `getVotingProgress` + own-vote query. Full `listVotes` only when `status='complete'`.
- `**RoundStage.tsx**`: submission button calls `submit_arena_entry` RPC; show "Submission locked" state after `ends_at + grace`.
- `**CreateRoundDialog.tsx**`: catch unique-violation on active round → toast "This project already has an active Arena round."
- **New `AuthorshipRail.tsx**`: 3px left rail + avatar/initials chip + name + optional role, tint bg at 4% opacity. Used in entry cards, results, awards wall.
- **Blind mode**: when `session.entry_reveal='blind_until_results'` AND `status='voting'`, render neutral labels ("Entry A/B/C"), neutral gray rail, no name/avatar/color. Reveal after `complete`.
- `**AwardsWall.tsx`, `ResultsPanel.tsx`, `RoundLobby.tsx` participant list**: use `getArenaParticipantIdentity`, drop `user_id.slice(0,8)` displays.

---

### Tests

- **Extend `src/lib/arena.e2e.test.ts**` (in-memory) with: blind-mode reveal, co-winner path, promotion idempotency across two callers, host-not-owner permissions, active-round conflict.
- **New `src/lib/arena.rls.test.ts**` — real Supabase test file gated by `SUPABASE_TEST_URL` env (skipped otherwise). Seeds owner/host/writer/judge/viewer/non-member users and asserts every row in the Part 14 matrix.
- **New `src/lib/arena.authorship.test.ts**` — deterministic color hashing, blind-mode identity redaction, display-name resolution never returns a UUID.

---

### Guardrails preserved

- `VITE_COLLAB_ARENA_MODE` + `scenesmith.experimental.arena.enabled` double gate unchanged.
- Experimental badge unchanged.
- No edits to `ScreenplayDocumentEditor`, `useScreenplayDocument`, screenplay keymap/persistence, `scenes`, `script_blocks`, live cursors.
- Promotion writes only to `suggestions`.

---

### Technical section

```text
DB objects added:
  RPC  create_arena_session
  RPC  join_arena_session
  RPC  submit_arena_entry
  RPC  award_arena_entry            (replaces client insert)
  RPC  promote_arena_entry          (replaces client insert)
  RPC  get_arena_voting_progress
  TRG  arena_sessions_transition_check  BEFORE UPDATE
  TRG  arena_entries_immutable_fields   BEFORE UPDATE
  IDX  arena_sessions_one_active_per_project  UNIQUE partial
  IDX  suggestions_arena_entry_unique         UNIQUE partial

RLS changes:
  arena_sessions.UPDATE  → non-lifecycle only, draft|open only
  arena_entries.UPDATE   → own draft in running session only
  arena_votes.SELECT     → own during voting, all after complete
  arena_participants.INSERT → REVOKE; via join_arena_session RPC

Client color palette (CSS tokens in styles.css):
  --arena-author-1..8  muted amber/teal/indigo/rose/emerald/violet/sky/orange
```

---

### Rollout order

1. Migration (approval gate).
2. `arena.ts` RPC wiring + identity/color helpers.
3. UI: winner resolution, host check, blind mode, authorship rail.
4. VotingRoom privacy refactor.
5. Tests (extend in-memory, add RLS + authorship suites).
6. Manual smoke pass with flag on.

This is **very close to approval**. Lovable understood the audit and translated it into a serious hardening plan rather than patching buttons around the edges.

I would approve execution **after adding five corrections**.

**1. Fix the Suggestions provenance field**

The current Suggestions implementation uses:

metadata

not:

provenance

The proposed unique index says:

suggestions((provenance->>'arena_entry_id'))

WHERE provenance->>'source' = 'arena'

That appears inconsistent with the existing Arena promotion code, which stores Arena identifiers under metadata. The current implementation uses metadata.source, metadata.arena_session_id, and metadata.arena_entry_id.

Use the actual existing column:

CREATE UNIQUE INDEX suggestions_arena_entry_unique

ON public.suggestions ((metadata->>'arena_entry_id'))

WHERE metadata->>'source' = 'arena'

  AND metadata->>'arena_entry_id' IS NOT NULL;

Or add a dedicated nullable column:

arena_entry_id uuid

A dedicated column is stronger long-term, but the metadata index is acceptable for this pass.

**2. Blind voting must be enforced at the data layer**

The UI plan hides names and avatars, but if arena_[entries.author](http://entries.author)_id is still returned to every participant during voting, someone can inspect the browser network response and identify the writers.

So blind mode cannot be purely visual.

When:

entry_reveal = blind_until_results

status = voting

the client should receive sanitized entries through a secure RPC or view:

get_arena_voting_entries(session_id)

Return:

entry_id

title

body

anonymous_label

status

Do not return:

author_id

user_id

display_name

email

avatar_url

After completion, normal identity-bearing entry data can be loaded.

Otherwise it is “blind judging” with a transparent blindfold.

**3. Direct session updates need column-level enforcement**

RLS can determine whether a row may be updated, but it is not ideal for securely expressing:

“You may modify the title and prompt, but not status, creator, project, timer, or other protected fields.”

Add a BEFORE UPDATE trigger that compares OLD and NEW and rejects changes to protected fields outside approved RPC execution.

Protected fields should include:

id

project_id

created_by

status

starts_at

ends_at

created_at

Potentially also protect:

judging_mode

entry_reveal

stakes

submission_grace_seconds

after the round begins.

The transition trigger should validate legitimate RPC transitions, while the immutable-field trigger prevents metadata updates from becoming a side door.

**4. Identity resolution must not depend on inaccessible email data**

The plan says:

profiles → display_name/full_name/email

But application profile tables often do not contain the authenticated email, and normal clients generally cannot query auth.users.

Use this fallback order:

profiles.display_name

profiles.full_name

project member display data, if available

auth metadata for the current user only

"Unknown writer"

Do not promise email fallback unless the app already maintains a safe public/member-visible email field.

Also, fetch identities in batches:

getArenaParticipantIdentities(userIds, projectId)

Do not make one database request per participant or entry.

**5. Handle existing active rounds before creating the unique index**

Before adding:

UNIQUE(project_id)

WHERE status IN ('open','running','voting')

the migration must check whether existing data already contains more than one active session per project.

Since Arena is new, that is unlikely, but a robust migration should either:

- fail with a clear diagnostic, or
- archive all but the newest active session per project after deliberate review.

Do not let deployment fail with an unexplained unique-index violation.

&nbsp;

**Additional refinements**

**Make the RPC parameters typed**

Avoid accepting arbitrary text for enum values where possible. Use database enum parameters:

*mode public.arena*mode

*judging*mode public.arena_judging_mode

*entry*reveal public.arena_entry_reveal

*award*type public.arena_award_type

**Explicitly reject unauthenticated RPC calls**

Every SECURITY DEFINER RPC should begin with:

IF auth.uid() IS NULL THEN

  RAISE EXCEPTION 'ARENA: authentication required';

END IF;

Keep:

SET search_path = public

and revoke execution from PUBLIC and anon.

**Derive rather than accept trusted identifiers**

The RPCs should derive:

- project ID from session
- entry author from entry
- caller ID from auth.uid()
- participant project from session

Never accept those values from the browser when the database can resolve them.

**Make submission and draft saving consistent**

The plan secures final submission, but draft autosaving also needs server-time enforcement.

After:

ends_at + grace

both of these should fail:

- submitting
- continuing to alter the draft

The entry update trigger should perform the time check, not only the submission RPC.

**Prevent premature finalization**

Decide whether the host can finalize immediately after one vote.

For practice mode, that may be fine. For ranked/showcase, require either:

all eligible judges voted

or:

host explicitly confirms early finalization

At minimum, show:

3 of 5 judges have voted.

Finalize early?

**Author colors should be session-local**

The proposed hash should use:

session_id + user_id

That is correct.

It means a writer’s color is stable throughout one round but can differ across rounds, preventing the product from permanently labeling one user “the orange writer.”

&nbsp;

**Authorship design verdict**

The proposed system is exactly right:

- 3px rail
- initials/avatar
- name
- optional role
- 4% tint
- controlled palette
- anonymous neutral presentation during blind voting

I would add one more cue: a tiny authorship marker on quoted or promoted material:

From Arena · Dialogue Duel · Written by Maya

When promoted to Suggestions, preserve the same author identity and color reference in the suggestion card. That gives material a visible creative lineage without contaminating the canonical screenplay formatting.

**Final verdict**

With the five corrections above, this becomes a **proper hardening plan**, not just cleanup.

Lovable should proceed after updating:

1. provenance to the real metadata field
2. blind identity protection at the RPC/data layer
3. protected-column update trigger
4. batched, realistic identity resolution
5. migration preflight for duplicate active sessions

After that, Arena is ready for implementation and controlled two-account testing—still Experimental, but with a foundation strong enough to grow into ranked competitions and the eventual ScreenSmith awards ecosystem.This is **very close to approval**. Lovable understood the audit and translated it into a serious hardening plan rather than patching buttons around the edges.

I would approve execution **after adding five corrections**.

**1. Fix the Suggestions provenance field**

The current Suggestions implementation uses:

metadata

not:

provenance

The proposed unique index says:

suggestions((provenance->>'arena_entry_id'))

WHERE provenance->>'source' = 'arena'

That appears inconsistent with the existing Arena promotion code, which stores Arena identifiers under metadata. The current implementation uses metadata.source, metadata.arena_session_id, and metadata.arena_entry_id.

Use the actual existing column:

CREATE UNIQUE INDEX suggestions_arena_entry_unique

ON public.suggestions ((metadata->>'arena_entry_id'))

WHERE metadata->>'source' = 'arena'

  AND metadata->>'arena_entry_id' IS NOT NULL;

Or add a dedicated nullable column:

arena_entry_id uuid

A dedicated column is stronger long-term, but the metadata index is acceptable for this pass.

**2. Blind voting must be enforced at the data layer**

The UI plan hides names and avatars, but if arena_[entries.author](http://entries.author)_id is still returned to every participant during voting, someone can inspect the browser network response and identify the writers.

So blind mode cannot be purely visual.

When:

entry_reveal = blind_until_results

status = voting

the client should receive sanitized entries through a secure RPC or view:

get_arena_voting_entries(session_id)

Return:

entry_id

title

body

anonymous_label

status

Do not return:

author_id

user_id

display_name

email

avatar_url

After completion, normal identity-bearing entry data can be loaded.

Otherwise it is “blind judging” with a transparent blindfold.

**3. Direct session updates need column-level enforcement**

RLS can determine whether a row may be updated, but it is not ideal for securely expressing:

“You may modify the title and prompt, but not status, creator, project, timer, or other protected fields.”

Add a BEFORE UPDATE trigger that compares OLD and NEW and rejects changes to protected fields outside approved RPC execution.

Protected fields should include:

id

project_id

created_by

status

starts_at

ends_at

created_at

Potentially also protect:

judging_mode

entry_reveal

stakes

submission_grace_seconds

after the round begins.

The transition trigger should validate legitimate RPC transitions, while the immutable-field trigger prevents metadata updates from becoming a side door.

**4. Identity resolution must not depend on inaccessible email data**

The plan says:

profiles → display_name/full_name/email

But application profile tables often do not contain the authenticated email, and normal clients generally cannot query auth.users.

Use this fallback order:

profiles.display_name

profiles.full_name

project member display data, if available

auth metadata for the current user only

"Unknown writer"

Do not promise email fallback unless the app already maintains a safe public/member-visible email field.

Also, fetch identities in batches:

getArenaParticipantIdentities(userIds, projectId)

Do not make one database request per participant or entry.

**5. Handle existing active rounds before creating the unique index**

Before adding:

UNIQUE(project_id)

WHERE status IN ('open','running','voting')

the migration must check whether existing data already contains more than one active session per project.

Since Arena is new, that is unlikely, but a robust migration should either:

- fail with a clear diagnostic, or
- archive all but the newest active session per project after deliberate review.

Do not let deployment fail with an unexplained unique-index violation.

&nbsp;

**Additional refinements**

**Make the RPC parameters typed**

Avoid accepting arbitrary text for enum values where possible. Use database enum parameters:

*mode public.arena*mode

*judging*mode public.arena_judging_mode

*entry*reveal public.arena_entry_reveal

*award*type public.arena_award_type

**Explicitly reject unauthenticated RPC calls**

Every SECURITY DEFINER RPC should begin with:

IF auth.uid() IS NULL THEN

  RAISE EXCEPTION 'ARENA: authentication required';

END IF;

Keep:

SET search_path = public

and revoke execution from PUBLIC and anon.

**Derive rather than accept trusted identifiers**

The RPCs should derive:

- project ID from session
- entry author from entry
- caller ID from auth.uid()
- participant project from session

Never accept those values from the browser when the database can resolve them.

**Make submission and draft saving consistent**

The plan secures final submission, but draft autosaving also needs server-time enforcement.

After:

ends_at + grace

both of these should fail:

- submitting
- continuing to alter the draft

The entry update trigger should perform the time check, not only the submission RPC.

**Prevent premature finalization**

Decide whether the host can finalize immediately after one vote.

For practice mode, that may be fine. For ranked/showcase, require either:

all eligible judges voted

or:

host explicitly confirms early finalization

At minimum, show:

3 of 5 judges have voted.

Finalize early?

**Author colors should be session-local**

The proposed hash should use:

session_id + user_id

That is correct.

It means a writer’s color is stable throughout one round but can differ across rounds, preventing the product from permanently labeling one user “the orange writer.”

&nbsp;

**Authorship design verdict**

The proposed system is exactly right:

- 3px rail
- initials/avatar
- name
- optional role
- 4% tint
- controlled palette
- anonymous neutral presentation during blind voting

I would add one more cue: a tiny authorship marker on quoted or promoted material:

From Arena · Dialogue Duel · Written by Maya

When promoted to Suggestions, preserve the same author identity and color reference in the suggestion card. That gives material a visible creative lineage without contaminating the canonical screenplay formatting.

**Final verdict**

With the five corrections above, this becomes a **proper hardening plan**, not just cleanup.

Lovable should proceed after updating:

1. provenance to the real metadata field
2. blind identity protection at the RPC/data layer
3. protected-column update trigger
4. batched, realistic identity resolution
5. migration preflight for duplicate active sessions

After that, Arena is ready for implementation and controlled two-account testing—still Experimental, but with a foundation strong enough to grow into ranked competitions and the eventual ScreenSmith awards ecosystem.

Ready to execute on approval.