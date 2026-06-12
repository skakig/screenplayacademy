
## Screenplay Import Pipeline — Implementation Plan

Follows `docs/SCREENPLAY_IMPORT_PIPELINE.md` and `AGENTS.md`. Local-first editor stays the source of truth; import is a guided, non-destructive flow that ends by hydrating the editor.

### Architecture

```text
Upload / Paste
  → Stage 1  Intake          (import_sessions row)
  → Stage 2  Text Extraction (client for .txt/.fountain/.md; serverFn for .fdx/.docx/.pdf/.rtf)
  → Stage 3  Block Parsing   (serverFn — Fountain-style heuristics, confidence-rated)
  → Stage 4  Preview         (review UI: change type, edit, merge, split, remove, bulk-approve high-confidence)
  → Stage 5  Commit          (Replace / Append / New project)
  → Stage 6  Diagnostics     (Lovable AI — formatting / structure / character / world / ITS signals)
  → Stage 7  Editor hydrate  (local-first: stable local IDs, focus restored, no reload)
```

### Database (one migration, RLS-scoped to `auth.uid() = user_id`)

- `import_sessions` — id, project_id (nullable for "import into new project"), user_id, source_type, file_name, raw_text (snapshot, immutable), status, error, created_at, updated_at
- `import_block_candidates` — id, import_session_id, order_index, raw_text, proposed_block_type, confidence, reason, needs_review, proposed_scene_index, proposed_character_name, user_override_type, approved (default false)
- `import_reports` — id, project_id, import_session_id, summary, counts (jsonb), created_at
- `import_warnings` — id, report_id, severity, type, message, related_candidate_ids (uuid[])
- `import_recommendations` — id, report_id, kind, payload (jsonb), accepted (default null)

All tables: `GRANT SELECT/INSERT/UPDATE/DELETE TO authenticated`, `GRANT ALL TO service_role`, RLS via `owns_project()` + `user_id = auth.uid()`, `updated_at` triggers.

### Server functions (`src/lib/import/*.functions.ts`)

- `createImportSession({ projectId?, sourceType, fileName?, rawText? })` — inserts session row; for binary uploads, accepts the extracted text from the client uploader (or extracts server-side, see below).
- `extractText({ sessionId, fileBase64, mime })` — for `.docx`/`.fdx`/`.rtf` runs lightweight pure-JS extractors inside the handler (mammoth for docx, fast-xml-parser for fdx, rtf-parser for rtf). `.pdf` uses `pdfjs-dist` legacy build — no native deps; Worker-safe.
- `parseScreenplay({ sessionId })` — runs heuristics from spec §"Parsing Heuristics" on `raw_text`, writes `import_block_candidates`, updates session status to `preview_ready`. Pure TS, no AI call.
- `commitImport({ sessionId, mode: "replace"|"append"|"new_project", newProjectTitle? })` — reads approved candidates, writes `script_blocks` ordered with safe gaps, derives `scenes`, upserts `characters`, sets session to `imported`. Auto-slates current draft to a `draft_takes` "Before import — <session name>" entry before replace.
- `diagnoseImport({ sessionId })` — calls Lovable AI via `createLovableAiGatewayProvider` (`google/gemini-3-flash-preview`) with `Output.object` schema for structured `{ warnings[], recommendations[] }`; writes to `import_reports`/`warnings`/`recommendations`. Surfaces 429/402 cleanly to the UI per gateway error rules.

All authored server fns use `.middleware([requireSupabaseAuth])`. `supabaseAdmin` is not needed — every read/write is scoped by RLS. Files live in `src/lib/import/` (client-safe path), per the import-graph rule.

### Parsing engine (`src/lib/import/parser.ts` — pure TS, server-shared)

Implements the spec's heuristics exactly:
- **Scene Heading**: `^(INT|EXT|INT\.\/EXT|I\/E)[\.\s]` → high; lowercase `int|ext|inside|outside` → medium (with confidence reason).
- **Character**: short uppercase line, no trailing `:`, not a transition, followed by non-blank → high. Title-case matching project's existing `characters` list → medium.
- **Parenthetical**: `^\(.*\)$` between Character and Dialogue → high.
- **Dialogue**: line after Character/Parenthetical, not a scene heading or transition → high.
- **Transition**: `^(CUT TO|FADE IN|FADE OUT|SMASH CUT TO|DISSOLVE TO):` → high.
- **Action**: fallback (never destructive).
- Each candidate carries `confidence`, `reason`, `needs_review`. Variants `(V.O.)`, `(O.S.)`, `(CONT'D)` preserved; no auto-merge.

Parser is reused by the live preview (instant client-side reparse on text edits) and the serverFn (canonical write).

### Preview UI (`src/components/import/ImportWizard.tsx`)

Three-step dialog/sheet:

1. **Source** — tabs for Paste / Upload. Upload accepts `.txt .fountain .md .fdx .docx .pdf .rtf`. Shows session creation + extraction progress.
2. **Review** — virtualized list of candidate rows with:
   - Block-type pill with dropdown (8 types)
   - Inline editable text
   - Confidence badge (green/amber/red) + tooltip reason
   - Merge-up / split-here / remove actions
   - Filter chips: All · Needs review · Characters · Scenes · Action · Dialogue
   - "Approve all high-confidence" bulk action
   - Right rail summary: scene count, character roster (with merge candidates flagged), location list, unknown-term candidates → "Add to Project Dictionary"
3. **Commit** — radio: **Replace current draft** (default; auto-slates first), **Append to current draft**, **Import as new project** (asks for title). Includes "Run AI diagnostics after import" toggle (default on). After commit: route to editor with imported blocks hydrated; diagnostics surface in CoachPane as reviewable suggestions (never auto-applied — per AI Behavior Rule).

A persistent **Import** session can be resumed: opening the wizard while a `preview_ready` session exists for the project offers "Resume previous import".

### Entry points

- Editor: small `Upload` icon-button in `DraftHistoryPanel` header next to the sync chip → opens wizard with current projectId.
- Dashboard: prominent "Import existing screenplay" card on `/dashboard` and on `projects.new` → wizard in "new project" mode.

### Editor hydration

`commitImport` returns the new `script_blocks` rows. Client maps them to `LocalBlock` (`id = local-<uuid>`, `serverId = row.id`, `status: "clean"`), writes to `scenesmith.draft.v1.<projectId>` localStorage, and dispatches an editor-refresh event so the open editor swaps in place without a `window.location.reload()` (avoiding the existing reload pattern in `performRestore`). Focus restored to first block.

### Non-destructive guarantees

- `import_sessions.raw_text` is the immutable snapshot.
- Pre-replace auto-slate goes to `draft_takes` → user can roll back from the existing Takes panel.
- `commitImport` writes inside a single SQL transaction (`rpc('commit_import', ...)`) so a partial failure leaves no orphans.
- "Revert this import" action on the session reads `raw_text` back into a new session.

### Acceptance tests covered

Maps 1:1 to spec §"Acceptance Tests" 1–14. Each gets a checklist item verified before closing the pass.

### Files (new)

```text
supabase/migrations/<ts>_import_pipeline.sql

src/lib/import/parser.ts                     # pure TS heuristics
src/lib/import/extractors.ts                 # docx/fdx/rtf/pdf/fountain
src/lib/import/sessions.functions.ts         # create / list / get / revert
src/lib/import/parse.functions.ts            # parseScreenplay
src/lib/import/commit.functions.ts           # commitImport (+ DB rpc)
src/lib/import/diagnose.functions.ts         # AI diagnostics

src/components/import/ImportWizard.tsx       # 3-step shell
src/components/import/ImportSourceStep.tsx
src/components/import/ImportReviewStep.tsx
src/components/import/ImportCommitStep.tsx
src/components/import/CandidateRow.tsx
src/components/import/ImportDiagnosticsPanel.tsx

src/routes/_authenticated/import.$projectId.tsx   # optional full-page route
```

### Files (touched)

- `src/components/editor/DraftHistoryPanel.tsx` — add Import entry button.
- `src/components/dashboard/GuidedDashboard.tsx` — Import card.
- `src/routes/_authenticated/projects.new.tsx` — "Start from an existing script" option.
- `src/components/editor/CoachPane.tsx` — surface latest diagnostic recommendations.
- `src/lib/i18n/keys.ts` + `t.ts` — i18n keys for every visible string (no hardcoded strings per AGENTS.md).

### Dependencies

`mammoth` (.docx), `fast-xml-parser` (.fdx), `rtf-parser` (.rtf), `pdfjs-dist` legacy build (.pdf). All pure JS, Worker-compatible.

### Pass sequencing (so the pass is reviewable)

1. **A** — Migration + Paste/.txt/.fountain/.md + parser + Preview + Commit (Replace/Append). Acceptance tests 1–12.
2. **B** — `.fdx`, `.docx`, `.rtf`, `.pdf` extractors + "Import as new project" mode.
3. **C** — Lovable AI diagnostics + CoachPane surfacing + recommendation accept/dismiss.
4. **D** — Revert import + resume-session UX + dashboard card + i18n sweep.

Each sub-pass ends with the spec's acceptance checklist re-verified.
