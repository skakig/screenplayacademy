# Writing Speed Pass — Pass 1 (Items 1–3)

Ship the three cheapest, highest-signal speed wins from the refined roadmap. Every surface is mutually exclusive with the others (one chip strip at a time), and every surface is hidden in Focus mode.

## Scope

1. Scene Heading chip strip (INT / EXT / INT./EXT. / EST. + time-of-day)
2. Recent Character chip strip (last 5 speakers, project-scoped)
3. Auto-format Undo — wired into the existing top-of-page format pill

Out of scope this pass: gutter-dot beat picker, smart Enter, slash-menu templates, toolbar compaction. Those land in pass 2 after we see writers use pass 1.

## Design rules (apply to every chip surface)

- **One strip at a time.** Scene chips and Character chips are mutually exclusive — the active block type decides which (if any) renders.
- **Only when useful.** Chips render only when the active block is empty or partial for that type. First keystroke that makes the chip redundant hides the strip.
- **Anchored to the active line**, not the page. Renders as a sibling of `<ScreenplayLine>` inside the same `data-local-id` wrapper, one row below the textarea on desktop, one row above on mobile (so it sits above the software keyboard).
- **Focus mode: never shown.** Reads the same `annotationMode` prop the editor already threads (`"silent"` hides all chip strips).
- **Never steals focus.** Chip taps use `onMouseDown={e => e.preventDefault()}` and re-focus the active textarea after mutation, matching the existing autocomplete pattern.
- **Touch-first.** 44px min tap target, visible on tablet/phone (no hover-only).

## Item 1 — Scene Heading chips

**Trigger:** active block is `scene_heading` AND (empty OR missing prefix OR missing time-of-day).

**Chips rendered (in order):**

- Prefix row (shown when the line lacks a valid prefix): `INT.` · `EXT.` · `INT./EXT.` · `EST.`
- Time row (shown once a prefix + location exist, or on demand): `DAY` · `NIGHT` · `CONTINUOUS` · `LATER` · `MORNING` · `EVENING` · `MOMENTS LATER`

**Mechanics:**

- New pure helper `applySlugPart(currentText, part, kind: "prefix" | "time"): string` in `src/lib/editor/screenplayAutoFormat.ts`. Idempotent — tapping `INT.` twice doesn't stack; tapping `EXT.` after `INT.` swaps the prefix. Time chip appends  `- TIME` or replaces an existing trailing time token.
- Chip tap → `applySlugPart` → `doc.updateBlockContent(activeId, next)` → re-focus textarea, caret at end.
- Unit tests for `applySlugPart` covering: empty line, existing prefix swap, existing time swap, mixed case input, idempotency.

## Item 2 — Recent Character chips

**Trigger:** active block is `character` AND content is empty.

**Data source:** derive from `doc.localBlocks` — walk backward from active block, collect distinct uppercased `character` block contents, cap at 5. Pure derivation, no new query. Falls back gracefully on new documents (no chips rendered).

**Chips rendered:** up to 5 recent names, most-recent first. Each chip is a plain `<button>` labeled with the name.

**Mechanics:**

- Chip tap → set block content to the name → advance to next block (`onEnter` equivalent) so the caret lands in an empty `dialogue` block. Matches Enter semantics already defined in `nextBlockTypeAfter`.
- No autocomplete overlap: chips hide the moment the writer types any character (existing `CharacterAutocomplete` takes over from there).

## Item 3 — Auto-format Undo

**Reuse the existing top-of-page format pill** (`lastFormat` state in `ScreenplayDocumentEditor.tsx`, lines 341–383). No new surface.

**Additions to the pill:**

- New `Undo` button between the info and dismiss buttons. Visible for the full 5s lifespan of the pill.
- Clicking Undo:
  1. Restores `lastFormat.original` text to the block (`doc.updateBlockContent`).
  2. If `lastFormat.typeChanged`, restores the prior block type (`doc.changeBlockType`).
  3. Calls `markFixRejected(projectId, lastFormat.original)` from the existing `formatOverrideMemory.ts` so the same transform is not re-suggested.
  4. Dismisses the pill.
- Extend the `AutoFormatEvent` payload emitted by `ScreenplayLine` to include `previousBlockType` (already knowable at emission time) so the undo can restore type accurately.

**No new memory model.** `formatOverrideMemory.ts` already handles the "don't fight the writer" persistence.

**Approved Pass 1 with amendments.**

This is the right build order:

1. Scene Heading chips

2. Recent Character chips

3. Auto-format Undo

Do **not** add smart Enter, templates, beat picker changes, or toolbar compaction in this pass. Keep the editor stable.

**What I like**

The “one strip at a time” rule is excellent. That protects the page from turning into a control panel again.

The scene heading chip behavior is exactly the right writing-speed improvement:

EXT. → LIBYAN PLATEAU → DAY

becomes:

EXT. LIBYAN PLATEAU - DAY

That is a real screenplay workflow improvement.

Recent character chips are also a big win. If I’m writing dialogue between STEPHAN and HANS, I should not have to keep typing names. Tap HANS, write line. Tap STEPHAN, write line. That’s fast.

Auto-format Undo is also necessary for trust. The app should be allowed to help, but the writer must always feel in control.

&nbsp;

**Amendments I would send back**

Approved with amendments.

&nbsp;

This is the right Pass 1:

1. Scene Heading chip strip

2. Recent Character chip strip

3. Auto-format Undo

&nbsp;

Do not include Pass 2 items yet.

&nbsp;

## Amendment 1 — Focus mode vs Basic mode

&nbsp;

Focus mode must hide chip strips.

&nbsp;

But be careful using only `annotationMode === "silent"` as the signal, because Basic mode may also pass `"silent"` for annotations.

&nbsp;

Basic Mode should still be allowed to show writing-speed chips if the product wants beginner help. Focus Mode should hide them completely.

&nbsp;

If `ScreenplayDocumentEditor` cannot distinguish Focus from Basic, add a narrowly scoped prop such as:

&nbsp;

```ts

showWritingChips?: boolean

showAutoFormatPill?: boolean

or:

chromeMode?: "focus" | "basic" | "advanced"

Do not accidentally hide helpful scene/character chips from Basic writers just because annotations are silent.

**Amendment 2 — Avoid layout jump from chip strips**

The chip strip should not cause the manuscript to jump around while writing.

If mounting as a sibling below the active line causes layout shift, use an absolutely positioned accessory row anchored to the active line, or reserve only minimal space.

Acceptance should include:

- activating chips does not push the current line away from the caret
- no scroll jump
- no caret jump

**Amendment 3 — Scene Heading chips should hide once complete**

Define “complete” clearly.

A scene heading is complete if it has:

PREFIX + LOCATION + TIME

Example:

EXT. LIBYAN PLATEAU - DAY

At that point the chip strip should disappear unless summoned again.

For partial headings:

EXT.

EXT. LIBYAN PLATEAU

LIBYAN PLATEAU - DAY

chips may remain because a prefix or time is missing.

**Amendment 4 — Recent Character chips should use nearby speakers first**

Derive recent characters from doc.localBlocks, but prioritize names by nearest previous speaker, not only project/global order.

If recent dialogue was:

STEPHAN

HANS

STEPHAN

the chips should likely show:

STEPHAN | HANS

not alphabetical.

Also exclude empty character blocks and obvious invalid names.

**Amendment 5 — Character chip tap must preserve Enter semantics**

Tapping a recent character chip should behave exactly like:

1. fill current character block with name
2. press Enter
3. land in a new dialogue block

Do not create duplicate blocks.  
Do not leave the caret in the character block.  
Do not skip over the dialogue block.

Add a test for that flow.

**Amendment 6 — Auto-format Undo needs exact previous type**

Extending AutoFormatEvent with previousBlockType is correct.

Undo must restore:

- exact original text
- exact previous block type
- focus/caret stability
- no immediate re-format loop

If markFixRejected(projectId, lastFormat.original) is not enough to prevent the exact transform from re-firing, add a local one-shot guard for that block. Do not add new DB schema.

**Amendment 7 — Do not hide the format pill in Basic unless intentional**

The format pill is not the same as annotation clutter. Beginners may benefit from seeing:

Auto-formatted as Scene Heading

Undo

Why?

Focus mode should hide it.  
Basic mode may keep it if it helps teach formatting.

Do not make annotationMode === "silent" automatically hide the format pill unless Basic is intentionally supposed to lose that teaching affordance.

**Required tests**

Add tests for:

- applySlugPart("", "EXT.", "prefix")
- prefix swap: INT. GARAGE - NIGHT → EXT. GARAGE - NIGHT
- time swap: EXT. GARAGE - NIGHT → EXT. GARAGE - DAY
- idempotency: tapping EXT. twice does not stack
- location preservation
- character chips exclude blanks
- character chip tap advances to dialogue
- auto-format Undo restores original text and previous type
- chips hidden in Focus
- Basic mode still gets chips if intended

## One thing I’d push back on

&nbsp;

This line:

&nbsp;

> “Focus mode (⌘.) hides both chip strips and the format pill.”

&nbsp;

I agree for chip strips. I’m less sure about the format pill.

&nbsp;

If I’m in Focus mode, yes, hide everything.

&nbsp;

But if I’m in **Basic mode**, I might want the auto-format pill because it teaches the user what just happened. So the implementation should not use only `annotationMode="silent"` to hide the format pill unless that is truly intended.

&nbsp;

## Final recommendation

&nbsp;

Tell Lovable:

&nbsp;

```text id="lcb5ml"

Plan approved. Ship items 1–3 only, with the amendments above.

This is a good pass. It moves SceneSmith from “beautiful editor” toward “fast professional writing instrument” without breaking the sacred page.

## Files touched

New:

- `src/components/editor/SceneHeadingChips.tsx`
- `src/components/editor/RecentCharacterChips.tsx`
- `src/lib/editor/screenplayAutoFormat.applySlugPart.test.ts`

Edited:

- `src/lib/editor/screenplayAutoFormat.ts` — add `applySlugPart` helper + exported time/prefix token lists.
- `src/components/editor/ScreenplayDocumentEditor.tsx` — mount chip strips inside the active-block wrapper; wire Undo button into the format pill; thread `projectId` into pill handlers.
- `src/components/editor/ScreenplayLine.tsx` — extend `AutoFormatEvent` with `previousBlockType`; emit it at existing emission sites. No other changes to the line's focus/blur logic.
- `src/lib/i18n/keys.ts` — new `editor.chips.*` namespace (prefix labels, time labels, recent-character aria label) and `editor.autoFormat.undo` key.

## Acceptance checks

- 16-step editor acceptance test still passes end-to-end (typing, Enter, Tab, no focus loss, no caret jump).
- Focus mode (⌘.) hides both chip strips and the format pill.
- Scene chip tap: caret stays in the same block, at end, textarea keeps focus.
- Character chip tap: caret advances to a new empty `dialogue` block, textarea focused.
- Undo: pressing Undo within 5s of an auto-format restores exact original text and type, and the same transform does not re-fire on the next keystroke.
- Vitest: new `applySlugPart` suite green; existing editor + coach tests green.
- `bunx tsgo` clean.

## Deferred to Pass 2

Gutter-dot beat picker, smart Enter (empty character revert, double-Enter new scene), slash-menu scene templates, `CanvasToolbar` mobile compaction. Revisit after writers use pass 1.