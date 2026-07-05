# UX Cleanup + Character Parsing Fix

**Principle:** The Page is the product. Everything else is summoned. No new features, no engine/model/autosave changes, no schema changes.

## Part 1 — Annotation visibility modes

Add an `annotationMode: "silent" | "quiet" | "full"` prop that flows from the route down to each screenplay line.

**Mode semantics**

- `silent` — no chips, no margin dots, no beat picker, no dictionary/suggestion controls. Pure page. (Focus + Basic default.)
- `quiet` — margin indicator dots only (current 2px dots for unknown terms + format suggestion). Popover reveals chips on click/focus. Beat picker hidden until line is focused. (Advanced default.)
- `full` — everything visible inline: chips, beat picker, suggestion row (opt-in via a Studio setting toggle "Show inline annotations").

**Wiring**

- `ScreenplayLine.tsx` — accept `annotationMode`; gate the margin-dot cluster, `SceneBeatPicker`, and suggestion accept/dismiss row on the mode. Typing/Enter/Tab/slash/autosave untouched.
- `ScreenplayDocumentEditor.tsx` — accept and forward `annotationMode` to each `ScreenplayLine`.
- `editor.$projectId.tsx` — compute mode from current write mode:
  - Focus → `silent`
  - Basic → `silent`
  - Advanced → `quiet` (or `full` if the user opted in)
- `ModeSettings.tsx` — add a single "Show inline annotations in Advanced" switch persisted via existing settings hook; no new schema.

## Part 2 — Harden character detection (importer)

`src/lib/import/parser.ts` — tighten `isLikelyCharacterLine` and the character branch so scene headings, act labels, transitions, and structural lines can never become characters.

Reject a line as character when any of these hold:

- Matches `SCENE_HIGH` / `SCENE_MED` (INT./EXT./inside/outside) — already partial, extend to cover `SCENE_MED`.
- Matches `TRANSITION_HIGH` or ends in `TO:` / `:`.
- Matches `SHOT` regex.
- Matches structural labels: `/^(ACT|SCENE|CHAPTER|PART|PROLOGUE|EPILOGUE|TEASER|COLD OPEN|MONTAGE|SERIES OF SHOTS|END( OF)?( ACT| SCENE| MONTAGE)?|THE END|FADE (IN|OUT))\b/i`.
- Matches page/scene numbering: `/^\d+[A-Z]?\.?$/` or `/^\d+\s+(INT|EXT)/i`.
- Contains a hyphen with time-of-day suffix (`- DAY`, `- NIGHT`, `- DAWN`, `- DUSK`, `- MORNING`, `- EVENING`, `- CONTINUOUS`, `- LATER`).
- Contains sentence punctuation (`.`, `!`, `?`) beyond the allowed `CONT'D`/initials pattern.
- Word count > 5 (character names are short — current 50-char cap is too loose).
- Is a single common English stopword uppercased (`THE`, `AND`, `BUT`, `OR`, `SO`, `A`, `AN`).

Also: require the following non-blank line to look like dialogue — not itself a scene heading, transition, shot, structural label, or another all-caps short line. Downgrade the "known character roster" match to still run through the reject list above.

This plan is approved with required amendments.

The annotationMode plan is good:

- Focus -> silent

- Basic -> silent

- Advanced -> quiet

Keep `full` as an internal/dev-only mode for now. Do not add a user-facing “Show inline annotations” switch in this pass unless it is localStorage-only and hidden from normal users. Inline annotations should not become part of the product UX.

Critical missing fix:

The character parsing issue is not only in `src/lib/import/parser.ts`.

You must also fix:

1. `src/lib/editor/manuscriptAnalyzer.ts`

2. `src/components/editor/CoachPane.tsx`

Reason:

The Advanced/Director Characters panel uses `tallyCharacters(blocks)` from live screenplay blocks. Hardening only the importer will not prevent scene headings, act labels, or malformed structural lines from appearing as characters during normal writing.

Required additions:

## Harden live manuscript character detection

In `src/lib/editor/manuscriptAnalyzer.ts`:

- Add `looksLikeStructuralLine()`.

- Use it inside `isLikelyCharacterName()`.

- Reject:

  - INT / INT. / INT./EXT / INT/EXT

  - EXT / EXT.

  - I/E

  - EST

  - ACT I / ACT 1 / ACT ONE

  - SCENE 1 / SCENE 4

  - OPENING SCENE

  - MIDPOINT

  - SEQUENCE

  - PROLOGUE / EPILOGUE / TEASER / COLD OPEN

  - MONTAGE / SERIES OF SHOTS

  - THE END

  - FADE IN / FADE OUT

  - any line ending in scene time tokens like DAY, NIGHT, DAWN, DUSK, MORNING, EVENING, CONTINUOUS, LATER when it looks like a heading

  - any obvious heading pattern such as `EXT LIBYAN PLATEAU DAY`

`tallyCharacters()` must ignore any `character` block that fails the hardened `isLikelyCharacterName()`.

Also require at least one attached dialogue line before surfacing it.

## Fix CoachPane wording/filter

In `src/components/editor/CoachPane.tsx`:

- Rename the script-derived list from “Characters” to “Detected Speakers” unless it is reading from the saved cast table.

- Filter detected speakers with `lineCount > 0`.

- Do not show scene headings, act labels, or structural lines in this list.

- Keep the button to open the real Casting Wall.

## Add tests beyond importer

Add tests for both:

- `src/lib/import/parser.ts`

- `src/lib/editor/manuscriptAnalyzer.ts`

Required live analyzer tests:

- `INT. AFRICAN DESERT - DAY` never appears in `tallyCharacters()`

- `EXT. LIBYAN PLATEAU - DAY` never appears in `tallyCharacters()`

- `ACT 1 THIS IS THE OPENING SCENE` never appears in `tallyCharacters()`

- `SCENE 4` never appears in `tallyCharacters()`

- `STEPHAN` followed by dialogue is detected

- `HANS (V.O.)` followed by dialogue is detected

## Annotation cleanup clarification

In `ScreenplayLine.tsx`:

- `silent` means no chips, no dots, no beat picker, no line annotation UI.

- `quiet` means margin dots only, closed by default, tap/click opens popover.

- No annotation popover should render open by default.

- Beat picker must not float over the screenplay in Focus or Basic.

- iPad/mobile must work by tap/focus, not hover.

## Acceptance

Focus:

- page only

- no chips

- no dots

- no beat picker

- no annotation UI

Basic:

- page + one guided next step

- no annotation clutter

- no beat picker

- no margin dots unless we explicitly decide otherwise later

Advanced:

- page clean by default

- margin dots only

- popovers summoned

- Detected Speakers does not show scenes/acts/headings

Do not regress:

- typing

- first character entry

- Enter

- Tab

- slash menu

- autosave

- local draft recovery

## Out of scope

Editor engine, block model, autosave, local-first persistence, Enter/Tab, slash menu, AI behavior, DB schema, new features.

## Files

- edit `src/components/editor/ScreenplayLine.tsx`
- edit `src/components/editor/ScreenplayDocumentEditor.tsx`
- edit `src/routes/_authenticated/editor.$projectId.tsx`
- edit `src/components/settings/ModeSettings.tsx`
- edit `src/lib/import/parser.ts`
- add a small unit test alongside `parser.ts` covering the reject cases

## Verification

- Typecheck.
- Existing importer tests still pass; new cases (INT./EXT., "ACT ONE", "CUT TO:", "SCENE 4", "- DAY" suffixes, 6+ word lines) do not become characters.
- Playwright: open `/editor/:projectId` in Focus/Basic → no chips or beat picker anywhere on the page; Advanced → margin dots only, popover reveals chips, beat picker appears when a line is focused.