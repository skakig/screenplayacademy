## Why you can't write a screenplay right now

I traced this through `editor.$projectId.tsx`, `BlockEditor`, `LoglineComposer`, `StepCoach`, and the guided-step gating. Five things conspire to make the canvas feel broken:

### 1. Guided mode hijacks the canvas
You're on **Guided · Step 2 of 13 (Write your logline)**. At that step:
- `isLoglineStep` is true → the screenplay canvas is **replaced** by `LoglineComposer` and dimmed to `opacity-60`.
- Other early steps (`characters`, `story_arc`, `scenes`, `pitch`, `tableread`) push you to a different page via the redirect banner.
- Only a handful of steps (`opening_scene`, `act1/2/3`, `rough_draft`, `first_scene`) actually let you type prose.

Net effect: in Guided mode the "Editor" tab is **not an editor** for ~10 of 13 steps. That's the core problem.

### 2. A runtime error overlay is on top of the canvas
`duplicate key value violates unique constraint "writer_profiles_user_id_key"` — the profile bootstrap is inserting instead of upserting, so the global error toast covers the editor on every reload.

### 3. The "blocks" UI doesn't invite typing
The canvas renders `INT. AFRICAN DESERT` then `STEPHAN` with no visible empty line, no caret, no "press Enter to add dialogue" hint. `BlockEditor` is a 1-row auto-grow `<textarea>` with no border until focused — on a fresh scene it looks like static text, not an input.

### 4. Enter/Tab/slash are invisible
Slash menu, Tab to cycle block type, Enter to insert the next logical block — all real, all undiscoverable. There is no inline ghost-line ("⏎ Action", "⏎ Dialogue") after the last block.

### 5. No "always-on" composer at the bottom
Professional screenplay tools keep a persistent caret. Here, if you click outside any block, there's nowhere to click back into.

---

## What I'll change

### A. Fix the blocker
1. **Stop the writer_profiles duplicate-insert** — switch the bootstrap to `upsert({...}, { onConflict: 'user_id', ignoreDuplicates: true })` (or pre-check) so the error overlay stops covering the editor.

### B. Make the editor always reachable
2. **Stop hijacking the canvas in Guided mode.** Keep `StepCoach` and `LoglineComposer` as a **collapsible top panel**, but always render the screenplay canvas below at full opacity. Replace `isLoglineStep ? replace : show` with `always-show + optional step helper above`.
3. **Remove the "this step is best done on another page" full-block redirect.** Keep it as a small inline link in the step strip, not a wall in front of the editor.
4. **Auto-switch to Studio when the user clicks into the canvas** (or add a one-click "Just let me write" button on the step strip that flips `preferred_mode` → `studio` for this session).

### C. Make the writing surface obvious
5. **Persistent "Add line" affordance** under the last block: a full-width, dashed ghost row labeled `⏎  Action  ·  Tab to change type  ·  /  for menu` that focuses a new block on click.
6. **Empty-scene starter**: when a scene has only a heading (and optionally a character), auto-insert an empty `action` block so there is always a visible caret-ready line.
7. **Block borders on hover**, not just focus, so blocks read as inputs. Add a left "type pill" (ACTION / DIALOGUE / SLUG) that's clickable to change type.
8. **Inline hint row** under the toolbar: `Enter = new block · Tab = change type · / = menu · ⌘↵ = AI continue`. Dismissable, remembered per user.

### D. Polish the canvas chrome
9. **CanvasToolbar**: make the block-type dropdown the primary control, wider, with keyboard shortcut hints; show current block type live as you move the caret.
10. **Footer command bar**: keep `EditorCommandBar` visible even when `blocks.length === 0` so "AI continue / New line / Change type" are always one click away.

### E. Out of scope (call out, don't build)
- No swap to TipTap/ProseMirror — the existing block model is fine; the UX around it is the issue.
- No schema changes beyond the upsert fix.
- No changes to Coach pane, Story Navigator, or Feature Dock in this pass.

---

## Files I'll touch

- `src/routes/_authenticated/editor.$projectId.tsx` — drop the canvas hijack, render `LoglineComposer`/`StepCoach`/redirect as a top helper strip, always render the screenplay canvas, mount a persistent "Add line" ghost row, keep `EditorCommandBar` always mounted.
- `src/components/editor/BlockEditor` (extract from the route file) — hover border, type pill, hint row.
- `src/components/editor/CanvasToolbar.tsx` — primary type selector + shortcut legend.
- Wherever `writer_profiles` is first inserted (likely a `useEnsureWriterProfile` hook or root loader) — switch to upsert/ignoreDuplicates.
- `src/components/editor/StudioModeToggle.tsx` — add a "Just let me write" quick action that flips to Studio.

---

## Build order
1. Fix writer_profiles upsert (clears the error overlay).
2. Always-render canvas + collapse step helper (unblocks writing).
3. Persistent "Add line" ghost row + auto empty action block.
4. Hover borders, type pill, hint row.
5. Toolbar + always-on command bar polish.

After this pass, the canvas is the canvas on every step, in every mode, with a visible caret invitation at all times.