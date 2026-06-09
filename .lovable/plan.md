# Pass 9 — Auto-Formatting Completeness

Builds on Pass 8's language layer. Goal: make structural auto-formatting *trustworthy* (high-confidence auto-applies, medium-confidence suggests, low-confidence stays out of the way) and handle the biggest pain point — pasting unformatted scripts.

## Scope

### 1. Confidence-tiered formatter (`screenplayAutoFormat.ts`)
Rewrite `analyzeFormat(text, context)` to return:
```ts
{ suggestedType, confidence: 'high'|'medium'|'low', reason, transformedText? }
```

**High-confidence (auto-apply on Enter/blur):**
- `INT.`/`EXT.`/`INT./EXT.` prefix → `scene_heading` (uppercase the slug)
- Line ending in `TO:` (CUT TO:, FADE TO:, DISSOLVE TO:) → `transition`
- Fully wrapped in `(...)` and prev block is `character`/`dialogue` → `parenthetical`
- All-uppercase single line (<=4 words, no punctuation) after Action/blank, followed by Enter → `character`

**Medium-confidence (suggest via chip, don't auto-apply):**
- Short uppercase line in Action context that *might* be a character cue
- Action line ending in `:` that might be a Transition
- Lowercase line currently typed in a Character block (probably Action)
- Parenthetical longer than ~40 chars (probably Action with parens)

**Low-confidence:** do nothing; respect user's chosen type.

Honors `formatOverrideMemory` rejected-fix list so a reverted suggestion doesn't re-fire.

### 2. Paste-batch formatting
New helper `formatPastedScript(rawText, context)` → array of typed blocks using line-by-line heuristics (scene heading detection, blank-line block separation, character/dialogue pairing).

In `useScreenplayDocument.ts`, intercept paste when:
- pasted text > 120 chars **or** contains 2+ newlines

Open a new `PasteFormatPreviewDialog` that shows each detected block with its type, per-block accept/reject toggles, and three actions:
- **Insert formatted** (default)
- **Insert as plain Action**
- **Cancel**

Small/single-line paste keeps current raw behavior.

### 3. Smart suggestion chip
In `ScreenplayLine.tsx`, when current block has a *medium-confidence* alternative type, show a small inline chip ("Looks like a Character cue — convert?") near the line. Accept = apply transform + focus preserved. Dismiss = record in override memory for that block.

Reuses the existing "New word" chip styling for visual consistency with Pass 8.

### 4. Wire-up
- `ScreenplayDocumentEditor.tsx`: pass `formatContext` (prev block type, char names) down; render the paste dialog at editor level.
- `editor.$projectId.tsx`: no schema changes; reuses character + dictionary already fetched in Pass 8.
- Telemetry: log `format_suggestion_shown`, `format_suggestion_accepted`, `format_suggestion_dismissed`, `paste_formatted`, `paste_inserted_raw` to existing `writing_events`.

## Out of scope
- AI-powered paste cleanup (separate pass).
- Reformatting an entire existing script in place.
- Drag-to-reorder blocks.

## Acceptance test
1. Type `int. coffee shop - day` + Enter → auto-converts to scene heading, next block is Action.
2. In Action, type `JANE` + Enter → auto-promotes to Character, next is Dialogue.
3. In Action, type `Sarah` (mixed case) + Enter → chip appears suggesting Character; dismiss; chip stays gone for that line.
4. Paste a 10-line snippet with scene heading + action + dialogue → preview dialog appears; accept → blocks insert with correct types.
5. Paste a single short sentence → inserts inline, no dialog.
6. Apply a suggested fix, immediately Ctrl+Z → fix reverts and is remembered (won't re-suggest within the session).

## Open questions
1. **Paste dialog UX:** modal dialog vs inline preview-strip above the cursor? Modal is clearer; inline is faster. I'd go modal for v1.
2. **Auto-apply scene heading capitalization** when user types `int. ` lowercase mid-line — yes or wait for Enter? I'd do it on the space after `int.`/`ext.` for instant feedback.
3. Show suggestion chip on **every** medium-confidence line, or only after a brief idle pause (~600ms) to avoid flicker while typing? I'd lean idle-pause.

Once you confirm (or just say "go"), I'll implement.
