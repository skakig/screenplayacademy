## Goal

Bring the editor in line with two specs:

- `docs/SCREENPLAY_AUTO_FORMATTING.md` — finish the parts beyond the current `screenplayAutoFormat.ts` (smart suggestions, paste-batch preview, sticky writer overrides).
- `docs/SCREENPLAY_LANGUAGE_INTELLIGENCE.md` — new layer: project-aware spell help that never mangles invented names, character names, foreign words, or voice.

Both passes preserve local-first typing: pure helpers, no network in the hot path, never blur or move the caret.

---

## Pass 8 — Language Intelligence (the bigger pass)

### 8.1 Pure helper module

New file: `src/components/editor/screenplayLanguageIntelligence.ts` (no React/DOM/network).

Exports:

```ts
capitalizeStandaloneI(text, ctx): string          // safe, idempotent
capitalizeSentenceStarts(text, ctx): string       // moved from autoFormat
applySafeLanguageFixes(text, ctx): {              // composes the high-confidence fixes
  text: string; changed: boolean; fixes: AppliedFix[];
}
analyzeUnknownTerms(text, ctx): LanguageDecision[]
shouldPreserveUnknownTerm(term, ctx): boolean
createDictionaryCandidate(term, ctx): ProjectDictionaryEntry
```

`LanguageContext` carries: `blockType`, `language`, `characterNames: Set<string>`, `projectDictionary: Set<string>`, `rejectedFixes: Set<string>` (sticky overrides — see 8.5), `prevBlockType`.

Rules follow the doc: only `i → I`, contraction forms (`i'm → I'm`, `i'll`, `i've`, `i'd`), and sentence-start cap for Action/Dialogue. Notes get no auto cap. Dialogue keeps `ain't`, fragments, dialect. Never touch a token if it's in `characterNames` or `projectDictionary` (case-insensitive match on normalized form).

### 8.2 Project Dictionary persistence

New table `public.project_dictionary` (migration in build mode):

```sql
id uuid pk, project_id uuid fk projects on delete cascade,
term text not null, normalized_term text generated always as (lower(term)) stored,
category text not null check (category in (
  'character','location','organization','object','fictional_term',
  'foreign_word','historical_term','slang','dialect','custom'
)),
language text, notes text,
created_from text check (created_from in (
  'manual','character_bible','script_detection','import','ai_suggestion'
)) default 'manual',
approved boolean default true,
created_by uuid references auth.users, created_at timestamptz default now(),
unique (project_id, normalized_term)
```

With grants + RLS (owner of `projects` row can CRUD) per the platform's public-schema rule.

Server functions in `src/lib/dictionary.functions.ts`:

- `listProjectDictionary({ projectId })`
- `addDictionaryTerm({ projectId, term, category, createdFrom })`
- `removeDictionaryTerm({ id })`
- `seedFromCharacters({ projectId })` — bulk-insert character names + aliases as `character` entries with `created_from='character_bible'`.

Client hook `useProjectDictionary(projectId)` exposes the live `Set<string>` plus mutation actions. Cached via TanStack Query.

### 8.3 Editor wiring

`useScreenplayDocument`:

- Accept `languageContext` (characters + dictionary) and inject into the Enter/blur format pipeline already used by `screenplayAutoFormat`.
- Pipeline order (matches both docs):
  1. `applySafeLanguageFixes(text, ctx)` (high-confidence only)
  2. `formatBlockText(blockType, text)` (existing structural formatter)
  3. Compute next block type, insert.
- Emit a unified `AutoFormatEvent` so the existing format-indicator pill can surface `i → I` and dictionary-aware skips too. Add a new event kind `language_fix` so we can show distinct copy.

### 8.4 Unknown-term suggestion UI (passive, not a popup spammer)

- Async pass: after the writer leaves a block (blur or 800 ms idle), run `analyzeUnknownTerms` for that block only.
- Unknown words get a subtle dotted underline (CSS-only, in the rendered overlay span — not inside the textarea). Hover/tap opens a small popover with actions: *Add as Character / Location / Project term / Ignore once / Ignore always / Suggest alternative*.
- Underline is render-only; the textarea itself is untouched (no caret risk).
- New component: `src/components/editor/LanguageOverlay.tsx` (positioned absolutely over the line; reads textarea metrics).
- "Suggest alternative" stays manual — no auto-rewrite of unknowns, per the prime rule.

### 8.5 "Do not fight the writer" memory

- LocalStorage key per project: `scenesmith.fixOverrides.v1.<projectId>` → `Record<originalLower, "rejected" | "accepted">`.
- When the writer reverts an auto-fix within ~2 s, store as `rejected` and skip that exact fix going forward.
- Same memory consulted by `applySafeLanguageFixes` (passed in via `ctx.rejectedFixes`).
- Settings → "Reset language overrides for this project" button.

### 8.6 Telemetry

Add to `writing_events`: `lang_fix_applied`, `lang_fix_reverted`, `dictionary_term_added`, `unknown_term_flagged`. Feeds ITS later, no UI today.

---

## Pass 9 — Auto-Formatting completeness

The hot-path formatter already covers Scene Heading / Character / Parenthetical / Transition / Shot / sentence-cap. Remaining gaps from the doc:

### 9.1 Confidence model

Rewrite `analyzeFormat` to produce real medium/low decisions, not just "high if changed". Add detectors:

- Short uppercase Action line → maybe Character (medium).
- Action ending in `:` with transition verb → maybe Transition (medium).
- Long parenthetical (> ~40 chars) → maybe Action (medium).
- Lowercase block typed in a Character slot that looks like prose → maybe Action (medium).

### 9.2 Smart Suggestion strip

`SmartFormatSuggestion.tsx` — a quiet inline chip below the active line when a medium-confidence decision exists. Actions: *Apply / Dismiss / Don't ask again for this block*. Reuses the override memory from 8.5.

### 9.3 Paste / import batch formatter

- `formatPastedScript(raw: string): FormattedBatch` in `screenplayAutoFormat.ts`, using the doc's batch heuristics (INT/EXT → scene_heading, short caps → character/transition, after-character lines → dialogue, etc.).
- On paste of > ~120 chars or multi-line content, `useScreenplayDocument` intercepts and opens a new `PasteFormatPreviewDialog` showing original vs. formatted side-by-side with per-block accept/reject. On commit, blocks are inserted at the active position.
- Small paste (single line) still inserts raw — no dialog interrupt.

### 9.4 Sticky undo for formatter

Same override memory as 8.5: if the writer immediately edits a freshly auto-formatted line back, mark that exact transform as rejected for that block id; don't re-apply on next Enter.

### 9.5 Mobile

Toolbar block-type changes already trigger `formatBlockText` via `changeBlockType`. Verify and add the language fix in the same code path.

---

## File map

New:
- `src/components/editor/screenplayLanguageIntelligence.ts`
- `src/components/editor/LanguageOverlay.tsx`
- `src/components/editor/SmartFormatSuggestion.tsx`
- `src/components/editor/PasteFormatPreviewDialog.tsx`
- `src/components/editor/formatOverrideMemory.ts`
- `src/lib/dictionary.functions.ts`
- `src/hooks/useProjectDictionary.ts`
- Supabase migration: `project_dictionary` table + grants + RLS.

Edited:
- `src/components/editor/screenplayAutoFormat.ts` — real confidence model + `formatPastedScript`.
- `src/components/editor/useScreenplayDocument.ts` — pipeline, paste intercept, override memory.
- `src/components/editor/ScreenplayDocumentEditor.tsx` — wire context, overlay, smart suggestion, paste dialog.
- `src/components/editor/ScreenplayLine.tsx` — expose textarea metrics for overlay; emit `onLanguageFix`.
- `src/routes/_authenticated/editor.$projectId.tsx` — fetch characters + dictionary, pass `languageContext`.
- `src/lib/i18n/keys.ts` — new strings for language UI.

---

## Acceptance (from the docs)

**Auto-format**
- `int desert day` → `INT. DESERT - DAY` (already passes)
- Pasted rough script opens preview, per-block accept works.
- Medium-confidence Character suggestion appears for short uppercase Action; dismiss is sticky.
- Revert + re-Enter does not re-apply the same format.

**Language intelligence**
- `i am lost` → `I am lost`; `what am i doing?` → `what am I doing?`.
- `i ain't going` → `I ain't going` (preserves `ain't`).
- `Kubelweinsteinman` is never silently changed. After 2 uses it appears as a Project Dictionary candidate.
- Character Bible name `STEPHAN` (and `Stephan`, `Stephan's`, `STEPHAN (V.O.)`) is never flagged.
- Diacritics preserved.
- Reverting an `I` cap once: not re-applied on the same block.
- No caret jump, no blur, no remount during any of the above.

---

## Out of scope

- Full ITS coaching surfacing (signals stored, not shown).
- AI-powered rewrite of unknowns (the doc explicitly forbids auto-rewriting unknowns).
- Live per-keystroke spellcheck — async-on-blur only.

## Open questions

1. Build both passes together, or ship **Pass 8 (Language Intelligence) first** and **Pass 9 (Auto-format completeness) second** to keep PRs reviewable? My recommendation: split, Pass 8 first because it unlocks the dictionary that Pass 9's paste preview also wants to respect.
2. Should the Project Dictionary auto-seed from existing Character Bible names on first editor open, or only on explicit user action ("Import character names")? Default I'd pick: auto-seed silently — characters in the bible should never be flagged anyway.
3. Underline style for unknown terms — dotted muted underline (Apple-style) or no visible mark until hover? Default: dotted muted underline, hidden when active block is being typed.
