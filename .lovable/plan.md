## UX Simplification: Studio Menu, Quiet Chrome, Summoned Panels

Core principle: **The Page is the product. Everything else is summoned.**

No new features. No schema changes. No editor engine changes. Reorganize what exists into one predictable menu, one guided next-step, and drawers instead of always-on panels.

### Pass 1 — Collapse top navigation into one shell

Today: `AppShell` header (5 links) + `ProjectNav` sub-bar (up to 10 project rooms) + inline editor top bar. Three horizontal nav layers.

Change `src/components/AppShell.tsx`:

- Header keeps only: brand logo, page title slot, **Studio Menu** button (hamburger), sign-out.
- Remove the 5-link nav row from the header.

Replace `src/components/ProjectNav.tsx` usage in every project route with the same **Studio Menu** trigger (no horizontal room bar rendered by default).

New component `src/components/StudioMenu.tsx` (uses existing shadcn `Sheet`):

- Opens from the right on desktop, from the top on mobile.
- Two sections rendered from arrays already in `AppShell` and `ProjectNav`:
  - **Studio** — Studio Lobby, Script Vault, Screenplay School, Pricing, Studio Settings.
  - **Project rooms** (only when a `projectId` is in scope) — Writer's Desk, Scene Board, Casting Wall, Story Spine, Dramatic Pulse, Shot Wall, Rehearsal Room, Producer Room, Writers' Room. When `preferred_mode === "guided"`, prepend Guided Path.
- Active route highlighted via `Link activeProps`.
- Closes on selection.

Wire trigger:

- `AppShell` renders the trigger in the header.
- Editor route removes `<ProjectNav …>` and instead relies on the same header trigger. `PresenceAvatarStack` moves next to the trigger.

### Pass 2 — Focus Mode: page only

Already mostly done. Additional cleanups in `src/routes/_authenticated/editor.$projectId.tsx`:

- Hide the entire `AppShell` header row when `focus` (render `<main>` full-bleed via a `focus` prop on `AppShell` that suppresses header + `GuidedReturnBanner`).
- Keep only: manuscript page, `AutosaveIndicator` (compact top-right), `SaveStatusBanner` (only on error), `FocusPill` (bottom-center), `WriterDeskModeToggle` (small top-right).
- `CanvasToolbar` becomes summoned: not rendered in Focus; a small floating "Format" button (bottom-right) opens it in a `Popover`. Same for Basic (see Pass 3).
- No `GuidedRail`, `GuidedStepStrip`, `FeatureDock`, side asides, mobile drawer triggers — already gated; verify none leaked.

### Pass 3 — Basic Mode: page + one guided next-step

In the editor route when `preferred_mode === "guided"` and not `focus`:

- Hide left `StoryNavigatorPane` aside and right `CoachPane` aside (they become drawer-only via Studio Menu → project rooms).
- Keep `GuidedStepStrip` at the top (already there).
- Show a single `StepCoach` card centered above the manuscript with beginner sections mapped to existing copy in `stepMeta.ts`:
  - **What to do next** — primary action label.
  - **Why it matters** — from `stepMeta.principle` (fall back to a short blurb).
  - **Example** — from `stepMeta.example` (fall back to hide).
  - **Help me start** — invokes existing `handleCoachPrimary` (already runs the AI/insert path per step).
- Hide `CanvasToolbar`, `FeatureDock`, page/scene bar, kbd-hint strip; expose them through the floating Format button and Studio Menu.
- No new i18n content: reuse existing keys and `stepMeta` fields; add only wrapper labels `mode.basic.next`, `mode.basic.why`, `mode.basic.example`, `mode.basic.helpStart` to `src/lib/i18n/keys.ts`.

### Pass 4 — Advanced Mode: dockable, not always-on

Advanced is the current default layout minus permanent panels. In `src/routes/_authenticated/editor.$projectId.tsx` when not `focus` and not Basic:

- Convert the desktop left aside (`StoryNavigatorPane`) and right aside (`CoachPane`) into collapsed-by-default drawers, opened from the header trigger group:
  - "Script Map" button → opens left `Sheet` (reuse the mobile Sheet already present, drop the `lg:hidden` gating).
  - "Director's Chair" button → opens right `Sheet` (reuse the mobile Sheet, drop `xl:hidden`).
- Remove the permanent `<aside … hidden lg:block>` and `<aside … hidden xl:block>` blocks so the manuscript grid becomes single-column by default at all breakpoints.
- `FeatureDock` becomes summoned: hide by default; add a small "Tools" button next to Format that opens it in a `Sheet` from the bottom.
- Keep `CanvasToolbar` behavior identical to Focus/Basic (floating Format popover), so Advanced is Focus + tool buttons visible in the header, not a wall of chrome.

Result: the page is visually dominant in every mode; power tools are one click away.

### Pass 5 — Quiet the editor line

In `src/components/editor/ScreenplayLine.tsx`, hide the "New word / Heads up" chip cluster by default and replace with a subtle left-margin indicator:

- New render: when `visibleUnknowns.length > 0` and the line is not focused, render a single 4px accent dot in the left margin (absolute-positioned, `bg-primary/50`) instead of the current chip row (lines ~400–470).
- On hover of that dot, or when the line is focused, reveal the existing chip row inside a small `Popover` anchored to the dot.
- Same treatment for the medium-confidence `suggestion` block (lines ~475+): dot in the margin, popover on hover/focus with existing accept/reject controls.
- No logic changes to `unknownTerms`, `suggestion`, `dismissedTerms`, `onAddDictionaryTerm`, or `onRejectFormatSuggestion` — only presentation.

### Pass 6 — First-run mode chooser wording

Reuse `FirstRunModeDialog`. Update taglines already in `src/lib/i18n/keys.ts`:

- `mode.focus.tagline` → "Page only. Nothing else."
- `mode.basic.tagline` → "One clear next step at a time."
- `mode.advanced.tagline` → "Full studio. Tools on demand."

Success criteria checks (manual after build):

- Any project route shows only header + manuscript; every other room is one click behind Studio Menu.
- Focus renders page + pill + save state — nothing else.
- Basic renders page + one guided card + Studio Menu.
- Advanced renders page + Script Map/Director/Tools buttons in header; nothing docked permanently.
- Editor line has no visible chips until hover/focus.

Amendments:

Write

- Writer’s Desk

- Focus Mode

Plan

- Guided Path

- Scene Board

- Story Spine

- Casting Wall

Polish

- Dramatic Pulse

- Director’s Notes

- Rewrite Tools

Produce

- Shot Wall

- Rehearsal Room

- Producer Room

- Pitch Deck

Settings

- Studio Settings

- Pricing

&nbsp;

This plan is approved with the following amendments.

Core principle stays:

The Page is the product. Everything else is summoned.

Required changes before implementation:

1. Studio Menu IA

Do not label the main menu section “Project rooms” as the primary mental model. Organize tools by creative purpose:

- Write

- Plan

- Polish

- Produce

- Settings

Each advanced tool should have a short beginner-readable subtitle.

2. Basic Mode

Do not keep the full GuidedStepStrip visible by default. Replace it with a compact progress pill:

“Step 10 of 13 · Build the Midpoint.”

Basic Mode should show:

- page

- one next-step card

- compact progress

- Studio Menu

No horizontal curriculum strip unless opened.

3. Editor shell

In the editor, there should be one header only:

SceneSmith / Project Title / Mode Toggle / Studio Menu / Saved status.

Do not create a second header, subnav, room row, or guided banner layer.

4. Advanced Mode

Advanced defaults to page-first with summoned drawers:

- Script Map

- Director’s Chair

- Tools

- Format

Do not render permanent side panels by default. Future “pin panel” behavior may come later, but is out of scope.

5. Quiet editor annotations

The chip cleanup must include:

- New word chips

- Heads up chips

- suggestion chips

- beat tags

- “Inciting Incident” / “No beat” floating controls

In Focus and Basic, these should be hidden or represented by subtle margin indicators. On iPad/mobile, reveal by tap/focus, not hover only.

6. Scope wording

Change success criteria from “Any project route shows only header + manuscript” to:

“Any editor route shows the manuscript as the dominant object. Other project rooms use the simplified shell and Studio Menu.”

7. Preserve editor behavior

No changes to:

- screenplay block model

- local-first persistence

- autosave

- keymap

- slash menu

- Enter/Tab behavior

- AI behavior

- database schema

If typing breaks, stop and fix the editor before polishing UI.

### Files touched

- edit `src/components/AppShell.tsx` (drop nav row, add `focus` prop, mount Studio Menu trigger)
- new  `src/components/StudioMenu.tsx` (Sheet with Studio + Project sections)
- edit `src/components/ProjectNav.tsx` — reduced to header-side trigger group (title + presence + drawer buttons in Advanced); no horizontal room bar
- edit `src/routes/_authenticated/editor.$projectId.tsx` (drop always-on asides, add Format/Tools/Script Map/Director buttons, wire Basic StepCoach)
- edit `src/components/editor/ScreenplayLine.tsx` (chip cluster → margin dot + popover)
- edit `src/lib/i18n/keys.ts` (basic-mode section labels, updated taglines)
- new  `src/components/editor/BasicNextStepCard.tsx` (uses `StepCoach` internals; single card wrapper)

### Out of scope

No editor engine, autosave, local-first, keyboard, slash-menu, screenplay block model, DB schema, AI behavior, or new features.