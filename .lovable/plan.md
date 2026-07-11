I confirmed every blocker the reviewer flagged by reading the current code and migrations. The reviewer is right on all three counts: `arena_entries_select_members` in `20260710195805_...sql` still returns full identity rows during blind voting, `ResultsPanel.tsx` still hardcodes `role === "owner"` and `const winner = ranked[0]`, and `VotingRoom` never mounts the progress RPC. My recommendation is a single small "Arena Completion Pass" that closes exactly the blockers, then a real-Supabase RLS suite so we never regress.

## Scope: Arena Completion Pass (no new features)

### 1. Close the blind-voting SELECT bypass on `arena_entries` (Blocker 1)

Migration:

- Drop `arena_entries_select_members`.
- Replace with a narrower policy that returns identity-bearing rows only when it is safe:
  - Author can always read their own rows.
  - Host (`session.created_by = auth.uid()`) and project owner can always read all rows for their session.
  - Ordinary members can read rows only when the session's `entry_reveal = 'named'` OR `status IN ('complete','archived')` OR the session is not currently in `voting`. During blind voting other members get zero rows from the table.
- Add a `has_arena_entry_read_access(_session_id, _entry_id)` `SECURITY DEFINER` helper so the policy stays simple and non-recursive.
- Keep `get_arena_voting_entries` as the ONLY read path during blind voting. Delete or gate the client `listEntries()` helper so it can't be reused during blind voting (call sites: `ResultsPanel`, arena e2e test — both are post-finalize or host-only after this change).

Client:

- In `src/lib/arena.ts`, split `listEntries` into `listCompletedSessionEntries(sessionId)` (only usable after `status IN ('complete','archived')`, throws otherwise) and delete direct blind-time consumers.
- `ResultsPanel` switches to the completed-session helper.

### 2. Fix `ResultsPanel` to use database-authoritative winners + correct host check (Blockers 2 + 3)

`src/components/writers-room/arena/ResultsPanel.tsx`:

- Replace `const isHostOrOwner = role === "owner"` with `currentUserId === session.created_by || role === "owner"`, matching `VotingRoom`.
- Load `listSessionAwards(session.id)` and call the existing `resolveArenaWinners(...)` helper.
- Render one OR many `studio_winner` entries as co-winners (equal visual weight, alphabetized by anonymous → real name at reveal), and demote the current single-winner card to a "Top-ranked" section only used for runners-up presentation.
- If awards are still loading, show a skeleton — never fall back to `ranked[0]`.

### 3. Wire `VotingRoom` progress + gate early finalization

`VotingRoom.tsx`:

- Add `useQuery(arenaKeys.progress(sessionId), () => getArenaVotingProgress(sessionId))` with a 5s refetch while `status === 'voting'`.
- Render a small "N of M writers/judges have voted" chip + a "You've voted" state.
- If the host clicks "Finalize" while `completed_voters < eligible_voters` AND `session.stakes IN ('ranked','showcase')`, show a confirm dialog ("Finalize early? Some judges haven't voted."). Practice rounds skip the confirm.

No schema change needed — `stakes` and the progress RPC already exist. The confirm is UI-only.

### 4. Real-Supabase Arena RLS suite

Add `src/lib/arena.rls.test.ts` (skipped unless `SUPABASE_TEST_URL` + service role are set in env) that:

- Spins up 4 test users via the service role (owner/host, writer, judge, non-member).
- Signs each in as themselves (per-user anon client) and exercises:
  - direct `from('arena_entries').select('*')` during blind voting returns 0 rows for the non-author writer/judge, and full rows for author/host/owner;
  - `from('arena_votes').select('*')` during voting returns only own rows;
  - submit-after-grace is rejected;
  - editing a submitted entry is rejected;
  - duplicate `promote_arena_entry` returns the existing suggestion;
  - two concurrent `create_arena_session` calls on one project result in exactly one non-archived active session (unique index holds);
  - a tied voting scenario produces multiple `studio_winner` awards.
- Also add a lightweight vitest case that asserts `listEntries` throws when called against a non-completed session, so the client can't quietly regress.

### 5. Small verification checklist we run before closing the pass

- `bunx vitest run src/lib/arena*.test.ts src/components/writers-room/arena/*.test.tsx` all green.
- Manual smoke in preview with two accounts: blind round → check DevTools that a direct `arena_entries` query returns 0 rows during voting; then finalize and confirm both tied entries render as co-winners.
- Confirm a non-owner session creator (co_writer) sees Award + Promote actions in `ResultsPanel`.

## Out of scope for this pass

Lobby polish, mode-specific rules, reveal ceremony animation, animated Awards Wall, and "From Arena" lineage on Suggestions. Those are Priority 3 in the review and I agree — hold until integrity is verified with real writers.

## Technical notes

- The new `arena_entries` policy will use `has_arena_entry_read_access(session_id, id)` (SECURITY DEFINER, STABLE) that inlines the session/status/reveal check and the ownership branches. Keeps the RLS predicate short and avoids sub-selects in every policy evaluation.
- `resolveArenaWinners` already exists in `src/lib/arena.ts` — `ResultsPanel` only needs to consume it.
- The progress chip reuses `arenaKeys.progress` which is already exported.
- The RLS test file will be gated by `describe.skipIf(!process.env.SUPABASE_TEST_URL)` so CI without the env stays green; when the env is present it runs end-to-end against a scratch project.
