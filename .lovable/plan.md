## Goal

Make the center page feel like a continuous screenplay document, not a list of database textareas. The user opens the editor and types — no buttons, no "Start typing…" affordances, no focus loss.

## What changes

### 1. New component: `src/components/editor/ScreenplayDocumentEditor.tsx`

Owns the entire writing surface. Receives `projectId`, `blocks`, `characters`, `activeSceneId`, and mutation callbacks (`onAddBlock`, `onInsertAfter`, `onSaveBlock`, `onDeleteBlock`, `onCreateCharacter`). Internally manages:

- `activeBlockId`, `focusBlockId`, `pendingTempContent` map
- Auto-seeded first line (scene_heading) when `blocks.length === 0`
- A real editable **ghost trailing line** (textarea, not a button) that:
  - Renders after the last block with a blinking caret style
  - On first keystroke: optimistically creates a `temp-*` block via `onInsertAfter` (or `onAddBlock` if empty), stashes the typed character in `pendingTempContent`, focuses the new real block when it mounts, and lets typing continue without losing the character
  - On click / focus: same path — becomes a real line
- Click-on-paper handler: clicks below last block focus the ghost line (no `cmdNewLine` button-press feel)
- Enter / Tab / `/` / smart-format behaviors moved out of the route and into one internal `BlockEditor` (lifted from the route file, unchanged behavior aside from focus and save wiring)
- Smart formatting for scene headings ("int african desert day" → "INT. AFRICAN DESERT - DAY") via `autoFormat.ts` on blur and on Enter

### 2. Focus + temp-id handling (fixes "focus stolen by cache invalidation")

- `addBlock` / `insertBlockAfter` keep their existing `onMutate` optimistic insert + `temp-*` id
- After server returns the real id, in `onSuccess`:
  - If `focusBlockId === tempId`, swap it to the real id atomically inside `setFocusBlockId` AND `setActiveBlockId`
  - Flush `pendingTempContent[tempId]` → `pendingTempContent[realId]` then issue a single `saveBlock(realId, { content })`
  - Do NOT call `qc.invalidateQueries(["blocks"])` on success — instead patch the cache in place (replace the temp row with the real row). Invalidation is what currently blurs the textarea.
- `BlockEditor` keeps `dirtyRef`: server echoes are ignored while the field is focused or has a pending save, so cache patches never overwrite local text.

### 3. Autosave reliability

- Keep the operation-count `pendingCount` (already in place)
- Add a per-block "in-flight save" guard so a server echo arriving during typing is dropped on the floor
- Status pill shows Saving / Saved / Error quietly in the toolbar; never re-renders the textarea content or moves the caret

### 4. Route refactor: `src/routes/_authenticated/editor.$projectId.tsx`

Trim to ~400 lines. The route owns data fetching, mutations, guided-step routing, and layout only:

```
<AppShell>
  <StoryNavigatorPane … />
  <main>
    {isLoglineStep
      ? <LoglineComposer … />
      : <ScreenplayDocumentEditor
           projectId={projectId}
           blocks={blocks}
           characters={characters}
           activeSceneId={activeSceneId}
           onAddBlock={addBlock.mutateAsync}
           onInsertAfter={insertBlockAfter.mutateAsync}
           onSaveBlock={saveBlock}
           onDeleteBlock={deleteBlock.mutate}
           onCreateCharacter={createCharacter.mutateAsync}
        />}
    <EditorCommandBar … />
  </main>
  <CoachPane … />
  <FeatureDock … />
</AppShell>
```

`BlockEditor`, `cmdNewLine`, the slash menu, the click-on-paper handler, and the trailing row move out of the route into `ScreenplayDocumentEditor`. `EditorCommandBar`, `CanvasToolbar`, and the keyboard-shortcut legend stay in the route shell.

### 5. Empty state

Replace `EmptyEditorTeacher`'s primary surface with:

- Title "Start your screenplay"
- One auto-focused editable scene-heading line (the same ghost-line component)
- Secondary buttons under the page: Use Story Builder · Generate opening scene · Insert opening template · Import text

Typing is always the primary action.

### 6. Guided-step conflict

In the route, when `guidedStep === "logline"`, render `LoglineComposer` as the main surface and hide the screenplay canvas + the manuscript-only side context. On any manuscript step (or no step), render `ScreenplayDocumentEditor`.

### 7. Preserved

- Cinematic paper look (`.screenplay-paper`, 760px max width, py-12/16 padding) — unchanged
- All existing `script_blocks` persistence and the block-type system — unchanged
- AI continue, voice check, story builder, manuscript index — unchanged

## Files touched

- **Create** `src/components/editor/ScreenplayDocumentEditor.tsx` (~500 lines: lifts `BlockEditor`, ghost line, slash menu, click handler, focus + temp-id logic)
- **Edit** `src/routes/_authenticated/editor.$projectId.tsx` (slim to route + data + layout)
- **Edit** `src/components/editor/EmptyEditorTeacher.tsx` (or inline new empty surface into the new component and stop using `EmptyEditorTeacher` as primary)
- No DB / schema / RLS changes
- No new dependencies

## Acceptance check (manual, in preview)

1. Open a brand-new project editor → caret blinks on an empty scene-heading line, type immediately works
2. Type `int desert day`, blur → reformats to `INT. DESERT - DAY`
3. Press Enter → focus jumps to a new Action line without dropping the first typed character
4. Press Tab → block type cycles, focus stays
5. Press `/` → slash menu opens
6. Click empty paper below last line → caret lands on a new editable line (no button press)
7. Type continuously for 30s → no blur, no caret jump, save status flips Saving → Saved quietly
8. Switch to guided "Write your logline" step → screenplay canvas hidden, LoglineComposer is primary
