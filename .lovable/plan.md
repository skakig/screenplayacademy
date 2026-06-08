## Goal

Rewrite the screenplay editor as a **local-first writing engine**. Typing, Enter, Tab, and block transitions must never depend on Supabase, React Query, optimistic temp IDs, or network timing. The DB becomes a background sync target, not part of the typing path.

## Root causes in current code

1. `ScreenplayDocumentEditor` renders each block with `key={b.id}` where `b.id` flips from `temp-*` to a Supabase UUID. That remounts the focused `BlockEditor`, killing caret/focus.
2. The trailing ghost is a `role="button"` div that only creates a block on focus/keystroke — it is not a real editable line.
3. Enter/Tab/slash live inside per-block `BlockEditor`. If focus is not exactly on a textarea (ghost, panels, toolbar), screenplay keymap is dead.
4. `addBlock` / `insertBlockAfter` mutate Supabase first, then juggle a `pendingTempContent` map and `setFocusBlockId(tempId→realId)`. The new line is reachable only after the insert mutation begins; first keystrokes are bridged by a fragile buffer.
5. The route file owns block creation, slash menu types, autoformat — pulling editor concerns into the page shell.

## New architecture

Three layers inside `src/components/editor/`:

```text
useScreenplayDocument (local-first state)
        │  localBlocks · activeBlockId · dirtyIds · saveStatus
        ▼
ScreenplayDocumentEditor (render + keymap dispatch)
        │  ScreenplayLine[] keyed by stable localId
        ▼
screenplayPersistence (background sync to Supabase)
```

### Files

- `src/components/editor/useScreenplayDocument.ts` — local-first hook (state + mutations + key handlers + sync queue).
- `src/components/editor/screenplayPersistence.ts` — insert/update/delete adapter against `script_blocks`, retry + debounce, returns serverId for a localId. No React Query writes on the critical typing path; the hook patches React Query cache after success.
- `src/components/editor/screenplayKeymap.ts` — pure helpers: `nextTypeAfterEnter`, `tabCycle`, `shouldSoftNewline`, slash parsing.
- `src/components/editor/ScreenplayLine.tsx` — one textarea + caret/selection management, autosize, focus on `isActive`, no DB calls.
- `src/components/editor/ScreenplayDocumentEditor.tsx` — thin: hydrate from `initialBlocks`, render `ScreenplayLine[]`, paper-click handler that calls `insertBlockAfter(last)` locally.
- `src/routes/_authenticated/editor.$projectId.tsx` — slim: project/blocks/characters fetch, layout, side panes, story builder wiring. Removes `Textarea`, `Select*`, `Trash2`, `Loader2`, `Command`, `CharacterAutocomplete`, `SceneBeatPicker`, `nextBlockTypeAfter`, `cycleType`, `detectBlockType`, `BLOCK_TYPES`, the `addBlock` / `insertBlockAfter` / `saveBlock` / `deleteBlock` / `pendingTempContent` / `inFlightSaves` machinery. Passes `initialBlocks` + callbacks to the editor and lets the hook own everything else.

### Local block model

```ts
type LocalBlock = {
  id: string;            // stable: "local-…" — used as React key forever
  serverId?: string;     // Supabase UUID once persisted
  block_type: string;
  content: string;
  order_index: number;
  metadata?: any;
  status: "clean" | "dirty" | "saving" | "error";
};
```

### Critical key rule

`<ScreenplayLine key={block.id} />` where `block.id` is the **localId** and never changes. `serverId` is stored separately and only used by the persistence adapter. This alone fixes most of the "caret dies, blur, duplicate block" symptoms.

### Hydration

On mount: map `initialBlocks` → `LocalBlock` with `id: "local-<uuid>"`, `serverId: row.id`. If `initialBlocks.length === 0`, create one local `scene_heading` immediately and set `activeBlockId` — caret is live before any DB round-trip.

### Typing path

`onChange` → `setLocalBlocks` (sync) → mark dirty → schedule debounced background sync. No awaits. No cache reads. Focused/dirty/saving blocks ignore server echoes.

### Enter / Tab / Shift+Enter / Backspace / slash

All handled in `useScreenplayDocument.handleKeyDown(blockId, e)` dispatched from `ScreenplayLine.onKeyDown`:

- **Enter**: prevent default, compute `nextTypeAfterEnter(current, prev)`, `insertBlockAfter(blockId, type)` locally, `setActiveBlockId(newLocalId)`. Transitions: scene→action, action→action, character→dialogue, parenthetical→dialogue, dialogue→character (override with prev=action ⇒ action), transition→scene_heading, shot→action, note→action.
- **Tab / Shift+Tab**: cycle current block type via `tabCycle(currentType, dir)`. Focus stays.
- **Shift+Enter**: soft newline in `action` / `note` only; otherwise behaves like Enter.
- **Backspace on empty**: delete block, focus previous.
- `**/**`: open slash menu (lifted into the line; uses `screenplayKeymap.parseSlashQuery`).

### Click below last line

`onMouseDown` on paper: if click below last `ScreenplayLine`, call `insertBlockAfter(lastId, nextType)` locally and focus it on the same tick. No ghost element. No `role="button"`.

### Background persistence

`screenplayPersistence` queue keyed by `localId`:

- New local block → `INSERT`; on success, set `serverId` (React state) but **do not change** `block.id` (localId stays).
- Existing block → debounced `UPDATE` keyed by `serverId`; coalesce content/type/metadata patches.
- Delete → `DELETE` by `serverId` (no-op if never persisted).
- Failures: keep block `status: "error"`, retain in localStorage draft, retry on next edit. Surface via existing `AutosaveIndicator`.
- On success, patch React Query `["blocks", projectId]` cache in place (for downstream readers like outline/manuscript analyzer) — never `invalidateQueries`.

### Server echo guard

The hook subscribes to `blocks` query results. Server rows are merged into local state **only** when, for that block: not active, not dirty, not saving, and `server.content !== local.content`. Match by `serverId`. Local always wins while writing.

### What stays the same

- `script_blocks` schema, RLS, and React Query keys — unchanged.
- `LoglineComposer`, Story Builder, Coach, Story Navigator, GuidedRail — unchanged; the route still composes them.
- `nextBlockTypeAfter` / `cycleType` / `detectBlockType` keep their pure logic but move under `screenplayKeymap.ts` (re-export or relocate; both work).
- `useWriterEvents` emissions for `block_created` / `scene_created` — kept, fired from the hook after local insert.
- Recovery banner + localStorage drafts — kept; reads/writes move into the persistence adapter.

### Removed

- Ghost `<div role="button">` line and `handleGhostActivate`.
- `pendingTempContent` / temp-id → real-id focus juggling.
- `setFocusBlockId` flow across the route ↔ editor boundary (focus is owned by `activeBlockId` inside the hook).
- Per-block flush + autosize duplicated in `BlockEditor`.

## Acceptance test (must pass before any further work)

1. New project → editor mounts with one focused scene-heading line. Type `int african desert day`. First character never lost; auto-format converts to Scene Heading without blur.
2. Enter → Action. Type a sentence. Enter → next Action.
3. Tab cycles type forward (Shift+Tab back), focus stays.
4. Character → Enter → Dialogue → Enter → Character → Enter → Dialogue, all without manual type switching.
5. 30s sustained typing with throttled network: no caret jump, no remount, no duplicate blocks; indicator flips Dirty → Saving → Saved quietly.
6. Click empty space below last line → real editable line appears and accepts the first character.
7. Refresh: all content present. Kill network mid-paragraph, keep typing, restore network: queue drains, no data loss.

## Scope discipline

No new features in this pass. StoryPulse, storyboard, table read, Academy polish, AI buttons — all untouched. Writing engine first.

## Open question

The current route also owns the empty-state helpers (`onOpenStoryBuilder`, `onDraftWithAi`, `onInsertTemplate`) and an `EmptyEditorTeacher`. In the local-first model the editor is **never** truly empty (first scene heading is auto-seeded), so those helpers move out of the document surface and into a sidebar/menu. Confirm that's acceptable, or I'll keep them as a one-time card above the first line that dismisses on first keystroke.

&nbsp;

Confirmed: proceed with the local-first screenplay writing engine.

The proposed architecture is correct:

- useScreenplayDocument owns local-first writing state.
- ScreenplayDocumentEditor renders the document and dispatches key events.
- ScreenplayLine renders each editable screenplay line using stable local IDs.
- screenplayPersistence syncs to Supabase in the background.
- screenplayKeymap owns pure Enter / Tab / slash / soft-newline logic.
- Supabase and React Query must never be part of the critical typing path.

The critical key rule is approved:

Use stable local IDs for React keys forever.

[block.id](http://block.id) = localId  
block.serverId = Supabase UUID

Never replace the React key when Supabase returns a UUID.

This should fix the focus death, caret jump, remount, duplicate block, and first-character-loss problems.

**Empty-state helper decision**

In the local-first model, the editor is never truly empty because the first scene-heading line is auto-seeded immediately.

So yes: move the old empty-state helpers out of the document surface as primary actions.

However, keep them available as secondary starter helpers.

Approved UX:

1. On a brand-new project, auto-create and focus the first scene_heading line immediately.
2. Show a small optional starter card above the first line.
3. The starter card may include:  
  

  - Story Builder
  - Generate opening scene
  - Insert opening template
  - Import text
4. The card must auto-dismiss on the first keystroke.
5. The card must never block typing.
6. The card must never replace the first editable line.
7. The primary action must always be typing into the screenplay page.

Do not use EmptyEditorTeacher as the primary surface anymore.

Acceptable implementation:

- Keep a lightweight StarterAssistCard above the first line.
- Dismiss it when:  
  

  - the user types into any screenplay line
  - the user creates more than one block
  - the user manually closes it
  - the user chooses one helper action

Do not show a ghost div.  
Do not show a fake “Start typing…” button.  
Do not require the user to click helper buttons before writing.

**Important addition**

Please make the first block autofocus after hydration.

On brand-new project:

- create local scene_heading
- set activeBlockId
- focus the textarea
- allow typing immediately
- start Supabase insert in background

The user should be able to open the editor and type without clicking anything.

**Scope discipline confirmed**

Do not work on StoryPulse, storyboard, table read, Academy polish, AI buttons, or pitch tools in this pass.

This pass is only successful when writing works naturally.

Manual acceptance test remains mandatory:

1. New project opens with one focused scene-heading line.
2. Type int african desert day.
3. First character is not lost.
4. Enter creates Action.
5. Tab cycles block type and keeps focus.
6. Character → Enter → Dialogue → Enter → Character works naturally.
7. Click below last line creates a real local block and accepts typing.
8. 30 seconds of typing causes no blur, no caret jump, no duplicate blocks.
9. Refresh restores all content.
10. Offline/failed network does not stop writing; sync catches up later.

Final product rule:

The screenplay page is sacred.  
Everything else is secondary.