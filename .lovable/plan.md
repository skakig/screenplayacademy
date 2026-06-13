# Pass 5 — Suggestions and Review Mode

Adds a propose/review/approve layer to Writers' Room. Collaborators draft changes; authorized users accept or reject them. Canonical script content is never silently overwritten.

## 1. Database migration

New table `public.suggestions` matching the spec (project/scene/script_block anchors, source, suggestion_type, status, before/after jsonb, accept/reject metadata, timestamps). Plus:

- Indexes on project_id, scene_id, script_block_id, author_id, source, status, suggestion_type, created_at.
- `updated_at` trigger using existing `update_updated_at_column`.
- GRANTs to `authenticated` and `service_role` (no `anon`).
- RLS enabled.

SQL security-definer helpers (mirroring Pass 3/4 style):

- `can_view_suggestions(_project_id)` — any active member or owner.
- `can_create_suggestion(_project_id)` — owner, co_writer, editor, producer, commenter, assistant.
- `can_accept_suggestion(_project_id)` — owner, co_writer, editor.
- `can_reject_suggestion(_project_id)` — owner, co_writer, editor, producer.
- `can_archive_suggestion(_project_id)` — owner only.

RLS policies:

- SELECT: `can_view_suggestions(project_id)`.
- INSERT: `can_create_suggestion(project_id)` AND `author_id = auth.uid()` AND status = 'open'.
- UPDATE: `can_accept_suggestion` OR `can_reject_suggestion` OR `can_archive_suggestion` OR (`author_id = auth.uid()` AND status = 'open' for self-reject).
- No DELETE policy (archive instead).

## 2. Permission helpers

Extend `src/components/writers-room/permissions.ts`:

- `canViewSuggestions(role)`
- `canCreateSuggestion(role)`
- `canAcceptSuggestion(role)`
- `canRejectSuggestion(role, suggestion, userId)` (allow author to reject own open suggestion)
- `canArchiveSuggestion(role)`
- `canApplySuggestionToCanonicalContent(role)` (= accept + not viewer)

## 3. Data layer

New `src/lib/suggestions.ts`:

- Types for `Suggestion`, `SuggestionType`, `SuggestionStatus`, `SuggestionSource`, payload shapes.
- `suggestionKeys` for TanStack Query.
- `fetchSuggestions(projectId, status)`.
- `createSuggestion(input)` — trims, validates lengths (title 160, rationale 5000, suggested text 10000).
- `rejectSuggestion(id)` — sets status, rejected_by, rejected_at.
- `archiveSuggestion(id)`.
- `acceptSuggestion(suggestion)` — orchestrates:
  1. Re-fetch suggestion to confirm still open.
  2. For `replace_block_text`: verify block exists, verify scene not locked by someone else (query `scene_locks` active row), update `script_blocks.content` if safe; mark accepted.
  3. For `character_note`, `structure_note`, `continuity_fix`, `pitch_deck_note`: mark accepted without script mutation (note-only).
  4. For `insert_block_after`, `delete_block`, `change_block_type`, `rewrite_scene`: mark accepted as "accepted for planning" — UI surfaces the deferred-application banner.
- Snapshot-before-accept: deferred (no snapshot infra wired for arbitrary content changes); documented in summary.

## 4. UI — Suggestions tab in Writers' Room

Add 4th tab "Suggestions" to `src/routes/_authenticated/writers-room.$projectId.tsx` with open-count badge (mirrors notes badge).

New folder `src/components/writers-room/suggestions/`:

- `SuggestionsPanel.tsx` — header copy from spec, three filtered sections (Open / Accepted / Rejected), "Create suggestion" button (gated by `canCreateSuggestion`), read-only banner otherwise.
- `useProjectSuggestions.ts` — query hook per status.
- `SuggestionList.tsx` — empty states from i18n.
- `SuggestionCard.tsx` — author, source pill, timestamp, anchor label, type label, title, rationale preview, status, actions.
- `SuggestionDetail.tsx` (dialog) — full rationale, before/after panels (Current / Suggested), accept/reject/archive controls, lock warning if relevant, "accepted for planning" notice for risky types.
- `SuggestionDiff.tsx` — clean text before/after comparison (two cards, no GitHub-style red/green washes; use subtle muted/accent surfaces).
- `CreateSuggestionDialog.tsx` — anchor scope selector (Project / Scene; Block omitted this pass to protect editor), suggestion type, title, rationale, suggested text; client-side validation.
- `AnchorLabel.tsx` — "Project suggestion" / "Scene suggestion: INT. DINER — NIGHT" using existing scene fetch pattern from Pass 3/4.
- `SourceBadge.tsx`, `StatusBadge.tsx`, `SuggestionTypeLabel.tsx` — restrained labels.

Block-level anchoring deferred: spec explicitly says "only add block-level suggestions if existing block IDs and UI hooks are stable" — current editor has no in-script "suggest this line" affordance and adding one risks the editor. Schema and accept-path still support `replace_block_text` so AI sources can create them.

Update `AccessRulesPanel.tsx` to mark suggestions as active.

## 5. i18n

Add all `collab.suggestions.*`, `collab.suggestionType.*`, `collab.reviewMode.*`, and `collab.tabs.suggestions` keys listed in the spec to `src/lib/i18n/keys.ts`.

## 6. Visual design

Warm paper card surfaces (`bg-card/60`), Playfair Display headings, Inter body, subtle borders, status pills using existing tokens (no raw red). Calm empty states with single-sentence copy from spec. No modal storms — one detail dialog and one create dialog.

## 7. Guardrails / what's NOT touched

- No files under `src/components/editor/**`.
- No presence, cursors, realtime, or multiplayer.
- No edits to screenplay parser, formatter, keymap, persistence, key handling.
- No auto-apply of risky suggestion types.
- No bypass of scene locks (active lock check before applying `replace_block_text`).
- AI suggestions supported via `source='ai'` rows; same review queue, same accept/reject path. No AI generator built in this pass.
- `change_events` table doesn't exist → logging deferred with TODO comments (mirrors Pass 3/4).

## 8. Acceptance checks

- Owner can create, accept, reject, archive.
- Commenter can create + self-reject own open suggestions; cannot accept.
- Viewer sees read-only list.
- Non-member: RLS blocks read.
- Accepting `replace_block_text` on an unlocked scene updates `script_blocks.content`; locked-by-other shows protected message.
- Accepting note-type suggestions marks accepted without script change and UI says so.
- Editor still passes typing acceptance (no editor files modified).
- Build + lint pass.

## Files

**Migration:** `supabase/migrations/<ts>_suggestions.sql`

**New:**
- `src/lib/suggestions.ts`
- `src/components/writers-room/suggestions/SuggestionsPanel.tsx`
- `src/components/writers-room/suggestions/useProjectSuggestions.ts`
- `src/components/writers-room/suggestions/SuggestionList.tsx`
- `src/components/writers-room/suggestions/SuggestionCard.tsx`
- `src/components/writers-room/suggestions/SuggestionDetail.tsx`
- `src/components/writers-room/suggestions/SuggestionDiff.tsx`
- `src/components/writers-room/suggestions/CreateSuggestionDialog.tsx`
- `src/components/writers-room/suggestions/AnchorLabel.tsx`
- `src/components/writers-room/suggestions/SourceBadge.tsx`
- `src/components/writers-room/suggestions/StatusBadge.tsx`
- `src/components/writers-room/suggestions/SuggestionTypeLabel.tsx`

**Edited:**
- `src/components/writers-room/permissions.ts`
- `src/components/writers-room/AccessRulesPanel.tsx`
- `src/routes/_authenticated/writers-room.$projectId.tsx`
- `src/lib/i18n/keys.ts`
- `src/integrations/supabase/types.ts` (auto-regenerated after migration)

Stops after Pass 5. No Pass 6 work (presence, cursors, live editing).
