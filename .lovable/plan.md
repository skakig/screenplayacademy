# Make the Editor Feel Like a Walkthrough

## The problem (from your screenshot)

The top rail says **"Step 2 of 13: Write your logline"** — but the editor below it shows a blank scene with `INT. AFRICAN DESERT` / `STEPHAN` and a row of block buttons. The two halves don't talk to each other:

- The rail tells you *what* to do but not *how* or *where*.
- The editor lets you type blocks but never says "this is what 'done' looks like" or "here's the next thing."
- After you add a scene heading and a character, there's no obvious next click.
- "Continue" in the rail is the only progression signal, and it lives far from where you're actually working.

We need the editor itself to behave like a teacher.

## What I'd build

### 1. Step-aware Editor Coach (replaces the silent block toolbar as the focal point)

A single, always-visible coach card pinned to the top of the editor canvas (under the rail) that knows which guided step you're on and shows:

- **What this step is** (1 sentence from `stepMeta.concept`).
- **What "done" looks like** (a checklist of 1–3 concrete sub-tasks the editor can detect).
- **The single best next action** as a primary button (e.g. *"Generate 5 logline options"*, *"Insert opening scene template"*, *"Add your protagonist"*).
- **A secondary "Show me an example"** that drops a real example into the page (greyed, dismissable).
- **"Mark step complete & continue"** button that lights up only when the checklist is satisfied.

The coach replaces the current row of `+ Scene Heading / + Action / + Character …` as the primary surface. Those block buttons stay, but move to a smaller secondary toolbar below the coach (they're for power use, not first-time learning).

### 2. Step-specific editor modes

The editor adapts to the current guided step instead of always showing a generic block surface:

| Step | Editor shows |
|---|---|
| `logline` | A single-line logline composer with word counter (25–40), AI "generate 5 options" picker, save-to-project |
| `protagonist` / `antagonist` | Auto-routes to Characters page with the coach card carried over (no blank editor) |
| `theme` | Theme statement composer with AI suggestions, saves to project metadata |
| `story_arc` / `midpoint` | Auto-routes to Story Arc page |
| `scene_cards` | Auto-routes to Scenes page |
| `opening_scene` | Editor with a pre-seeded **opening scene template** (FADE IN → scene heading → action → dialogue placeholders) and a "Draft with AI" button |
| `act1` | Editor with an Act 1 beat checklist down the side; clicking a beat scrolls/inserts a stub |
| `rough_draft` | Free editor + Coach panel in "diagnose" mode |
| `table_read` / `pitch` | Auto-routes to those pages |

Today the editor opens the same blank `INT. AFRICAN DESERT` / `STEPHAN` shell no matter which step you're on. That's the core source of the confusion.

### 3. "What do I do next?" detector

The coach watches the script and, when sub-tasks are satisfied, swaps the primary button to **"Looks good — continue to Step N"**. This gives the page a forward gear it doesn't have today.

### 4. Empty-state that teaches, not a blank scene

When a project has zero blocks, instead of pre-seeding `INT. AFRICAN DESERT` / `STEPHAN`, show:

- A short "Welcome to the editor" panel with 3 buttons:
  - *Use the opening scene template* (inserts FADE IN + sluglines + placeholders).
  - *Let AI draft an opening from my logline* (uses existing `openingScene` helper).
  - *I'll start from scratch* (then inserts a single empty scene heading).

Today the editor seeds a confusing placeholder scene before the user has done anything, which makes the "walkthrough" feel broken.

### 5. Visible micro-progress inside the step

Add a thin checklist under the coach card so the user always sees the 1–3 atoms that make the current step "done", with live checkmarks as they type/save. E.g. for `opening_scene`:

- [x] Scene heading exists
- [ ] At least one action line
- [ ] At least one dialogue line

This is the difference between "Step 2 of 13" (abstract) and "2 of 3 things done on this step" (actionable).

---

## Scope (this turn)

I propose shipping **the coach card + step-specific editor modes + empty-state teacher** in one pass, because those three together are what turn this into a walkthrough. The rest (per-step beat side-rails, animated transitions) can come after you feel the new flow.

Concretely:

**New files**
- `src/components/editor/StepCoach.tsx` — the pinned coach card with concept, checklist, primary action, mark-complete.
- `src/components/editor/EmptyEditorTeacher.tsx` — first-run welcome / template chooser.
- `src/components/editor/LoglineComposer.tsx` — single-line composer used when step is `logline`.
- `src/components/editor/ThemeComposer.tsx` — same idea for `theme`.
- `src/lib/editor/stepCompletion.ts` — pure functions that take blocks + step and return `{ checks: [{label, done}], allDone }`.
- `src/lib/editor/openingTemplate.ts` — block payloads for the opening-scene template.

**Edited files**
- `src/routes/_authenticated/editor.$projectId.tsx` — read `?step=` from URL (already linked from the rail), pick mode (logline / theme / opening / free), render `StepCoach` at top, render `EmptyEditorTeacher` when block count is 0, demote the `+ Scene Heading / + Action / …` row into a collapsible "Insert block" menu, and stop auto-seeding `INT. AFRICAN DESERT` / `STEPHAN`.
- `src/components/guided/GuidedRail.tsx` — keep as-is but add the current step's `?step=<key>` query param to its links so the editor knows the context.
- `src/routes/_authenticated/first-screenplay.$projectId.tsx` — each "Open" button on a step card already routes to its destination; add the `?step=<key>` query param so the editor / characters / story-arc pages can render the coach for that exact step.

**Not in scope this turn** (next pass): Act 1 beat side-rail, animated "step complete" celebration, AI-driven proactive nudges, mobile-specific coach layout polish.

## Technical notes

- The coach reads the current step from `?step=<key>` first, falls back to the first non-complete row in `project_guided_steps`. This keeps deep-links from the rail and from the First Screenplay page consistent.
- `stepCompletion.ts` is pure and gets unit-testable predicates (`hasSceneHeading`, `hasActionLine`, `hasDialogue`, `wordCount(loglineDraft) in [25,40]`, etc.).
- "Mark step complete" calls the existing `project_guided_steps` update path used by the First Screenplay page — no new RPC needed.
- Removing the auto-seeded `INT. AFRICAN DESERT` placeholder is a one-line change in the editor's initial-load effect; existing projects that already have those blocks are untouched.
- No DB migration required.

Approve and I'll build it.