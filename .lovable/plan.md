## SceneSmith Studio — Screenplay Writing Speed Pass

### My take on your team's proposal
Directionally right. The winning idea is **INT./EXT./time-of-day chips as a keyboard accessory** — that alone changes how the app feels on iPad. Everything else is polish around that instinct: the page is the product; helpers are summoned.

A few refinements to your team's list before we code:

- **Feature 2 (Scene Heading Composer with separate segmented fields):** I'd drop the multi-segment composer. Splitting a slugline into `[INT./EXT.][Location][Time]` fights the caret model the editor already has and creates a second parallel input surface that can desync from `content`. The chip helper (Feature 1) delivers 95% of the value with zero risk. "Recent locations" as chips is a great add — but as suggestions above the same line, not a segmented composer.
- **Feature 7 (No-beat chip):** agree it's noisy on the writing line. Move it into the left gutter as a subtle dot; click reveals the picker in a popover.
- **Feature 5 (Auto-format Undo):** the pill already exists — we add two buttons wired to the existing `AutoFormatEvent` (revert text + block type) and existing `formatOverrideMemory` (mark rejected). No schema.
- **Feature 8 (Scene templates):** yes, but scope to Montage / Intercut / Flashback / Phone Call for v1. The others are easily added later once the insert helper exists.

### Scope guardrails (from your prompt, restated)
- No changes to `useScreenplayDocument`, autosave, persistence, Enter/Tab/slash behavior.
- No DB schema, no payments/entitlements, no AI additions.
- Focus mode stays sacred: page, caret, tiny save state, nothing else unless summoned.
- Basic mode: helpers visible. Advanced mode: helpers compact, always dismissible.

### Feature 1 — Scene Heading Helper (the hero feature)
- New `SceneHeadingChips.tsx`: a horizontally-scrollable, 44px-tap-target row of chips.
- Chips: `INT.` `EXT.` `INT./EXT.` `EST.` · `DAY` `NIGHT` `DAWN` `DUSK` `CONTINUOUS` `LATER`.
- Renders inside `ScreenplayLine.tsx` **only** when: `block_type === "scene_heading"` AND (focused OR content empty) AND mode ≠ Focus.
- Chip taps mutate the current line's `content` via a new pure helper `applySlugPart(content, part)` in `screenplayAutoFormat.ts` that:
  - Replaces existing prefix if one is present (`INT.` → `EXT.`), else prepends.
  - Replaces existing ` - <TIME>` suffix if present, else appends.
  - Preserves everything the writer already typed. Caret is restored to end of line.
- On iPad: chip row also mirrors into the bottom command bar so it functions as a keyboard accessory (see Feature 3).
- No new state, no debouncing — the helper is a pure string transform routed through the existing block-update path.

### Feature 2 — Recent Character chips
- New `RecentCharacterChips.tsx`: up to 5 chips derived from the existing `characters` prop, ranked by recency of use in the current document (compute in-component from `blocks` — no new store).
- Renders inside `ScreenplayLine.tsx` when `block_type === "character"` AND focused AND mode ≠ Focus.
- Tap fills the current character block with the uppercased name and moves caret to end.
- Never interferes with `CharacterAutocomplete`; the chip row sits above the input, autocomplete stays inline.
- No "+ New" for v1 (would require pulling in the create-character flow — punt to a follow-up).

### Feature 3 — Context-aware bottom bar
- Extend `EditorCommandBar.tsx` with a new `contextSlot` region that swaps by active block type:
  - `scene_heading`: `INT.` `EXT.` `DAY` `NIGHT` `Action` `New Scene`
  - `action`: `Character` `New Scene` `Shot` `Transition`
  - `character`: recent speakers (top 3) `Parenthetical` `Dialogue`
  - `dialogue`: `Parenthetical` `New Speaker` `Action`
- Reuses the same helpers as Features 1 & 2 — no logic duplication.
- Existing `Change / New line / AI continue / Script Map / Director / Tools` stay, demoted to secondary row on mobile.
- On iPad the context slot pins above the on-screen keyboard.

### Feature 4 — Compact active-line toolbar
- `CanvasToolbar.tsx`: replace verbose labels with `Slug | Action | Name | Dialog | ()` + tooltip on hover/long-press showing the full name and shortcut.
- Height reduced ~30%. Icons stay for the four most-used types.
- Keyboard shortcuts unchanged.
- On mobile (`md:` down), the toolbar collapses entirely — its role is served by the bottom bar's context slot.

### Feature 5 — Auto-format Undo
- Extend the existing auto-format pill (renders from `AutoFormatEvent`) with two buttons:
  - **Undo** — writes `event.previousContent` back and restores `event.previousType`. Uses existing block-update path.
  - **Don't suggest this again** — calls existing `formatOverrideMemory.reject(event.originalText)` and dismisses.
- Both actions clear the pill; Undo also emits an analytics event `auto_format_reverted` for future tuning.
- No schema; `formatOverrideMemory` already persists to localStorage.

### Feature 6 — Quiet beat picker
- `SceneBeatPicker.tsx` no longer renders inline next to the heading text. Instead:
  - Render a 6px dot in the left gutter of scene-heading lines (colored by beat, muted grey if unset).
  - Click/tap opens the existing picker in a `Popover` anchored to the dot.
- In Focus mode, dot is hidden entirely.
- In Basic mode, dot only appears if the guided step calls for beat tagging.

### Feature 7 — Scene templates (v1: 4 templates)
- New `SceneTemplateMenu.tsx`, summoned from the bottom bar `Tools` menu and via slash command `/template`.
- Templates: **Montage**, **Intercut**, **Flashback**, **Phone Call**.
- Each template calls the existing `insertBlocks` helper with a pre-formatted array of blocks (e.g. Montage inserts `action("MONTAGE:") → action("— EXT. ... - DAY") → action("— …") → action("END MONTAGE.")`).
- Zero AI, zero network.

### Focus / Basic / Advanced mode mapping (strict)
| Surface                    | Focus | Basic         | Advanced |
| -------------------------- | ----- | ------------- | -------- |
| Scene heading chips        | ❌     | ✅ default-on  | ✅ compact |
| Recent character chips     | ❌     | ✅             | ✅        |
| Context bottom bar         | ❌     | ✅             | ✅        |
| Active-line toolbar        | ❌     | ✅ full labels | ✅ compact |
| Auto-format pill + Undo    | ✅ pill only, no Undo buttons | ✅ | ✅ |
| Beat picker (gutter dot)   | ❌     | ⚠️ guided only | ✅        |
| Scene templates menu       | Summon only | ✅       | ✅        |

### Files touched
- New: `SceneHeadingChips.tsx`, `RecentCharacterChips.tsx`, `SceneTemplateMenu.tsx`.
- Edited: `ScreenplayLine.tsx` (mount points for chips, gutter dot), `EditorCommandBar.tsx` (context slot), `CanvasToolbar.tsx` (compact labels), `SceneBeatPicker.tsx` (dot + popover surface), `screenplayAutoFormat.ts` (add `applySlugPart` pure helper), `formatOverrideMemory.ts` (verify `reject()` export), auto-format pill component (Undo/Don't-suggest buttons).
- i18n: new `editor.chips.*`, `editor.bottomBar.*`, `editor.template.*`, `editor.autoFormat.undo`, `editor.autoFormat.silence` keys in `src/lib/i18n/keys.ts` with `keys.test.ts` invariants covering them.
- Tests: pure-helper tests for `applySlugPart` (prefix insert/replace, time insert/replace, preserve middle, empty input). Snapshot test for `SceneHeadingChips` render gating (block type / focus / mode).

### Acceptance
- Typing remains stable — no caret jumps, no first-character loss, no duplicate blocks.
- Autosave, Enter, Tab, `/int`, `/ext`, `/scene`, `/character`, `/dialogue` unchanged.
- On an empty scene-heading line: tap `EXT.` → type `LIBYAN PLATEAU` → tap `DAY` produces `EXT. LIBYAN PLATEAU - DAY`.
- On `INT. GARAGE - NIGHT`: tap `EXT.` → `EXT. GARAGE - NIGHT`; tap `DAY` → `EXT. GARAGE - DAY`.
- On a character block, tapping a recent speaker chip fills the block uppercase and leaves caret at end.
- Bottom bar swaps its context row when the active block type changes.
- Auto-format pill shows Undo + "Don't suggest this again"; both work and both dismiss the pill.
- Beat picker no longer sits over the writing line; a gutter dot opens it in a popover.
- Focus mode: no chips, no context bar, no gutter dot — page + caret only.
- No editor architecture rewrite; no schema, payments, or AI changes.

### Out of scope for this pass
- Segmented multi-field slugline composer (dropped in favor of chips; revisit if writers ask).
- "+ New character" from the chip row (needs the create-character flow to be safe to inline).
- Templates beyond the initial four.
- Any change to `useScreenplayDocument`, persistence, or the local-first typing pipeline.
