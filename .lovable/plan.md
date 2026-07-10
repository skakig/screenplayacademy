# Arena Mode v1 — Timed Creative Writing Games for Writers' Room

## Vision

Arena Mode turns collaboration into a screenwriter's sport. Instead of fragile multiplayer typing on canonical script, collaborators enter timed rounds, submit competing entries, vote, and promote winners into Suggestions. Safe by construction — canonical screenplay is never mutated by Arena.

Three-layer collaboration model this fits into:

1. **Vault** — canonical writing (existing)
2. **Live Room** — trusted co-writing (existing lab)
3. **Arena** — timed creative games (this pass)

## Guardrails (Non-Negotiable)

- Writer's Desk editor is not touched.
- No canonical script mutation. Arena entries live in Arena tables only.
- No live cursor / live block sync required — each writer drafts independently.
- Promotion to script is always via Suggestions, never direct insert.
- Double-gated feature flag (env + per-browser switch), same pattern as Live Collab Lab.

## Feature Flag

Add to `src/lib/featureFlags.ts`:

- Env gate: `VITE_COLLAB_ARENA_MODE`
- localStorage key: `scenesmith.experimental.arena.enabled`
- Helpers: `isArenaAvailable()`, `isArenaUserEnabled()`, `setArenaUserEnabled()`, `isArenaEnabled()`, `useArenaEnabled()`
- Surface the switch in `ExperimentalFeaturesCard.tsx` under a second toggle row.

## Data Model (Migration)

Five new tables, all in `public`, all with RLS + explicit GRANTs to `authenticated` and `service_role`.

### `arena_sessions`

`id, project_id, created_by, title, mode, prompt, status, duration_seconds, starts_at, ends_at, created_at, updated_at`

- `mode`: `dialogue_duel | rewrite_relay | scene_rescue | adlib_character | comedy_punchup | villain_monologue | pitch_blitz | freewrite`
- `status`: `draft | open | running | voting | complete | archived`

### `arena_participants`

`id, session_id, project_id, user_id, role, joined_at`

- `role`: `writer | judge | viewer | host`
- Unique `(session_id, user_id)`

### `arena_entries`

`id, session_id, project_id, author_id, title, body, status, submitted_at, created_at, updated_at`

- `status`: `draft | submitted | withdrawn | winner`

### `arena_votes`

`id, session_id, entry_id, voter_id, score_originality, score_character_truth, score_cinematic_value, score_emotional_impact, score_craft, comment, created_at`

- Unique `(session_id, entry_id, voter_id)`
- CHECK each score 1–5

### `arena_awards`

`id, session_id, project_id, entry_id, awarded_to, award_type, title, created_at`

- `award_type`: `best_line | best_dialogue | best_twist | best_character_truth | funniest | most_cinematic | audience_choice | studio_winner`

### RLS Policies

Reuse existing security-definer helpers: `is_project_member`, `can_edit_project`, `project_role`, `owns_project`.

- **SELECT** (all Arena tables): `is_project_member(project_id)`
- **INSERT session**: `project_role(project_id) IN ('owner','co_writer','editor','producer','assistant')`
- **UPDATE/DELETE session**: creator OR `owns_project(project_id)` (host/owner controls lifecycle)
- **INSERT participant**: self-join if member and role allowed (`owner,co_writer,editor,producer,commenter,assistant,actor_reader`)
- **INSERT entry**: `author_id = auth.uid()` AND member is a participant with `role='writer'` AND session `status='running'`
- **UPDATE entry**: author only, only while `status='draft'` and session `status='running'`
- **INSERT vote**: `voter_id = auth.uid()`, session `status='voting'`, cannot vote on own entry
- **INSERT award**: only session host or project owner, session `status IN ('voting','complete')`

## Server Functions

New file `src/lib/arena.functions.ts` (all `.middleware([requireSupabaseAuth])`):

- `createArenaSession({ projectId, mode, title, prompt, durationSeconds })`
- `joinArenaSession({ sessionId, role })`
- `startArenaRound({ sessionId })` — sets `status=running`, `starts_at=now()`, `ends_at=now()+duration`
- `saveArenaEntryDraft({ sessionId, entryId?, title, body })`
- `submitArenaEntry({ entryId })`
- `endArenaRound({ sessionId })` — flips to `voting` (server-computed; also allowed after `ends_at`)
- `castArenaVote({ sessionId, entryId, scores, comment? })`
- `finalizeArenaRound({ sessionId })` — computes winner from vote totals, marks entry `status=winner`, session `complete`
- `awardArenaEntry({ sessionId, entryId, awardType, title })`
- `promoteArenaEntryToSuggestion({ sessionId, entryId, suggestionType })` — inserts a row into existing `suggestions` table with `source='human'`, `metadata={ source:'arena', arena_session_id, arena_entry_id }`. No script mutation.
- `listArenaSessions({ projectId, status? })`
- `getArenaSession({ sessionId })` — returns session + participants + entries + vote tallies + awards

Realtime is out of scope for v1 — poll session state every 3s while the round is running or in voting; use TanStack Query invalidation on writes.

## UI

New Writers' Room tab **Arena**, gated by `useArenaEnabled()`, mounted in `writers-room.$projectId.tsx` next to Live.

Files under `src/components/writers-room/arena/`:

- `ArenaPanel.tsx` — root, holds sub-sections
- `ActiveArenaCard.tsx` — currently open/running round with countdown
- `CreateRoundDialog.tsx` — mode select, title, prompt textarea, duration presets (3/5/7/10/15 min)
- `RoundLobby.tsx` — participants list, join button, host "Start Round" control
- `RoundStage.tsx` — countdown timer, prompt, `EntryComposer`, submit lock
- `EntryComposer.tsx` — autosaving draft (debounced), submit button
- `VotingRoom.tsx` — list of submitted entries (author names shown; anonymous voting deferred), 5 score sliders, comment
- `AwardsWall.tsx` — past winners and awards for the project
- `PromoteToSuggestionDialog.tsx` — host/editor promotes an entry

Cinematic copy per spec: "The Arena", "Start Round", "The Clock Is Running", "Submit Scene", "Voting Room", "Awards Wall", "Best Line", "Studio Winner". All strings go through `t()` keys (`arena.*`) per i18n rule; add to `src/lib/i18n/keys.ts` and coverage test.

Visual style follows `visualdesign.md` — reuse Card/Tabs/Button/Slider primitives, no new gaming chrome, keep the existing amber "Experimental" badge treatment for the tab label.

## Tests

- `arena.functions.test.ts` (Vitest) — lifecycle: create → join → start → submit → vote → finalize → award → promote; guard rails (vote on own entry rejected, non-writer submit rejected, script untouched).
- RLS test in the same style as `write-tools.rls.test.ts` for member/non-member reads and role gating.
- `keys.test.ts` extended for `arena.*` keys.

Absolutely. I would **not** replace Lovable’s plan—I would append this as an **Architecture Review Addendum** so it enhances the implementation without invalidating the work already planned.

&nbsp;

**Architecture Review Addendum (Required Before Implementation)**

Before implementing Arena Mode v1, update the design with the following architectural improvements. These changes are intended to improve data integrity, scalability, and long-term maintainability without changing the overall product vision.

**1. Atomic Server Lifecycle (Required)**

Several Arena operations change multiple database records and must execute atomically.

Move these lifecycle transitions into PostgreSQL RPCs (or equivalent transactional server procedures):

- start_arena_round
- advance_arena_round_if_due
- finalize_arena_round
- promote_arena_entry
- award_arena_entry

TanStack server functions should call these RPCs instead of manually performing multiple sequential database updates.

No lifecycle transition should leave the database in a partially completed state.

&nbsp;

**2. Explicit State Machine**

Arena sessions must enforce valid lifecycle transitions.

Allowed:

draft → open

open → running

running → voting

voting → complete

draft/open/complete → archived

Disallow:

complete → running

voting → draft

archived → running

Enforce these transitions server-side.

&nbsp;

**3. Timer Advancement**

Polling every few seconds should refresh UI only.

Polling must **not** be the authority that changes session state.

Required behavior:

- Before ends_at, only the host may manually end the writing period.
- Once ends_at has passed, any participant may trigger an idempotent advance_arena_round_if_due() transition.
- Multiple callers must never create duplicate transitions.

&nbsp;

**4. One Entry Per Writer**

Arena v1 should enforce:

UNIQUE(session_id, author_id)

Each participant has one entry.

Future game modes may intentionally support multiple submissions.

&nbsp;

**5. Session / Project Integrity**

Child tables currently contain both:

- session_id
- project_id

The database must guarantee they always match.

Do not trust client input.

Use one of:

- composite foreign keys
- validation trigger
- generated value

Likewise ensure:

arena_votes.entry_id

always belongs to the same session referenced by:

arena_votes.session_id

&nbsp;

**6. Host Model**

Do not overload participant roles.

Recommended model:

Arena Session:

created_by = session host

Arena Participant:

role =

writer

judge

viewer

Host authority comes from the session itself.

A host may also participate as a writer.

Automatically insert the host as a participant when the session is created.

&nbsp;

**7. Voting Rules**

Voting permissions must be explicit.

Recommended:

- writers may vote on other entries
- judges may vote
- viewers may not vote
- host authority is independent of voting authority

Disallow self-voting.

Allow vote edits only while:

session.status = voting

Freeze all votes once the round is finalized.

&nbsp;

**8. Hidden Vote Totals**

Do not reveal running vote totals.

During voting show only:

- who has voted
- remaining voters
- voting progress

Reveal scores only after finalization.

This reduces bandwagon bias.

&nbsp;

**9. Tie Resolution**

Define deterministic tie rules.

Recommended:

Primary:

Average score

Tie-break 1:

Character Truth

Tie-break 2:

Cinematic Value

Final tie:

Co-Winners

Do not use submission time as a tie breaker.

&nbsp;

**10. Rules / Constraints Engine**

Arena rounds should support optional creative constraints.

Add:

rules jsonb

Example:

{

  "max_words": 500,

  "required_line": "You knew the whole time.",

  "tone": "dark comedy",

  "required_character": "Mara",

  "dialogue_only": true

}

Arena should become a creative challenge platform, not just a timed textarea.

&nbsp;

**11. Submission Grace Period**

When the timer expires:

Do not immediately reject the final autosave.

Recommended:

submission_grace_seconds = 10

After that:

- drafts become locked
- submitted entries remain valid
- unsubmitted drafts are excluded

&nbsp;

**12. Separate Lifecycle From Awards**

Do not overload:

entry.status = winner

Recommended:

Entry lifecycle:

draft

submitted

withdrawn

Awards determine winners:

studio_winner

best_dialogue

best_twist

audience_choice

...

This allows one entry to receive multiple awards.

&nbsp;

**13. Idempotent Promotion**

Promotion into Suggestions must be repeat-safe.

Store metadata:

arena_session_id

arena_entry_id

arena_award_type

original_author_id

Prevent duplicate Suggestions from repeated button presses.

&nbsp;

**Recommended Additional Fields**

Arena Session

judging_mode

entry_reveal

stakes

Allowed values:

judging_mode

&nbsp;

peer

host

panel

hybrid

entry_reveal

&nbsp;

named

blind_until_results

stakes

&nbsp;

practice

ranked

showcase

Default:

peer

named

practice

&nbsp;

**Long-Term Vision**

Arena Mode is **not** simply multiplayer editing.

Arena is the foundation for:

- Timed Writing Challenges
- Dialogue Duels
- Rewrite Relays
- Comedy Punch-Up Battles
- Character Challenges
- Story Festivals
- Studio Leagues
- Public Competitions
- Annual ScreenSmith Studio Awards

The canonical screenplay remains protected.

Arena exists to generate outstanding creative material which can later be promoted into Suggestions and, ultimately, into the Writer’s Desk through deliberate editorial review.

&nbsp;

## Out of Scope (v1)

- Realtime channels / presence inside Arena
- Anonymous voting (deferred; wire `self_vote_allowed` / anonymity later)
- AI craft judge auto-notes (stub the panel, no LLM call)
- Community-wide (cross-project) arenas
- Mobile-optimized voting flow

## Acceptance

- Env + local switch both required to see the tab
- Permitted member creates a round, others join, host starts
- Writers submit entries; timer flips to voting
- Participants score entries; host finalizes; winner marked
- Awards can be assigned; winning entry promotable to Suggestions
- No changes to `ScreenplayDocumentEditor` / `useScreenplayDocument` / any editor file
- Typecheck, lint, and new tests pass

## Files Touched / Added

**Migration:** 1 new SQL migration (5 tables + GRANTs + RLS + indexes).
**New:** `src/lib/arena.functions.ts`, `src/lib/arena.ts` (shared types/keys), 9 components under `src/components/writers-room/arena/`, `arena.functions.test.ts`.
**Edited:** `src/lib/featureFlags.ts`, `src/components/writers-room/ExperimentalFeaturesCard.tsx`, `src/routes/_authenticated/writers-room.$projectId.tsx`, `src/lib/i18n/keys.ts`, `src/lib/i18n/keys.test.ts`.
**Untouched:** all `src/components/editor/**`, all `src/lib/editor/**`, `screenplayPersistence.ts`, `useScreenplayDocument.ts`.