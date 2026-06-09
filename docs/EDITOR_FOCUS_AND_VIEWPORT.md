# EDITOR_FOCUS_AND_VIEWPORT.md

## Purpose

This document defines how SceneSmith keeps the active writing line visible, centered, and easy to return to while writing or editing.

A screenplay editor must protect the writer's attention. If the writer has to stop, scroll, hunt for the caret, or wonder where the current line went, the editor breaks creative flow.

## Prime Rule

The active writing line should remain in a comfortable focus zone while the writer types.

When the writer presses Enter and creates new blocks, the document should move around the writer.

The writer should not feel like they are chasing the bottom of the page.

In practical terms:

```text
Typing continues downward logically.
The page scrolls upward physically.
The active line stays near the visual center/focus zone.
```

## Product Feeling

The user should feel:

> I always know where I am, and I can keep writing without stopping to manage the page.

The user should never feel:

> I have to scroll every few lines just to see what I am writing.

## Focus Zone

Define a viewport focus zone for the active screenplay line.

Recommended desktop focus zone:

- active line should sit between 40% and 60% of the visible editor viewport height
- ideal target: roughly 48% from the top of the visible editor area

Recommended mobile focus zone:

- active line should sit above the software keyboard
- active line should remain in the upper-middle visible area of the paper
- never hide active text behind the keyboard, toolbar, sticky footer, or browser chrome

## Auto-Progress Scroll Behavior

When a new block is inserted by Enter:

1. Create the next local block.
2. Focus the new block.
3. Measure the active line's position relative to the editor viewport.
4. Smoothly scroll the editor container so the active line returns to the focus zone.
5. Do not scroll the entire browser page unless the editor has no internal scroll container.

This should feel like the manuscript page is making room for the writer.

## Do Not Jump

Auto-progress should be smooth and subtle.

Do not:

- snap violently
- scroll on every keystroke
- change selection or caret
- blur the textarea
- fight the user while they manually scroll
- hide the current line under fixed UI

## When Auto-Scroll Runs

Auto-scroll may run after:

- Enter creates a new block
- clicking below the last line creates a block
- slash command inserts a block
- mobile toolbar changes type and Return moves to a new block
- jump-to-scene or jump-to-block navigation
- accepting an editor suggestion that inserts or replaces a block

Auto-scroll should generally not run on every normal character typed.

Exception: if the active line grows taller due to wrapping and begins to fall below the focus zone, the editor may gently correct the scroll position.

## Manual Scroll Respect

The writer may intentionally scroll up to edit earlier text.

If the writer scrolls manually:

- do not immediately force the viewport back to the active line
- preserve manual scroll intent
- allow clicking an earlier line to make it active
- once a line is active and typing resumes, focus-zone behavior may resume for that active line

Recommended rule:

If the user manually scrolls without changing active line, suspend auto-follow for about 1500ms.

If the user clicks or focuses a line, that line becomes the new active focus target.

## Editing Earlier Text

The editor must make it easy to go back and edit.

Required behavior:

- clicking an earlier line focuses it
- the editor scrolls just enough to keep that line visible
- editing earlier text does not force the viewport back to the bottom
- Enter from that earlier line inserts the next block at that location, not at the document end
- after insertion, the new active line enters the focus zone

## Keyboard Navigation

The editor should support moving through blocks without losing focus.

Recommended behavior:

- ArrowUp at the start of a block moves to the previous block if appropriate
- ArrowDown at the end of a block moves to the next block if appropriate
- Shift+Tab cycles block type backward and keeps focus
- Tab cycles block type forward and keeps focus
- Escape closes menus but returns focus to the active line when possible

These actions should keep the active block visible in the focus zone.

## Mobile Keyboard Behavior

Mobile is different because the software keyboard reduces the visible viewport.

When mobile keyboard is open:

- use `visualViewport` if available to calculate the visible area
- keep the active line above the keyboard
- keep inline toolbars from covering the active line
- avoid fixed footer controls overlapping the paper
- avoid scroll jumps caused by browser chrome resizing

The active line should never sit underneath:

- iOS keyboard
- suggestion bar
- mobile block-type toolbar
- fixed bottom command bar
- browser address bar overlays

## Scroll Container Rule

Prefer a dedicated editor scroll container rather than the whole browser window.

Recommended layout:

```text
App Shell
  Left pane / navigator
  Editor viewport scroll container
    Screenplay paper
  Right pane / coach
```

The editor viewport should own screenplay scrolling.

Side panels should not scroll the screenplay document.

## Writing Modes

The editor can support different focus behaviors.

### Normal Mode

- active line kept comfortably visible
- less aggressive centering
- easier to browse surrounding text

### Focus Mode

- active line stays close to center
- non-active UI becomes quieter
- side panels may collapse or dim
- best for drafting

### Review Mode

- less auto-centering
- easier to compare original and suggested text
- suggestions remain visible
- best for editing and ITS/PfHU review

## Implementation Guidance

Recommended helper:

```text
src/components/editor/useActiveLineViewport.ts
```

Possible API:

```ts
type ActiveLineViewportOptions = {
  containerRef: React.RefObject<HTMLElement>;
  activeLineRef: React.RefObject<HTMLElement>;
  mode: "normal" | "focus" | "review";
  isMobile: boolean;
  keyboardVisible?: boolean;
};

function scrollActiveLineIntoFocusZone(options: ActiveLineViewportOptions): void;
```

Recommended behavior:

1. Get editor container rect.
2. Get active line rect.
3. Calculate ideal Y position.
4. Calculate delta.
5. Scroll container by delta using smooth scroll unless reduced motion is enabled.
6. Clamp so the document does not overscroll awkwardly.

## Reduced Motion

Respect user accessibility settings.

If `prefers-reduced-motion` is enabled:

- avoid smooth animated scrolling
- use minimal immediate positioning
- do not add decorative movement

## Focus and Selection Safety

Viewport management must not affect typing state.

It must not:

- blur the textarea
- remount the line
- change the React key
- reset selection range
- delete text
- duplicate blocks
- trigger persistence writes by itself

Scrolling is visual only.

## Interaction with Suggestions and ITS/PfHU

Future ITS/PfHU editor review will add suggestions, inline cards, and proposed rewrites.

The viewport system must support this without stealing authorship.

When a suggestion is selected:

- scroll it into view
- keep original and suggested text visible if possible
- allow accept, edit, reject, delete, or custom rewrite
- return focus to the correct screenplay line after action

When the writer accepts a suggestion that inserts or changes text:

- place the edited or inserted block in the focus zone
- do not jump to unrelated document areas

## Beginner Guidance

A small UI indicator may explain focus behavior to beginners.

Example:

```text
Focus follows your active line so you can keep writing without chasing the cursor.
```

This should be optional and dismissible.

Do not clutter the writing page with instructions.

## Acceptance Tests

### Test 1 — Active Line Stays Visible

1. Open the editor.
2. Write enough lines to exceed the visible paper area.
3. Press Enter repeatedly while typing.

Expected:

- active line remains visible
- active line does not fall behind bottom toolbar or keyboard
- writer does not need to manually scroll to continue typing

### Test 2 — Active Line Focus Zone

1. Write 20+ blocks.
2. Continue pressing Enter and writing.

Expected:

- active line remains near the center or upper-middle focus zone
- page scrolls upward as writing advances
- no sudden jumps occur

### Test 3 — Edit Earlier Text

1. Scroll upward manually.
2. Click an earlier block.
3. Edit the line.
4. Press Enter.

Expected:

- editor does not jump back to the bottom
- insertion happens after the edited line
- new active line stays visible

### Test 4 — Mobile Keyboard Visibility

1. Open editor on iPhone.
2. Tap a line near the lower paper area.
3. Keyboard opens.
4. Type and press Return multiple times.

Expected:

- active line remains above the keyboard
- visible caret is not covered
- bottom command bar does not cover active text

### Test 5 — Suggestion Review Focus

Future test for Editor Review Mode:

1. Select a suggested rewrite.
2. Accept or edit it.

Expected:

- changed block scrolls into view
- focus returns to the correct line
- suggestions do not disorient the writer

## Final Rule

The writer should never have to chase the cursor.

The page should move to protect creative focus.

If scrolling breaks attention, the editor is not yet writer-first.
