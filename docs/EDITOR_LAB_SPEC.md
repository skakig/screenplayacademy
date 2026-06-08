# EDITOR_LAB_SPEC.md

## Purpose

`/editor-lab` is the proving ground for the SceneSmith screenplay writing engine.

The lab exists to prove the editor works locally before touching the production `/editor/:projectId` route.

The screenplay editor must be validated in isolation first so Lovable does not burn credits rewriting the full app while the core writing surface remains broken.

## Prime Rule

The editor lab must prove writing works before production integration.

No Supabase.  
No React Query persistence.  
No CoachPane.  
No StoryPulse.  
No Academy.  
No storyboard.  
No table read.  
No pitch tools.  
No AI buttons.

Only the screenplay writing engine.

## Route

Create a route:

```text
/editor-lab
```

This route should render a single centered screenplay page using the same visual language as the production editor.

The lab may include a minimal header explaining that it is a local-only editor test, but the page itself must be the focus.

## Required Components

The lab should use or create the same core components intended for production:

- `src/components/editor/useScreenplayDocument.ts`
- `src/components/editor/ScreenplayDocumentEditor.tsx`
- `src/components/editor/ScreenplayLine.tsx`
- `src/components/editor/screenplayKeymap.ts`

Persistence should be mocked locally for Pass 1.

Do not wire Supabase in Pass 1.

## Local Block Model

Each screenplay line must use a stable local block model:

```ts
type LocalBlock = {
  id: string;
  serverId?: string;
  block_type: string;
  content: string;
  order_index: number;
  metadata?: any;
  status: "clean" | "dirty" | "saving" | "error";
};
```

In `/editor-lab`, `serverId` may remain undefined.

React keys must use `block.id`, where `block.id` is a stable local ID that never changes.

## Initial State

When `/editor-lab` opens:

- Create one local `scene_heading` block immediately.
- Focus it immediately.
- Show the caret.
- Allow the user to type without clicking any buttons.

There should be no fake ghost row, no role button, and no “Start typing” button.

## Required Keyboard Behavior

### Enter

Enter creates the next screenplay block locally and focuses it immediately.

Rules:

| Current Block | Enter Creates |
|---|---|
| scene_heading | action |
| action | action |
| character | dialogue |
| dialogue | character |
| parenthetical | dialogue |
| transition | scene_heading |
| shot | action |
| note | action |

### Tab

Tab cycles the current block type forward and keeps focus in the same line.

### Shift+Tab

Shift+Tab cycles backward and keeps focus in the same line.

### Shift+Enter

Shift+Enter creates a soft newline only for:

- action
- note

### Backspace

Backspace on an empty block should delete that block and focus the previous block.

Never delete the final remaining block. If only one block remains, clear it and keep focus.

## Required Mouse Behavior

Clicking inside an existing line focuses that line.

Clicking below the last line creates a new local block immediately and focuses it.

The click-below-last-line behavior must not depend on a ghost button or invisible fake editor.

## Slash Commands

Typing `/` inside a line should open a slash command menu.

Supported commands:

- Scene Heading
- Action
- Character
- Dialogue
- Parenthetical
- Transition
- Shot
- Note

The slash menu must not steal textarea focus.

Selecting a command must preserve text and focus.

## Smart Formatting

The lab should support basic screenplay smart formatting without interrupting typing.

Examples:

- `int desert day` → `INT. DESERT - DAY`
- `ext street night` → `EXT. STREET - NIGHT`
- `cut to` → `CUT TO:`
- `fade out` → `FADE OUT:`

Smart formatting must not blur the field or jump the caret.

## Visual Standard

Use the existing cinematic paper look:

- centered screenplay page
- warm off-white paper
- dark desk/canvas background
- screenplay monospace font
- professional screenplay block spacing

The lab should feel like a real writing page, not a form.

## Explicit Non-Goals

Do not add:

- Supabase persistence
- project loading
- authentication
- CoachPane
- Story Navigator
- Story Builder
- FeatureDock
- table read
- storyboard
- Academy
- AI generation
- pitch package
- pricing

## Pass 1 Definition of Done

`/editor-lab` is done when:

1. It opens with a focused scene-heading line.
2. The user can type immediately.
3. Enter creates the correct next block.
4. Tab and Shift+Tab cycle block type and keep focus.
5. Character → Dialogue → Character → Dialogue works naturally.
6. Click below last line creates and focuses a real editable line.
7. Slash commands work without stealing focus.
8. Autosize works.
9. 30 seconds of sustained typing causes no caret jump, remount, duplicate blocks, or accidental deletion.

## Final Instruction

Do not integrate into the production editor until `/editor-lab` passes the acceptance test.
