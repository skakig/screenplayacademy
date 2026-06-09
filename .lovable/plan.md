# Plan — Screenplay Auto-Formatting

Note: the doc is at `docs/SCREENPLAY_AUTO_FORMATTING.md` (not `add-screenplay-auto-formatting.md`). I read the full 535 lines.

## What exists today

- `src/lib/editor/autoFormat.ts` has **type detection** only: `detectBlockType(text)` returns a block type from raw text (`int…` → `scene_heading`, `(beat)` → `parenthetical`, short ALL-CAPS → `character`). It does **not** normalize text — `int desert day` keeps its lowercase even after detection.
- `ScreenplayLine.tsx` calls `detectBlockType` on every keystroke (≤40 chars) and fires `onChangeType` with a toast. There is a `autoFormattedRef` one-shot-per-block guard that resets when content clears.
- No `formatSceneHeading` / `formatCharacter` / `formatTransition` etc. exist anywhere. The Tab cycle and Enter transitions are already correct (Pass 4 consolidated them in `screenplayKeymap.ts`).

## What the doc asks for

A pure formatter module that turns raw input into clean screenplay text — **without** interrupting typing, **without** moving the caret mid-keystroke, and **without** fighting writers who edit back. High-confidence rules apply automatically; medium-confidence stays as a suggestion; low-confidence does nothing.

## Scope of this pass

### In

1. **New pure module** `src/components/editor/screenplayAutoFormat.ts` (matches the doc's recommended path) exporting:
   - `formatSceneHeading(text): string` — uppercase, normalize `int`/`ext`/`i/e` prefix, insert ` - ` before recognized time-of-day tokens (DAY, NIGHT, MORNING, AFTERNOON, EVENING, DAWN, DUSK, SUNRISE, SUNSET, LATER, CONTINUOUS, SAME TIME, MOMENTS LATER), preserve secondary dashes already present.
   - `formatCharacter(text): string` — uppercase name; normalize voice modifiers (`vo`/`v.o.`/`(vo)` → `(V.O.)`, `os`/`o.s.` → `(O.S.)`, `contd`/`cont'd` → `(CONT'D)`).
   - `formatParenthetical(text): string` — wrap in `()` if missing; lowercase unless line contains proper nouns; leave alone if it looks long-form (suggest-only path, no forced wrap).
   - `formatTransition(text): string` — uppercase; append `:` if missing; only when line matches a known transition verb (cut/fade/dissolve/smash cut/match cut/jump cut).
   - `formatShot(text): string` — uppercase; normalize `pov X` → `POV - X`.
   - `formatBlockText(blockType, text): string` — dispatcher; **action / dialogue / note are passthrough** (trim outer whitespace only).
   - `analyzeFormat(text, ctx): FormatDecision` — returns `{ blockType, formattedText, confidence, reason, shouldApplyAutomatically }` per the doc's shape. Used by paste/import later.
2. **Wire at safe moments** in `ScreenplayLine.tsx` and the document hook:
   - **On Enter** (in `ScreenplayLine.handleKeyDown` Enter branch): call `formatBlockText(block.block_type, block.content)`. If different, call `onContentChange(formatted)` synchronously, then `onEnter()` on the next microtask so the cursor advances cleanly to the new block. Guarded against echo loops via `lastAppliedFormatRef`.
   - **On blur** (in `ScreenplayLine.onBlur`): same call; only apply if the textarea is no longer focused (so we never preempt a re-focus).
   - **On explicit type change** (in `useScreenplayDocument.changeBlockType`): after the type update, apply `formatBlockText(newType, content)` once. This covers toolbar clicks, Tab cycling, slash menu, and ⌘1–7 — all of which already funnel through `changeBlockType`.
3. **Anti-fight guard**: extend the existing `autoFormattedRef` into `lastAppliedFormatRef` (stores the most recent formatted string). If the writer types content that, when re-formatted, would produce the same string we already applied and reverted from, don't re-apply. Caret stays put.
4. **Replace today's keystroke-driven detect-and-toast** with the same `detectBlockType` call but only at Enter/blur (the doc explicitly says "destructive changes should wait for Enter, blur, or explicit confirmation"). Keep the toast for medium-confidence type changes; remove the per-keystroke firing.
5. **Acceptance** (run on `/editor/$projectId`, per the doc's list):
   - `int desert day` + Enter → `INT. DESERT - DAY`, next block Action.
   - `ext street night` + Enter → `EXT. STREET - NIGHT`, next block Action.
   - Character `stephan` + Enter → `STEPHAN`, next block Dialogue.
   - Parenthetical `whispering` + Enter → `(whispering)`, next block Dialogue.
   - Transition `cut to` + Enter → `CUT TO:`, next block Scene Heading.
   - Shot `close on` + Enter → `CLOSE ON`, next block Action.
   - Dialogue + Action casing preserved.
   - No blur, no first/last-character loss, no caret jump.
   - Undo (⌘Z) reverses the format step.
   - If the writer edits the formatted text back, the editor does not re-apply.

### Out (explicit follow-ups, not this pass)

- **Paste / import batch formatter with preview** — needs its own UI surface; flagged in the doc as a separate flow.
- **Editor Review Mode** suggestion accept/edit/reject UI.
- **ITS / PfHU telemetry** (repeated-correction signals, lesson nudges).
- **Smart quote conversion**, project-style settings.
- Any AI/network-backed rewriting — auto-format stays pure and offline.

## Files touched

- `src/components/editor/screenplayAutoFormat.ts` — **new**, pure module, no React, no DOM, no Supabase.
- `src/components/editor/ScreenplayLine.tsx` — call formatter on Enter and blur; replace per-keystroke detect with Enter/blur detect; add `lastAppliedFormatRef`.
- `src/components/editor/useScreenplayDocument.ts` — in `changeBlockType`, run `formatBlockText` once after the type update.
- `src/lib/editor/autoFormat.ts` — keep `BLOCK_LABEL` and `detectBlockType` (used by Coach pane, command bar, and the new Enter/blur path). No deletions.

## Architectural guarantees preserved

- **Local-first**: formatter is a pure string→string function. No Supabase, no network, no React Query touch. Persistence still flows through the same adapter.
- **Caret stability**: formatting only runs at Enter or blur — never mid-keystroke. The Enter path sets new content + advances focus in a single React commit boundary.
- **Stable React keys**: no change to `LocalBlock.id` semantics.
- **Mobile**: toolbar block-change already routes through `changeBlockType`, so mobile users get the same formatting without needing Tab.
- **No invalidation during typing**: unchanged.

## Acceptance gate before merge

Run the 12-item list above on `/editor/$projectId` on desktop and iPhone. If any test fails, fix the rule, don't widen the surface.
