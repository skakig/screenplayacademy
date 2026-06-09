# SCREENPLAY_STRUCTURE.md

## Purpose

This document defines how SceneSmith understands screenplay structure at the editor level.

The editor must not merely store blocks. It must understand what each block means, what should usually come next, and how a writer naturally moves through a script.

The screenplay editor should feel intelligent, predictable, and writer-first.

## Prime Rule

The editor should always help the writer continue the screenplay naturally.

A screenplay page is not a generic text document and not a database form.

It is a structured writing instrument.

When the writer presses Enter, Tab, Shift+Tab, clicks a block type, or accepts a suggestion, the editor should infer the most likely next screenplay element.

## Core Block Types

SceneSmith supports these screenplay block types:

1. `scene_heading`
2. `action`
3. `character`
4. `dialogue`
5. `parenthetical`
6. `transition`
7. `shot`
8. `note`
9. `suggestion` future/editor-review only

Only the first eight are normal screenplay writing blocks.

`suggestion` is reserved for future ITS/PfHU/editor review workflows and should not export as final screenplay unless approved by the writer.

## Block Type Meanings

### Scene Heading

A scene heading establishes location and time.

Examples:

```text
INT. AFRICAN DESERT OUTPOST - DAY
EXT. ODESSA TRAIN STATION - NIGHT
INT./EXT. TRUCK - MOVING - DAWN
```

A scene heading should normally be followed by Action.

Pressing Enter from a Scene Heading should create an Action block.

Never default from Scene Heading to another Scene Heading.

### Action

Action describes what the audience sees or hears.

Examples:

```text
The sun burns across an endless sea of sand.
A lone soldier stumbles over a dune.
A radio crackles in the distance.
```

Action normally continues as Action, unless the writer explicitly chooses Character, Scene Heading, Shot, Transition, or another type.

Pressing Enter from Action should create another Action block by default.

### Character

A Character block identifies the speaker.

Examples:

```text
STEPHAN
COMMANDER
MARIA
```

A Character block should normally be followed by Dialogue.

Pressing Enter from Character must create a Dialogue block.

This is non-negotiable.

If the writer clicks or tabs to Character, types a name, and presses Enter, the next line should be Dialogue.

### Dialogue

Dialogue is what a character says.

Example:

```text
Just a few more clicks.
```

Dialogue normally alternates back to Character after Enter.

Pressing Enter from Dialogue should create a Character block by default.

The normal conversation flow is:

```text
STEPHAN
Just a few more clicks.

COMMANDER
You are lost, soldier.
```

### Parenthetical

Parenthetical gives brief delivery/action context inside dialogue.

Examples:

```text
(whispering)
(beat)
(to Stephan)
```

A Parenthetical should normally be followed by Dialogue.

Pressing Enter from Parenthetical should create Dialogue.

Parentheticals should not become the default after Dialogue unless the writer explicitly selects them.

### Transition

Transition indicates an editorial transition.

Examples:

```text
CUT TO:
FADE OUT:
SMASH CUT TO:
```

A Transition should normally be followed by a Scene Heading.

Pressing Enter from Transition should create Scene Heading.

### Shot

Shot indicates a camera or visual emphasis.

Examples:

```text
CLOSE ON
WIDE SHOT
ANGLE ON THE RADIO
```

A Shot should normally be followed by Action.

Pressing Enter from Shot should create Action.

### Note

Note is a private writer/editor note.

Notes do not export into the final screenplay by default.

Pressing Enter from Note should create Action.

## Required Enter Logic

The default Enter behavior must be:

| Current Block | Enter Creates | Why |
|---|---|---|
| `scene_heading` | `action` | A scene heading needs visual action next. |
| `action` | `action` | Action usually continues until speaker/scene changes. |
| `character` | `dialogue` | A character name exists to introduce speech. |
| `dialogue` | `character` | Dialogue usually alternates to another speaker. |
| `parenthetical` | `dialogue` | Parenthetical modifies the next spoken line. |
| `transition` | `scene_heading` | A transition usually leads to the next scene. |
| `shot` | `action` | A shot needs visual description/action. |
| `note` | `action` | Notes are private; return to manuscript writing. |

## Required Dialogue Flow

The editor must support this flow without mouse use:

```text
[Character] STEPHAN
[Enter]
[Dialogue] Just a few more clicks.
[Enter]
[Character] COMMANDER
[Enter]
[Dialogue] You are lost, soldier.
```

If this does not work, the screenplay editor is not acceptable.

## Empty Block Rules

Empty blocks require intelligent behavior.

### Empty Scene Heading

If an empty Scene Heading is focused and the writer presses Enter:

- Do not create another Scene Heading.
- Convert or advance to Action if the writer is trying to continue.
- If it is the only block, keep one editable block and do not create a dead blank page.

### Empty Character

If the writer changes a line to Character and presses Enter without typing a name:

- Keep focus in Character or show a subtle prompt.
- Do not create Dialogue with no speaker unless the writer explicitly confirms.

If the Character block has content and Enter is pressed:

- Create Dialogue immediately.

### Empty Dialogue

If Dialogue is empty and Enter is pressed:

- Prefer returning to Character only if the previous block is a valid Character.
- Otherwise create Action.

### Empty Final Block

Never delete the final remaining block.

If Backspace is pressed on the final empty block:

- keep the block
- reset it to Scene Heading or Action depending context
- keep focus visible

The editor must never become an empty non-editable surface.

## Tab and Shift+Tab Logic

Tab and Shift+Tab are not browser navigation while writing.

When a screenplay line is focused:

- Tab changes the current block type forward.
- Shift+Tab changes the current block type backward.
- Focus remains in the same line.
- The caret remains visible.

Cycle order:

1. `scene_heading`
2. `action`
3. `character`
4. `dialogue`
5. `parenthetical`
6. `transition`
7. `shot`
8. `note`

Shift+Tab should allow the writer to move backward through this type cycle to correct a mistake.

Example:

If the user accidentally makes a line Dialogue, Shift+Tab should allow them to cycle back to Character or Action without leaving the page.

## Mobile Equivalent for Tab

Mobile keyboards may not expose Tab.

Therefore, the inline block-type toolbar must provide the same function as Tab/Shift+Tab.

On mobile:

- tapping Character changes the focused line to Character
- typing a name and pressing Return creates Dialogue
- tapping Action changes the focused line to Action
- the keyboard should remain available whenever possible

## Shift+Enter Logic

Shift+Enter creates a soft newline only inside:

- Action
- Note

For all other block types, Shift+Enter should behave consistently and should not break focus.

Dialogue should normally use Enter to create the next Character, not soft line breaks.

## Click and Insert Logic

The writer must always be able to insert structure intentionally.

Required actions:

- Click existing line: focus that line.
- Click below last line: create the next logical block and focus it.
- Click block type toolbar: change current line type and keep focus.
- Slash command: insert or change type intelligently and keep focus.

Do not use fake ghost editor rows.

Do not require the writer to press a utility button before writing.

## Slash Command Logic

Typing `/` inside a line opens a command menu.

Commands:

- `/scene` → Scene Heading
- `/action` → Action
- `/character` → Character
- `/dialogue` → Dialogue
- `/parenthetical` → Parenthetical
- `/transition` → Transition
- `/shot` → Shot
- `/note` → Note

When selected:

- If the current line only contains the slash command, change the current line type.
- If the current line has meaningful content before the slash command, insert a new block after the current line.
- Preserve focus.
- Do not lose text.

## Smart Formatting Rules

Smart formatting should assist without interrupting.

Examples:

| Typed | Result |
|---|---|
| `int desert day` | `INT. DESERT - DAY` |
| `ext street night` | `EXT. STREET - NIGHT` |
| `int./ext truck moving dawn` | `INT./EXT. TRUCK - MOVING - DAWN` |
| `cut to` | `CUT TO:` |
| `fade out` | `FADE OUT:` |
| `close on` | `CLOSE ON` |

Rules:

- Smart formatting must not blur the field.
- Smart formatting must not move the caret unexpectedly.
- Smart formatting must not overwrite long intentional text.
- Smart formatting should happen on Enter, blur, or explicit type conversion.

## Screenplay Intelligence Layer

The editor should eventually understand local screenplay context.

Useful context includes:

- previous block type
- next block type
- current scene
- current speaking character
- recent dialogue exchange
- current character arc state
- whether the line is writer-authored, AI-suggested, or approved

This context enables smarter decisions later.

## Future ITS/PfHU Integration

The Character Bible and ITS/PfHU layer should eventually connect to the screenplay editor through suggestions, not forced rewrites.

The editor should support reviewable suggestions.

A future suggestion model may include:

```ts
type EditorSuggestion = {
  id: string;
  project_id: string;
  scene_id?: string;
  character_id?: string;
  target_block_id?: string;
  suggestion_type:
    | "replace_line"
    | "insert_after"
    | "delete_line"
    | "change_block_type"
    | "character_voice"
    | "moral_pressure"
    | "arc_consistency"
    | "dialogue_sharpening"
    | "formatting_fix";
  original_text?: string;
  suggested_text?: string;
  explanation?: string;
  status: "pending" | "accepted" | "edited" | "rejected" | "deleted";
};
```

The writer must be able to:

- review suggestions
- approve suggestions
- edit suggestions before accepting
- reject suggestions
- delete suggestions
- insert their own version

The AI/ITS/PfHU system must never silently rewrite the final screenplay without writer approval.

## Editor Review Mode

Future Editor Review Mode should allow the writer to re-read an improved version of the script with suggestions layered on top.

Requirements:

- suggestions are visually distinct from final screenplay text
- suggestions do not export unless accepted
- the writer can compare original vs suggested text
- the writer can accept/edit/reject one suggestion at a time
- the writer remains the author

## Character Bible Integration

When the Character Bible is active, it can inform editor suggestions.

Examples:

- Character voice is inconsistent.
- Dialogue does not match the character's wound, fear, education, or speech pattern.
- Character has not appeared in too many scenes.
- Character is morally flat under pressure.
- Character action contradicts established TMH stress behavior.
- Scene lacks a clear character objective.
- Dialogue exchange lacks conflict or subtext.

These should become reviewable coaching cards or inline suggestions, not forced edits.

## Required Implementation Location

This structure logic should live in pure, testable helpers.

Recommended file:

```text
src/components/editor/screenplayStructure.ts
```

This file should export functions such as:

```ts
nextTypeAfterEnter(currentType, context)
cycleType(currentType, direction)
shouldSoftNewline(blockType, event)
shouldKeepCharacterFocused(block)
shouldConvertEmptyBlock(block, context)
parseSlashCommand(content, cursorPosition)
normalizeSceneHeading(text)
normalizeTransition(text)
```

Do not bury screenplay structure rules inside route files.

Do not duplicate screenplay transition logic across components.

## Acceptance Tests to Add

Add structure-specific tests to the editor acceptance checklist:

1. Scene Heading + Enter → Action, never Scene Heading.
2. Character with name + Enter → Dialogue.
3. Dialogue + Enter → Character.
4. Parenthetical + Enter → Dialogue.
5. Transition + Enter → Scene Heading.
6. Shot + Enter → Action.
7. Empty final block cannot be deleted into a dead page.
8. Shift+Tab cycles backward without leaving the editor.
9. Mobile toolbar type selection behaves like Tab.
10. Suggestions cannot overwrite screenplay text without approval.

## Final Rule

A screenplay editor must understand screenplay structure.

If the app stores blocks but does not understand what should come next, it is not yet a smart screenplay writing app.
