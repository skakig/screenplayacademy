## Diagnosis

The editor is close visually, but several implementation details still make it feel or behave non-writable:

1. **The first-run tour can physically block the page**
   - The current walkthrough opens as a modal overlay and intercepts clicks before the writer can interact with the manuscript.

2. **New optimistic lines can lose typed text**
   - New lines render with temporary `temp-*` IDs, but `saveBlock()` ignores temp IDs.
   - If the user starts typing before the database insert returns, that content can be dropped when the temp row is replaced by the real row.

3. **Autosave status can get stuck on “Saving…”**
   - `markDirty()` increments a pending counter on every keystroke, but one debounced save only decrements it once.
   - Result: the status can stay in a saving state even after the backend accepted the save.

4. **Saved block content is not written back into the local query cache**
   - The backend PATCH succeeds, but the `blocks` cache still contains old content.
   - This causes repeated PATCH calls, stale block props, and unreliable blur/unmount saves.

5. **The paper is still block-first**
   - The trailing “Start typing…” row is still a `<button>`, not an editable line.
   - Clicking below the last block creates a line, but clicking between existing lines only focuses the nearest textarea instead of inserting naturally.

6. **Logline and Write Mode are only partially implemented**
   - Logline step hides the manuscript center, but side panels can still show screenplay context.
   - Write Mode is a separate button instead of behaving like a true editor mode, and it still leaves extra writing-adjacent UI visible.

## Fix plan

### 1. Make autosave reliable
- Replace the keystroke-based pending counter with a save-operation counter.
- `markDirty()` will only set visual state to dirty.
- `markSaving()` increments active saves.
- `markSaved()`/`markError()` decrement active saves and settle the status correctly.
- Update the React Query `blocks` cache inside `saveBlock()` for content, block type, and metadata so the UI always matches the saved local state.

### 2. Protect typing into newly-created lines
- Track temp line content locally while the insert is still pending.
- When the real row returns, migrate any typed temp content to the real row and save it.
- Keep focus on the real row after replacement.
- This prevents the “I typed and it disappeared” failure.

### 3. Replace the trailing button with a real editable cursor row
- Remove the fake “Start typing…” button.
- Add a real trailing textarea styled like a screenplay line.
- On first keystroke, create the next block type at the end and transfer the typed text into it.
- Clicking empty paper below the script focuses this trailing textarea instead of feeling like a utility action.

### 4. Make page clicking behave like a document
- Clicking an existing line focuses that line normally.
- Clicking below the final line focuses the trailing editable row.
- Clicking between two lines inserts a new line at that position and focuses it.
- Clicking above the first line focuses the first line.

### 5. Fix logline mode as a real primary page
- When `guidedStep` is logline, hide screenplay canvas, command bar, manuscript side panel, coach panel, and feature dock.
- Make `LoglineComposer` the center page surface.
- Rename the AI button copy to “Generate logline options”.

### 6. Make Write Mode a real mode
- Fold Write Mode into the existing mode control visually as `Studio / Guided / Write`.
- Keep Studio/Guided backed by onboarding preference, while Write remains local and temporary.
- In Write Mode, hide side panes, mobile pane buttons, guided rails, feature dock, and non-essential writing chrome.
- Keep only the manuscript page, canvas toolbar, save status, and essential writing controls.

### 7. Fix the known nested-button warning while touching editor UX
- In `StoryNavigatorPane`, replace the outer scene row `<button>` with a non-button clickable row so the status dropdown button is not nested inside another button.
- This removes hydration/DOM warnings that can interfere with stable editor behavior.

## Files to change

- `src/routes/_authenticated/editor.$projectId.tsx`
- `src/components/editor/StudioModeToggle.tsx`
- `src/components/editor/LoglineComposer.tsx`
- `src/components/editor/StoryNavigatorPane.tsx`
- Possibly `src/hooks/use-write-mode.ts` if the toggle API needs a setter instead of only `toggle()`

## Validation

After implementation I’ll verify:
- clicking blank paper creates/focuses a writable line;
- typing immediately into a new line does not disappear;
- Enter creates and focuses the next screenplay element;
- autosave settles to saved instead of staying on saving;
- logline step shows only the logline composer as primary content;
- Write Mode hides distractions and keeps the writing surface usable;
- the nested button console warning is gone.