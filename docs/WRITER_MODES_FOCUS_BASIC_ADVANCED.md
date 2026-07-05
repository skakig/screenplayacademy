# Writer Modes — Focus, Basic, Advanced

## Purpose

SceneSmith Studio needs three clear ways to enter the same writing engine:

1. **Focus Mode** — distraction-free writing.
2. **Basic Mode** — guided, beginner-friendly writing.
3. **Advanced Mode** — the full professional studio.

These are not three separate editors. They are three presentations of the same local-first screenplay editor.

The screenplay editor remains the product. Mode changes must never disrupt typing, focus, caret position, local state, autosave, block order, or draft recovery.

---

## Build Philosophy

Focus Mode is subtraction, not decoration.

Basic Mode is guidance, not training wheels that block the page.

Advanced Mode is power, not clutter for its own sake.

The writer must always be able to write through the page. Helpers are useful only when they protect or improve the writing flow.

Do not build new features to solve visual overload. Hide, collapse, clarify, and reuse what already exists.

---

## Mode Definitions

### Focus Mode

**Promise:** Just the page. No panels. No noise.

Focus Mode should show:

- The manuscript page
- The active screenplay line
- Minimal save/error status
- A small way to exit Focus Mode
- Optional first-use hint: `Esc exits Focus Mode`

Focus Mode should hide:

- Guided rail
- Project side rails
- Script Map
- Director's Chair / CoachPane
- FeatureDock
- Story Builder empty-state helper cards
- Import, pitch, table read, storyboard, and advanced tool docks
- Persistent tutorials or coach panels
- Any visual element not required for immediate writing safety

Focus Mode should keep:

- Local-first typing
- Enter block transitions
- Tab / Shift+Tab block cycling
- Slash command menu
- Smart formatting
- Character autocomplete when directly relevant
- Autosave and local draft recovery
- Save error / retry safety UI

Focus Mode must not create a second editor. It must render the same editor engine with fewer surrounding surfaces.

---

### Basic Mode

**Promise:** Walk me through my first screenplay.

Basic Mode should show:

- The manuscript page
- The current guided step
- One clear next action
- Simple craft explanations
- Beginner examples
- A small `I'm stuck` helper

Basic Mode should hide or collapse:

- Dense AI tool lists
- Advanced diagnostics
- Full FeatureDock
- Multiple competing panels
- Pro-only navigation until requested

Basic Mode should use existing onboarding state:

- `preferred_mode = "guided"`
- `coaching_level = "teaching"` or `"active"`

Basic Mode is not less powerful. It is less visually overwhelming.

---

### Advanced Mode

**Promise:** Open the full studio.

Advanced Mode should show the professional workspace:

- Manuscript page
- Script Map
- Director's Chair / CoachPane
- Canvas toolbar
- FeatureDock
- Story Builder
- Character, scene, import, pitch, table read, and advanced tools

Advanced Mode should use existing onboarding state:

- `preferred_mode = "studio"`

Advanced Mode is the pro cockpit.

---

## Naming

Use clear user-facing labels:

- **Focus**
- **Basic**
- **Advanced**

Avoid using poetic labels as the main mode selector. `Writer`, `Rehearsal`, and `Studio` may remain as internal concepts or secondary copy, but the primary toggle should be obvious to a first-time writer.

---

## Storage Rules

### Focus Mode

Reuse the existing local write-mode preference.

Focus Mode is a local display preference and should remain localStorage-backed unless there is a strong reason to sync it later.

### Basic / Advanced Mode

Reuse `user_onboarding.preferred_mode`.

- Basic Mode → `preferred_mode = "guided"`
- Advanced Mode → `preferred_mode = "studio"`

Reuse `coaching_level` to control how strongly the app teaches.

Do not add a new database table or mode column for this pass.

---

## Editor Route Behavior

In `/editor/$projectId`:

### When Focus Mode is active

Hide the surrounding studio surfaces and keep only the writing-safe UI.

Required hides:

- `GuidedRail`
- left Script Map aside
- right CoachPane aside
- mobile drawer triggers for hidden panes
- `FeatureDock`
- empty-page helper cards
- persistent guided panels
- nonessential toolbar controls

Required keeps:

- `ScreenplayDocumentEditor`
- save status / error banner
- local-first persistence adapter
- block keyboard behavior
- slash commands
- smart formatting
- draft restore safety

Add:

- small `Focus` pill
- `Exit Focus` control
- `Esc` exits Focus Mode

### When Basic Mode is active

Show the page plus one current helper.

Required behavior:

- Show the current guided step when available.
- Show one beginner-friendly coach card.
- Hide advanced docks by default.
- Keep Story Builder available but not dominant.
- Keep writing central.

### When Advanced Mode is active

Keep the current full studio layout, assuming the editor acceptance tests still pass.

---

## First-Run Mode Choice

On first editor entry, show a short mode chooser if onboarding has not been completed.

Title:

**Choose your writing setup**

Options:

- **Focus** — Just the page. No panels. No noise.
- **Basic** — Walk me through my first screenplay.
- **Advanced** — Open the full studio.

After selection:

- Focus → enable local Focus Mode
- Basic → set `preferred_mode = "guided"`, set `coaching_level = "teaching"` or `"active"`
- Advanced → set `preferred_mode = "studio"`

Mark the walkthrough complete using the existing onboarding mechanism.

Do not show the chooser repeatedly. It may be reopened later from settings/help.

---

## Keyboard Rules

Focus Mode must support:

- `Esc` → exit Focus Mode
- `Enter` → next screenplay block
- `Tab` → cycle block type forward
- `Shift+Tab` → cycle block type backward
- `/` → slash command menu
- `Shift+Enter` → soft newline only where allowed

No mode may cause Tab to leave the screenplay line while typing.

No mode may steal focus from the active line.

---

## Acceptance Tests

### Focus Mode

1. Open a project in the editor.
2. Enable Focus Mode.
3. Confirm only the manuscript page, minimal status, and exit control are visible.
4. Type `int african desert day`.
5. Press Enter.
6. Continue writing for 30 seconds.
7. Press Tab several times.
8. Use `/character`.
9. Press Esc to exit Focus Mode.

Expected:

- First character is not lost.
- No focus loss.
- No caret jump.
- No duplicate blocks.
- Enter and Tab behavior still work.
- Slash menu still works.
- Autosave still works.
- Exiting Focus Mode restores the prior layout.
- No side panel or dock remains visible during Focus Mode.

### Basic Mode

1. Set mode to Basic.
2. Open a new project.
3. Confirm the current guided step is visible.
4. Confirm only one main helper/coach is visible.
5. Start writing in the manuscript page.
6. Use the `I'm stuck` helper if available.
7. Return to typing.

Expected:

- The helper explains the next task.
- The helper does not overwrite the script.
- The page remains the center of the experience.
- The user always knows what to do next.

### Advanced Mode

1. Set mode to Advanced.
2. Open a project.
3. Confirm full studio tools are visible.
4. Confirm Script Map, Director's Chair, FeatureDock, and toolbar are available.
5. Run the editor acceptance script.

Expected:

- Full studio power is available.
- Writing behavior remains identical to Focus and Basic modes.

---

## Implementation Passes

### Pass 1 — Clarify the mode toggle

Rename the visible mode labels to:

- Focus
- Basic
- Advanced

Reuse existing storage and hooks where possible.

### Pass 2 — Complete Focus Mode hiding rules

When Focus Mode is active, hide all nonessential studio surfaces and keep the writing-safe UI.

### Pass 3 — Add first-run mode chooser

Use existing onboarding fields and mark the walkthrough complete after selection.

### Pass 4 — Simplify Basic Mode

Show the current guided step and one helper. Collapse advanced tools by default.

### Pass 5 — i18n sweep

All new user-facing strings must use translation keys.

### Pass 6 — QA

Run the editor acceptance tests in this order:

1. `/editor-lab`
2. `/editor/$projectId`

If typing breaks, stop and fix the editor before polishing modes.

---

## Out of Scope

Do not:

- Rebuild the editor
- Create a second Focus editor
- Add new AI generation behavior
- Add new database tables for modes
- Change the screenplay block model
- Add new panels to solve panel overload
- Let mode switching invalidate or remount the active writing line

---

## Lovable Prompt

Implement `docs/WRITER_MODES_FOCUS_BASIC_ADVANCED.md`.

Read first:

1. `AGENTS.md`
2. `docs/SCREENPLAY_EDITOR_CONTRACT.md`
3. `docs/EDITOR_ACCEPTANCE_TESTS.md`
4. `docs/WRITER_MODES_FOCUS_BASIC_ADVANCED.md`

Goal:

- Add clear user-facing modes: Focus, Basic, Advanced.
- Focus Mode must be truly distraction-free.
- Basic Mode must guide beginners one step at a time.
- Advanced Mode keeps the full studio.

Requirements:

- Reuse the existing local write-mode hook for Focus Mode.
- Reuse `user_onboarding.preferred_mode` for Basic and Advanced.
- Reuse `coaching_level` for Basic Mode teaching intensity.
- Rename visible mode labels to Focus / Basic / Advanced.
- Hide FeatureDock and all nonessential panels in Focus Mode.
- Keep typing, Enter, Tab, slash commands, autosave, and local draft recovery untouched.
- Add a short first-run mode chooser using existing onboarding fields.
- All user-facing strings must use i18n keys.
- Run editor acceptance tests after changes.

Do not add new product features in this pass. This pass is only about mode clarity, distraction control, and beginner accessibility.
