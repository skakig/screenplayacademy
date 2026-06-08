# SCREENPLAY_EDITOR_CONTRACT.md

## Purpose

This document defines the required behavior for the SceneSmith screenplay writing engine.

The editor must feel like a professional screenplay page, not a database form, block manager, or preview component.

## Product Standard

The user must be able to write a screenplay naturally.

The editor must support:

- continuous writing
- screenplay block transitions
- stable focus
- stable caret
- local-first state
- background persistence
- refresh recovery
- offline-tolerant drafts

## Core User Feeling

The user should feel:

> I can actually write my screenplay here.

The user should never feel:

> I am operating database rows.

## Local-First Rule

Typing must update local state synchronously.

No writing action may wait for:

- Supabase
- React Query
- network timing
- optimistic server IDs
- cache invalidation
- AI response

## Screenplay Line Model

Each line is a screenplay block.

Valid block types:

- scene_heading
- action
- character
- dialogue
- parenthetical
- transition
- shot
- note

Each block has:

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

`id` is a stable local ID.

`serverId` is the Supabase row ID.

React keys must use `id`, not `serverId`.

## First Load

When the editor opens:

If server blocks exist:

- hydrate them into local blocks
- assign stable local IDs
- keep server IDs separately
- focus the first block or last edited block

If server blocks do not exist:

- create one local `scene_heading` block
- focus it immediately
- allow typing immediately
- insert into Supabase in the background

## Enter Behavior

Enter creates the next screenplay block unless Shift+Enter is allowed.

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

After pressing Enter:

- insert a local block immediately
- focus the new block immediately
- do not wait for server
- do not remount the previous block
- do not move the caret unexpectedly

## Dialogue Flow

Dialogue flow must be natural.

Required sequence:

```text
STEPHAN
Just a few more clicks.

COMMANDER
You are lost, soldier.
```

Keystroke sequence:

1. Set current block to Character.
2. Type `STEPHAN`.
3. Press Enter.
4. New block is Dialogue.
5. Type dialogue.
6. Press Enter.
7. New block is Character.
8. Type next speaker.
9. Press Enter.
10. New block is Dialogue.

This must work without touching the mouse.

## Tab Behavior

Tab must not leave the screenplay editor while a screenplay line is focused.

Tab cycles block type forward.

Shift+Tab cycles block type backward.

Focus stays in the same line.

Cycle order:

1. scene_heading
2. action
3. character
4. dialogue
5. parenthetical
6. transition
7. shot
8. note

## Shift+Enter

Shift+Enter creates a soft newline only for:

- action
- note

For all other block types, Shift+Enter should behave consistently and not break focus.

## Click Behavior

Click inside an existing line:

- focus that line
- place caret at the click/caret position when possible

Click below the last line:

- create a new local block immediately
- focus it
- accept typing immediately

Do not use a ghost button or fake editable div.

## Slash Commands

Typing `/` inside a line opens a slash command menu.

Menu choices:

- Scene Heading
- Action
- Character
- Dialogue
- Parenthetical
- Transition
- Shot
- Note

Selecting a slash command:

- removes slash text
- changes current block type or inserts a new block, depending context
- preserves focus
- does not lose typed text

The slash menu must not steal writing focus.

## Smart Formatting

Smart formatting should help without interrupting.

Examples:

`int desert day` → `INT. DESERT - DAY`

`ext. street night` → `EXT. STREET - NIGHT`

`cut to:` → `CUT TO:`

`fade out` → `FADE OUT:`

Rules:

- smart formatting must not blur the field
- smart formatting must not move the caret unexpectedly
- smart formatting must not overwrite longer intentional text

## Background Save

Save behavior:

- debounce edits 500–800ms
- save dirty blocks in background
- coalesce repeated edits
- status is per-block internally and aggregated in UI
- failed save does not block writing
- retry failed saves
- preserve unsaved local state in localStorage

## Server Echo Guard

Server data may update local state only when the local block is:

- not active
- not dirty
- not saving
- not in error state

Local typing always wins.

## React Query

React Query may fetch initial blocks and receive background cache patches.

React Query must not be used as the active writing state.

Do not invalidate `['blocks', projectId]` during active typing.

Patch cache in place after successful saves so downstream panels can update.

## Required Editor Lab

Before integrating into the full app, create a local-only test route:

`/editor-lab`

The lab route must prove the editor works without Supabase.

It should render the same editor engine with local mock persistence.

Acceptance test must pass in `/editor-lab` before production integration.

## Production Integration

After `/editor-lab` passes:

- integrate the same local-first engine into `/editor/:projectId`
- keep CoachPane, StoryNavigator, StoryBuilder, and FeatureDock as surrounding tools
- do not let side panes own typing state
- do not let toolbar steal focus
- do not reintroduce route-owned block mutation machinery

## Definition of Done

The editor is done only when the manual acceptance test passes:

1. New project opens with focused scene-heading line.
2. Type `int african desert day`.
3. First character appears.
4. Press Enter.
5. New line is Action.
6. Type action.
7. Press Enter.
8. Tab cycles current line to Character.
9. Type `STEPHAN`.
10. Press Enter.
11. New line is Dialogue.
12. Type dialogue.
13. Press Enter.
14. New line is Character.
15. Continue for 30 seconds.
16. No focus loss.
17. No caret jump.
18. No duplicate blocks.
19. Refresh restores content.
20. Network failure does not stop local typing.

## Non-Negotiable Rule

No new product features until this passes.

The screenplay editor is the product.
