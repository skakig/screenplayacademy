# EDITOR_ACCEPTANCE_TESTS.md

## Purpose

This document defines the manual acceptance tests for the SceneSmith screenplay editor.

The editor is not done when the code compiles.

The editor is done when a writer can open the page and write naturally without focus loss, caret jumps, duplicate blocks, dropped characters, or save interruptions.

## Test Environment

Run these tests first in:

```text
/editor-lab
```

Only after `/editor-lab` passes should the same tests be run in:

```text
/editor/:projectId
```

## Global Pass Criteria

Every test must pass with:

- no first-character loss
- no blur
- no caret jump
- no duplicate blocks
- no accidental block deletion
- no toolbar or side panel stealing focus
- no requirement to click helper buttons before typing
- no dependency on network timing for typing

## Test 1 — First Load Typing

### Steps

1. Open a brand-new editor session.
2. Do not click any editor buttons.
3. Type:

```text
int african desert day
```

### Expected

- The first character `i` appears.
- The caret remains in the line.
- The line is editable immediately.
- The editor does not require clicking “Start typing.”
- The line is or becomes a Scene Heading.

## Test 2 — Scene Heading to Action

### Steps

1. Start with a Scene Heading block containing:

```text
INT. AFRICAN DESERT - DAY
```

2. Press Enter.
3. Type:

```text
The sun burns across an endless sea of sand.
```

### Expected

- Enter creates a new Action block.
- Focus lands in the new Action block immediately.
- The typed sentence appears completely.
- No character is dropped.

## Test 3 — Action to Action

### Steps

1. With the Action block focused, press Enter.
2. Type:

```text
A lone soldier stumbles over a dune.
```

### Expected

- Enter creates another Action block.
- Focus stays in the screenplay page.
- Typing continues naturally.

## Test 4 — Tab Cycles Block Type

### Steps

1. Focus any screenplay line.
2. Press Tab repeatedly.
3. Press Shift+Tab repeatedly.

### Expected

- Tab does not move browser focus to a button or toolbar.
- Tab cycles block type forward.
- Shift+Tab cycles backward.
- Focus remains in the same line.
- Caret remains visible.

## Test 5 — Character to Dialogue

### Steps

1. Use Tab or slash command to set current line to Character.
2. Type:

```text
STEPHAN
```

3. Press Enter.
4. Type:

```text
Just a few more clicks.
```

### Expected

- Character line formats as Character.
- Enter creates Dialogue.
- Dialogue text appears in the new line.
- Focus stays in the editor.

## Test 6 — Dialogue to Character to Dialogue

### Steps

1. After typing dialogue, press Enter.
2. Type:

```text
COMMANDER
```

3. Press Enter.
4. Type:

```text
You are lost, soldier.
```

### Expected

- Dialogue + Enter creates Character.
- Character + Enter creates Dialogue.
- The sequence works without touching the mouse.

Expected formatted flow:

```text
STEPHAN
Just a few more clicks.

COMMANDER
You are lost, soldier.
```

## Test 7 — Click Below Last Line

### Steps

1. Click the empty paper area below the last screenplay line.
2. Type a sentence.

### Expected

- A real editable local block is created immediately.
- The first typed character appears.
- There is no ghost button.
- There is no second-click requirement.

## Test 8 — Slash Commands

### Steps

1. Focus a screenplay line.
2. Type `/`.
3. Choose `Dialogue` or `Character` from the slash menu.

### Expected

- Slash menu opens.
- Textarea focus is preserved.
- Selecting a command changes or inserts the correct block type.
- Typed text is not lost.

## Test 9 — Smart Formatting

### Steps

1. In a Scene Heading line, type:

```text
int desert day
```

2. Trigger formatting by pressing Enter or leaving the line.

### Expected

The line becomes:

```text
INT. DESERT - DAY
```

No blur, caret jump, or dropped text occurs.

## Test 10 — Sustained Typing

### Steps

1. Write continuously for 30 seconds.
2. Use Enter and Tab several times.
3. Write at least one Character → Dialogue → Character → Dialogue exchange.

### Expected

- No caret jump.
- No field blur.
- No duplicate blocks.
- No deleted blocks.
- No lost keystrokes.
- Editor remains responsive.

## Test 11 — Refresh Recovery

### Steps

1. Write several screenplay blocks.
2. Wait for save status or local draft persistence.
3. Refresh the page.

### Expected

- All content remains available.
- Block types are preserved.
- Order is preserved.
- No duplicate content is created.

## Test 12 — Network Failure Tolerance

### Steps

1. Throttle or disable network.
2. Keep typing.
3. Add several blocks.
4. Restore network.

### Expected

- Typing never stops.
- Local state remains intact.
- Save status may show Error or Offline.
- Once network returns, sync resumes.
- No content is lost.

## Test 13 — Toolbar Does Not Steal Focus

### Steps

1. Focus a line and type text.
2. Use toolbar controls if present.
3. Continue typing.

### Expected

- The toolbar does not permanently steal focus.
- The editor returns focus to the correct line.
- The caret remains stable.

## Test 14 — Final Remaining Block Safety

### Steps

1. Delete or backspace empty blocks until only one block remains.
2. Press Backspace on the empty final block.

### Expected

- The final block is not removed.
- It remains focused.
- The editor never becomes an empty non-editable surface.

## Complete Manual Script

Run this full script as a final test:

```text
int african desert day
[Enter]
The sun burns across an endless sea of sand.
[Enter]
A lone soldier stumbles over a dune.
[Tab until Character]
STEPHAN
[Enter]
Just a few more clicks.
[Enter]
COMMANDER
[Enter]
You are lost, soldier.
```

Expected:

- The flow writes naturally.
- Character and dialogue transitions work.
- No mouse is needed.
- No focus is lost.
- No text disappears.

## Definition of Done

The screenplay editor is accepted only when all tests pass in `/editor-lab` and then in production `/editor/:projectId`.

If any test fails, do not add new product features.

Fix the writing engine first.
