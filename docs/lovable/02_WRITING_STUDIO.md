# 02_WRITING_STUDIO.md

# Writing Studio Specification

## Purpose

The Writing Studio is the heart of ScreenPlay Pro.

The user must be able to open a project and immediately understand where to write.

The editor is not a side panel. It is not a hidden modal. It is the main product surface.

## Stage 1 Goal

Stage 1 must make writing work before building advanced features.

The user should be able to:

1. Open a project.
2. See a professional writing workspace.
3. Click the screenplay page and type.
4. Use screenplay block transitions naturally.
5. Save without losing focus.
6. Refresh and recover the script.

## Required Layout

Use a three-zone layout:

```text
Top bar:
  project title, save status, mode toggle placeholder, export placeholder

Left sidebar:
  scenes, characters, notes

Center:
  screenplay page/editor

Right sidebar:
  scene info, character info, future AI/help area
```

The center editor must be visually dominant.

## Editor Behavior

Required behavior:

- click page and type
- Enter creates the next logical screenplay block
- Tab changes block type and keeps focus
- Shift+Tab cycles backward
- Shift+Enter creates soft newline for Action and Note blocks
- click below final block creates a writable line
- no focus stealing
- no caret jumps
- no first-character loss
- no duplicate blocks
- no deleted blocks unless user intentionally deletes

## Block Types

Supported block types:

```text
scene_heading
action
character
dialogue
parenthetical
transition
shot
note
```

## Enter Transitions

```text
scene_heading -> action
action -> action
character -> dialogue
dialogue -> character
parenthetical -> dialogue
transition -> scene_heading
shot -> action
note -> action
```

## Tab Cycle

```text
Scene Heading
Action
Character
Dialogue
Parenthetical
Transition
Shot
Note
```

Shift+Tab cycles backward.

## Local-First Requirement

Typing must be local-first.

Correct path:

```text
User input -> local state -> rendered page -> background sync
```

Never block typing on Supabase.

Never use Supabase IDs as React keys.

Each block must have:

```ts
type LocalBlock = {
  id: string;
  serverId?: string;
  block_type: string;
  content: string;
  order_index: number;
  metadata?: Record<string, unknown>;
  status: "clean" | "dirty" | "saving" | "error";
};
```

## Scene Navigator

The left scene navigator should display scenes derived from `scene_heading` blocks or saved `scenes` records.

Stage 1 behavior can be simple:

- show scene list
- allow selecting a scene
- allow adding a scene
- scroll/focus editor to selected scene when possible

Do not overbuild drag-and-drop in Stage 1.

## Character Panel

Stage 1 character panel can be simple:

- list characters
- add character
- edit basic name/description
- later connect to dialogue and Character Bible

Do not build full Character Bible until the editor works.

## Notes Panel

Stage 1 notes can be simple:

- project note
- scene note placeholder
- future notes integration

Do not let notes steal editor focus during typing.

## Save Status

Show quiet save status:

- Saved
- Saving
- Offline / local changes pending
- Error saving; local copy preserved

Save status must not remount editor blocks.

## Acceptance Test

The acceptance test from `AGENTS.md` is mandatory.

Stage 1 is not complete until that test passes.

## Do Not Build in This Stage

Do not build:

- advanced AI buttons
- Pitch Deck system
- Table Read Studio
- Academy polish
- full Writers' Room collaboration
- storyboard
- media export
- production scheduling

## Success Standard

A writer should feel:

> I opened the app, and I am inside my movie.
