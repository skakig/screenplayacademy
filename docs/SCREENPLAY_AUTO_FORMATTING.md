# SCREENPLAY_AUTO_FORMATTING.md

## Purpose

This document defines SceneSmith's screenplay auto-formatting behavior.

The user should not need to already know professional screenplay formatting before writing.

The editor should help convert rough natural typing into proper screenplay format while preserving author control, caret stability, and local-first writing flow.

Auto-formatting must make the writing experience feel smarter, not more fragile.

## Prime Rule

Auto-formatting must never interrupt writing.

It must not:

- drop characters
- blur the field
- move the caret unexpectedly
- change block type incorrectly with high confidence
- overwrite intentional writer text
- require network or AI
- depend on Supabase
- make the writer feel corrected every keystroke

The editor should assist quietly and predictably.

## Relationship to Screenplay Structure

Auto-formatting is not the same as screenplay structure.

- `SCREENPLAY_STRUCTURE.md` defines what block types mean and what usually comes next.
- `SCREENPLAY_AUTO_FORMATTING.md` defines how raw typed text is normalized inside those block types.

Example:

```text
Writer types: int desert day
Editor block type: scene_heading
Auto-format result: INT. DESERT - DAY
Enter creates: action
```

The structure engine decides that Scene Heading + Enter creates Action.

The auto-formatting engine decides that `int desert day` should become `INT. DESERT - DAY`.

## Formatting Philosophy

SceneSmith should support three levels of formatting help:

### 1. Safe Auto-Format

High-confidence formatting that can happen automatically.

Examples:

- `int desert day` to `INT. DESERT - DAY`
- `ext street night` to `EXT. STREET - NIGHT`
- `cut to` to `CUT TO:`
- `fade out` to `FADE OUT:`
- Character names in Character blocks become uppercase.

### 2. Smart Suggestion

Medium-confidence formatting that should be offered but not forced.

Examples:

- A short uppercase Action line might be a Character.
- A line ending in `:` might be a Transition.
- A line like `john whispers` might be Action, not Character.

Smart suggestions should be reviewable.

### 3. Do Nothing

Low-confidence situations should not auto-format.

When unsure, preserve the writer's text.

Do not be clever at the cost of trust.

## When Auto-Formatting Runs

Auto-formatting may run at these moments:

1. On Enter, before creating the next block.
2. On blur, when the writer leaves a line.
3. On explicit block type change.
4. On paste/import, as a batch process with preview.
5. On explicit command: `Format this line` or `Format script`.

Auto-formatting should not aggressively rewrite the line on every keystroke.

Live detection is allowed, but destructive changes should wait for Enter, blur, or explicit confirmation.

## Block-Specific Auto-Format Rules

## Scene Heading

Scene headings establish location and time.

They should usually begin with:

- `INT.`
- `EXT.`
- `INT./EXT.`
- `I/E.` if supported later

They are usually uppercase.

### Scene Heading Examples

| Typed | Auto-Formatted |
|---|---|
| `int desert day` | `INT. DESERT - DAY` |
| `ext street night` | `EXT. STREET - NIGHT` |
| `int office morning` | `INT. OFFICE - MORNING` |
| `ext. beach sunset` | `EXT. BEACH - SUNSET` |
| `int/ext truck moving dawn` | `INT./EXT. TRUCK - MOVING - DAWN` |
| `i/e car night` | `INT./EXT. CAR - NIGHT` |

### Scene Heading Normalization Rules

1. Uppercase the full line.
2. Normalize beginning:
   - `int` to `INT.`
   - `ext` to `EXT.`
   - `int.` to `INT.`
   - `ext.` to `EXT.`
   - `int/ext` to `INT./EXT.`
   - `int./ext` to `INT./EXT.`
   - `i/e` to `INT./EXT.`
3. Insert a separator before recognized time-of-day tokens.
4. Use ` - ` as the separator.
5. Preserve additional location detail.

### Recognized Time Tokens

- `DAY`
- `NIGHT`
- `MORNING`
- `AFTERNOON`
- `EVENING`
- `DAWN`
- `DUSK`
- `SUNRISE`
- `SUNSET`
- `LATER`
- `CONTINUOUS`
- `SAME TIME`
- `MOMENTS LATER`

### Scene Heading Edge Cases

If the writer types a complex scene heading already containing proper dashes, preserve intent.

Example:

```text
INT. HOTEL HALLWAY - OUTSIDE ROOM 214 - NIGHT
```

Do not collapse meaningful secondary dashes.

## Action

Action describes what the audience sees or hears.

Action should usually preserve sentence casing.

Do not uppercase Action blocks.

### Action Auto-Format Rules

Safe fixes:

- Trim excessive leading/trailing whitespace.
- Collapse repeated spaces outside intentional indentation.
- Convert smart quotes only if project style requires it.
- Preserve punctuation.
- Preserve writer voice.

Do not rewrite prose.

Do not turn Action into Dialogue just because it is short.

Do not turn Action into Character unless confidence is very high and the writer confirms.

## Character

Character blocks identify the speaker.

Character names should be uppercase.

### Character Examples

| Typed | Auto-Formatted |
|---|---|
| `stephan` | `STEPHAN` |
| `Commander` | `COMMANDER` |
| `john (v.o.)` | `JOHN (V.O.)` |
| `maria o.s.` | `MARIA (O.S.)` |
| `old man` | `OLD MAN` |

### Character Normalization Rules

1. Uppercase character name.
2. Normalize voice modifiers:
   - `vo` to `(V.O.)`
   - `v.o.` to `(V.O.)`
   - `(vo)` to `(V.O.)`
   - `os` to `(O.S.)`
   - `o.s.` to `(O.S.)`
   - `(os)` to `(O.S.)`
   - `contd` to `(CONT'D)`
   - `cont'd` to `(CONT'D)`
3. Preserve parenthetical modifiers if already correct.

### Character Detection Rules

A line may be detected as Character when:

- The current block type is Character.
- The writer selected Character from toolbar/Tab/slash.
- The line is short, mostly uppercase, and followed by Dialogue.
- The line matches a known Character Bible name.

Do not force character detection in ambiguous cases.

## Dialogue

Dialogue is spoken text.

Dialogue should preserve normal sentence casing and punctuation.

Do not uppercase dialogue.

Do not auto-correct style aggressively.

### Dialogue Rules

Safe fixes:

- Preserve paragraph content.
- Trim accidental outer whitespace.
- Allow contractions.
- Allow fragments.
- Allow interruptions.
- Allow ellipses and dashes.

Do not rewrite dialogue voice unless the writer explicitly requests an AI/ITS suggestion.

## Parenthetical

Parentheticals give brief delivery/action context.

They should be enclosed in parentheses.

### Parenthetical Examples

| Typed | Auto-Formatted |
|---|---|
| `whispering` | `(whispering)` |
| `(beat)` | `(beat)` |
| `to Stephan` | `(to Stephan)` |
| `under his breath` | `(under his breath)` |

### Parenthetical Rules

1. If missing parentheses, add them.
2. Preserve lowercase unless proper nouns are present.
3. Keep parentheticals short.
4. If the parenthetical is too long, suggest converting it to Action.

Do not force a long parenthetical into parentheses if it clearly reads like Action.

## Transition

Transitions are editorial instructions.

They are uppercase and usually end with a colon.

### Transition Examples

| Typed | Auto-Formatted |
|---|---|
| `cut to` | `CUT TO:` |
| `fade out` | `FADE OUT:` |
| `fade in` | `FADE IN:` |
| `smash cut to` | `SMASH CUT TO:` |
| `match cut to` | `MATCH CUT TO:` |
| `dissolve to` | `DISSOLVE TO:` |

### Transition Rules

1. Uppercase the line.
2. Add trailing colon if missing.
3. Recognize common transitions.
4. Do not turn every line ending in `to` into a Transition.

## Shot

Shot blocks indicate camera emphasis or visual framing.

They are usually uppercase.

### Shot Examples

| Typed | Auto-Formatted |
|---|---|
| `close on` | `CLOSE ON` |
| `wide shot` | `WIDE SHOT` |
| `angle on the radio` | `ANGLE ON THE RADIO` |
| `insert - the key` | `INSERT - THE KEY` |
| `pov stephan` | `POV - STEPHAN` |

### Shot Rules

1. Uppercase the line.
2. Preserve visual intent.
3. Normalize obvious patterns such as `pov stephan` to `POV - STEPHAN`.
4. After Shot, Enter should create Action.

## Note

Notes are private writer/editor notes.

Auto-formatting should be minimal.

Do not uppercase notes.

Do not export notes into final screenplay by default.

## Paste and Import Auto-Formatting

When a writer pastes text or imports a rough script, the editor may run a batch formatter.

Batch formatting should produce a preview before committing major changes.

The user should be able to approve, edit, or reject the formatted import.

### Batch Detection Heuristics

- Lines starting with `INT` or `EXT` become Scene Heading.
- Short all-caps lines become Character or Transition depending punctuation.
- Lines ending with `:` and matching transition verbs become Transition.
- Lines inside parentheses after Character become Parenthetical.
- Lines following Character become Dialogue.
- Other lines become Action.

## Confidence Levels

Every auto-format decision should have confidence.

Recommended model:

```ts
type FormatDecision = {
  blockType: string;
  formattedText: string;
  confidence: "high" | "medium" | "low";
  reason: string;
  shouldApplyAutomatically: boolean;
};
```

### High Confidence

Apply automatically.

Examples:

- Scene Heading line begins with `int` or `ext`.
- Character block is explicitly selected.
- Transition block is explicitly selected.

### Medium Confidence

Suggest but do not force.

Examples:

- Short uppercase line could be Character.
- Lowercase line resembles a shot.
- Parenthetical is long and may be Action.

### Low Confidence

Do nothing.

Preserve writer text.

## Writer Control

The writer must always remain in control.

Required controls:

- Undo should reverse auto-formatting.
- User can change block type manually.
- User can edit formatted text immediately.
- Auto-formatting should not fight manual edits.
- If the writer changes a format back, do not auto-apply the same correction repeatedly.

## Mobile Auto-Formatting

Mobile users may not have Tab.

Therefore:

- Toolbar type selection should trigger formatting for that block type.
- Return/Enter should trigger formatting before creating next block.
- Keyboard should remain open whenever possible.
- No formatting action should require a hardware keyboard.

## ITS/PfHU Integration Later

Auto-formatting is not full AI coaching.

However, auto-formatting signals can feed ITS/PfHU later.

Track useful events such as:

- repeated manual correction from one block type to another
- frequent Scene Heading mistakes
- dialogue written inside Action blocks
- Character names typed inconsistently
- overuse of parentheticals
- long unbroken Action passages
- repeated formatting suggestion rejection

These signals can help the tutor understand what the writer needs to learn.

Example coaching:

> You often type speaker names inside Action lines. Want a 60-second lesson on Character and Dialogue formatting?

## Future Editor Review Integration

Auto-formatting suggestions can become part of Editor Review Mode.

The writer should be able to review formatting fixes like:

- Change this line to Character.
- Convert this long parenthetical to Action.
- Normalize this Scene Heading.
- Fix this Transition.
- Split this Action paragraph.

Every suggestion must support:

- accept
- edit
- reject
- delete
- insert custom version

No suggestion should silently rewrite the final script without approval unless it is a high-confidence safe auto-format rule.

## Recommended Implementation Location

Create a pure helper module:

```text
src/components/editor/screenplayAutoFormat.ts
```

Recommended exports:

```ts
formatSceneHeading(text: string): string
formatCharacter(text: string): string
formatParenthetical(text: string): string
formatTransition(text: string): string
formatShot(text: string): string
formatBlockText(blockType: string, text: string): string
analyzeFormat(text: string, context: FormatContext): FormatDecision
shouldAutoApply(decision: FormatDecision): boolean
```

Do not bury auto-formatting rules in route files.

Do not duplicate formatter logic in multiple components.

## Integration with Keymap

Before Enter creates the next block:

1. Format the current block if safe.
2. Save/update local state.
3. Compute next block type from screenplay structure.
4. Insert next local block.
5. Focus next block.

Order matters.

Example:

```text
int desert day
[Enter]
```

Expected:

1. Current block formats to `INT. DESERT - DAY`.
2. New block is Action.
3. Focus moves to Action.

## Acceptance Tests

Add these tests to editor acceptance testing:

1. `int desert day` + Enter becomes `INT. DESERT - DAY`, next block Action.
2. `ext street night` + Enter becomes `EXT. STREET - NIGHT`, next block Action.
3. Character block `stephan` + Enter becomes `STEPHAN`, next block Dialogue.
4. Parenthetical `whispering` + Enter becomes `(whispering)`, next block Dialogue.
5. Transition `cut to` + Enter becomes `CUT TO:`, next block Scene Heading.
6. Shot `close on` + Enter becomes `CLOSE ON`, next block Action.
7. Dialogue casing is preserved.
8. Action casing is preserved.
9. Formatting does not blur the textarea.
10. Formatting does not drop the first or last character.
11. Undo can reverse auto-formatting.
12. If the user rejects or edits a formatting decision, the editor does not keep fighting the writer.

## Final Rule

Auto-formatting should make an amateur feel guided and a professional feel respected.

It should teach without nagging, correct without interrupting, and never take authorship away from the writer.
