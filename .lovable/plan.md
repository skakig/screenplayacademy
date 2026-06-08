## First-Time Editor Walkthrough Overlay

Add a lightweight, dismissible coach-mark overlay that runs the first time a user opens the editor, then never auto-shows again (with a "Replay tour" option in the editor header).

### UX flow

5 short steps, each a tooltip-style popover anchored to a real UI element, with a dimmed backdrop and a spotlight cutout around the target:

1. **Welcome** (centered modal, no anchor) — "This is your screenplay editor. Let's take 30 seconds to show you around."  Buttons: *Start tour* / *Skip*.
2. **Step Coach card** — "This card tells you what to do right now. It updates as you progress through the 13 guided steps."
3. **Block toolbar (+ Scene / + Action / + Character / + Dialogue)** — "Add screenplay blocks here. Or use the empty-state buttons below to draft with AI."
4. **Guided Rail (top step indicator)** — "Your progress through the walkthrough lives here. Click any step to jump."
5. **Coach panel (right side)** — "Get AI feedback on your draft anytime."  Final button: *Got it — start writing*.

Each step has: `Back`, `Next` (or `Finish`), and `Skip tour`. ESC also dismisses.

### Persistence

- Store completion in `localStorage` under `lovable.editor.tourCompleted.v1` (per-browser, no DB needed).
- Also expose a "Replay tour" button in the editor header that clears the flag and restarts.
- Tour only auto-opens when: user is on the editor route AND the flag is unset AND no modal is already open.

### Visual design

- Dimmed full-screen backdrop (`bg-background/70 backdrop-blur-sm`) with a `clip-path` or SVG mask cutout around the anchored element (8px padding, rounded corners).
- Popover card: ~320px wide, uses existing `Card` + `Button` components, semantic tokens only.
- Step counter ("2 of 5") and a thin progress bar at the top of the card.
- Anchor positioning: lightweight — use `getBoundingClientRect()` of the target and place the popover with simple top/bottom/left/right logic; no Floating UI dependency.

### Technical changes

**New files:**
- `src/components/editor/EditorTour.tsx` — overlay component. Owns step state, backdrop+spotlight rendering, popover positioning, keyboard handling.
- `src/lib/editor/tourSteps.ts` — array of `{ id, title, body, targetSelector, placement }`.
- `src/hooks/useEditorTour.ts` — reads/writes `localStorage` flag, exposes `{ isOpen, start, stop, hasSeen }`.

**Edited files:**
- `src/routes/_authenticated/editor.$projectId.tsx` — mount `<EditorTour />`, add `data-tour="step-coach" | "block-toolbar" | "coach-panel"` attributes to the targets, add a small "Replay tour" button in the header.
- `src/components/guided/GuidedRail.tsx` — add `data-tour="guided-rail"` to the rail container.

**No backend, no migrations, no new packages.**

### Out of scope this turn

- Per-step tours on other tabs (Characters, Story Arc, StoryPulse). The flag and component are structured to be reused later, but this turn only wires the editor tour.
- Animated transitions between steps beyond a simple fade.
- Analytics tracking of tour completion.

Ready to build when you approve.