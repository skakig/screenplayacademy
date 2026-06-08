# Writer-First Screenplay Editor

Goal: the center panel should feel like a real page you type on — not a column of textareas. Guided logline step should swap the center for a Logline Builder instead of showing blocks.

## 1. New component: `ScreenplayDocumentEditor`

Create `src/components/editor/ScreenplayDocumentEditor.tsx` that owns the entire writing surface and the writing flow. The route file delegates the canvas to it.

Responsibilities:
- Renders blocks as one continuous paper page (current `BlockEditor` styling preserved).
- Owns `activeBlockId`, `prevType`, `pendingFocusId`, and the textarea ref map.
- Always maintains an "active editable line":
  - If `blocks.length === 0` → render an inline empty `action` line that auto-focuses on mount and persists to DB on first keystroke (optimistic local row → insert on first change, not on mount).
  - If user clicks anywhere on blank paper below the last block → focus the last block if empty, else create a new typed block after it and focus it.
  - If a block is deleted and was active → focus previous; if none, fall back to the always-present trailing empty line.
- Exposes imperative methods to parent for the command bar (`newLine`, `cycleType`, `aiContinue`).

## 2. Reliable focus across React Query refetches

Today `insertBlockAfter.onSuccess` sets a `setFocusBlockId(data.id)`, but invalidation/refetch races the ref map. Fix:

- Use optimistic cache update with `queryClient.setQueryData(["blocks", projectId], …)` to insert the new row immediately, so the DOM renders before the network round-trip.
- After mutation success, reconcile by id.
- A small `useLayoutEffect` watches `pendingFocusId` against the ref map; when the ref appears, call `focus()`, place caret at end, then clear `pendingFocusId`.
- Same path used by Enter, click-below-paper, and empty-state-first-keystroke.

## 3. Always-on trailing writing row

Replace the current "Add line" ghost button with a real empty `<textarea>` rendered as the last child of the paper:
- Looks identical to a normal block (typewriter font, correct left margin for its type).
- Type defaults to `nextBlockTypeAfter(lastBlock?.block_type ?? "scene_heading")`.
- Placeholder = "Start typing…" (or "INT. / EXT. — start your first scene" when blocks is empty).
- On first keystroke, persists as a new block; trailing row regenerates below it.
- Enter from any block focuses this row (or inserts before it and focuses the new block).

## 4. Click-anywhere-on-paper behavior

Replace the current "find nearest textarea by Y" handler with:
- Click on a block → focus that block (native).
- Click on paper *below* the last block → focus trailing writing row.
- Click on paper *between* two blocks → insert a new block at that gap, focus it.
- Click on paper *above* first block → focus first block at start.

## 5. Enter behavior

Already wired via `BlockEditor.onEnter → insertBlockAfter`. Combine with focus fix in §2 so the new block focuses synchronously on the next paint. Shift+Enter keeps soft-break behavior already in place.

## 6. Guided logline step swaps the canvas

In `editor.$projectId.tsx`, when `isLoglineStep` is true:
- Center column renders `<LoglineComposer />` as the primary surface (full width, centered, no opacity dimming).
- `ScreenplayDocumentEditor` is hidden (not just dimmed) — guided logline is a different task.
- A small "Open manuscript" link under the composer lets the user jump out.
- `EditorCommandBar` is hidden during this step; the composer's own Save / Generate buttons are the primary CTAs.

For other guided steps that *are* writing steps (`opening_scene`, `act1`, `rough_draft`, `first_scene`, `write_first_scene`), the manuscript stays primary and the step hint goes into the existing collapsible helper.

## 7. Hide the "blocks" vocabulary

User-visible strings change:
- "Add line" → removed (trailing row replaces it).
- "Change element type" stays — it's screenplay terminology.
- Toolbar copy: "Element" instead of "Block type"; "New line" instead of "New block".
- Analyzer toasts already say "scene" / "character" — leave as-is.

DB column names and `script_blocks` table remain untouched.

## 8. Write Mode

Extend `StudioModeToggle` with a third value `write`:
- `write` → hide left (Story Navigator) and right (Coach + Feature Dock + Progress) panes; center spans full width, capped at the current paper max-width.
- `studio` (current default) → unchanged 3-column layout.
- `coach` → unchanged.
- Persist selection in localStorage (matches existing toggle pattern).
- Mobile drawers still work in Write Mode (`Scenes` / `Coach` buttons stay accessible).

## 9. Empty-project first-run

When `blocks.length === 0` and we're not on logline step and not on a redirect step:
- Don't auto-insert template blocks (current behavior).
- Render trailing writing row with placeholder "INT. — Start your first scene" and focus it on mount.
- User can begin typing immediately. Auto-format rules already promote `INT.` to `scene_heading`.

## Files to add / change

Add:
- `src/components/editor/ScreenplayDocumentEditor.tsx` — owns canvas, focus, trailing row, click-on-paper, empty state.

Edit:
- `src/routes/_authenticated/editor.$projectId.tsx` — replace inline canvas JSX (~lines 770–910) with `<ScreenplayDocumentEditor … />`; swap center surface when `isLoglineStep`; route `EditorCommandBar` callbacks through it; hide side panes when mode === `write`. Remove the current "Add line" ghost button and the "find nearest textarea by Y" mouseDown handler.
- `src/components/editor/StudioModeToggle.tsx` — add `write` mode option.
- `src/components/editor/EditorCommandBar.tsx` — hidden during logline step; minor copy tweak ("Element" / "New line").

No DB schema changes. No changes to `BlockEditor` internals, autoFormat, analyzer, or autosave.

## Out of scope

- Swapping textareas for ProseMirror/TipTap (would be a much bigger rewrite; current per-block textarea keeps autosave, autoformat, character autocomplete intact).
- Touching Coach / Feature Dock / Progress card content.
- Schema or server function changes beyond what's listed.

## Build order

1. `ScreenplayDocumentEditor` shell + trailing writing row + click-on-paper.
2. Optimistic insert + `useLayoutEffect` focus reconciler (fixes flaky post-Enter focus).
3. Empty-state auto-focus and first-keystroke persistence.
4. Logline step swaps the center surface.
5. Write Mode in `StudioModeToggle` + layout gating.
6. Copy cleanup ("Add line" / "block" → screenplay terms).
