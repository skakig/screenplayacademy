# LOVABLE_PASS_SEQUENCE.md

## Purpose

This document defines the credit-saving Lovable workflow for fixing the SceneSmith screenplay editor.

The goal is to prevent large, risky, expensive rewrites that touch unrelated app areas while the core writing engine remains broken.

## Prime Rule

Do not build new features until the screenplay editor works.

The editor must pass the acceptance tests before work continues on StoryPulse, storyboard, table read, Academy polish, AI tools, pitch packages, or visual redesigns.

## Sequence Overview

The screenplay editor rescue should happen in four controlled passes:

1. Build the local-only editor lab.
2. Add background persistence.
3. Integrate the proven engine into production.
4. Remove old broken editor machinery.

Each pass has a stop condition.

Do not begin the next pass until the current pass passes its acceptance test.

---

# Pass 1 — Local-Only Editor Lab

## Goal

Create `/editor-lab` and prove the screenplay writing engine works with local state only.

## Scope

Allowed:

- `/editor-lab` route
- local screenplay block state
- stable local IDs
- Enter behavior
- Tab behavior
- Shift+Tab behavior
- Shift+Enter behavior
- click-below-last-line behavior
- slash menu
- autosize
- screenplay page styling

Not allowed:

- Supabase
- React Query persistence
- production `/editor/:projectId`
- CoachPane
- StoryPulse
- Academy
- storyboard
- table read
- pitch tools
- AI tools
- auth changes
- pricing changes

## Stop Condition

Stop when `/editor-lab` passes the acceptance tests in `docs/EDITOR_ACCEPTANCE_TESTS.md`.

---

# Pass 2 — Background Persistence

## Goal

Add persistence to the already-working local-first writing engine without changing the typing behavior.

## Scope

Allowed:

- `screenplayPersistence.ts`
- background insert/update/delete queue
- localStorage draft recovery
- Supabase sync adapter
- retry failed saves
- cache patching after successful sync

Not allowed:

- rewriting the editor interaction model
- changing Enter/Tab behavior
- moving focus logic back to the route
- invalidating `['blocks', projectId]` during typing
- adding unrelated features

## Rules

Typing must remain local-first.

Supabase must be a background target only.

Network failure must not stop typing.

Server IDs must not replace local IDs.

## Stop Condition

Stop when:

- local typing remains perfect
- refresh restores content
- network failure does not stop typing
- sync resumes after network recovery
- no duplicate blocks are created

---

# Pass 3 — Production Integration

## Goal

Replace the production editor writing surface with the proven local-first engine.

## Scope

Allowed:

- integrate editor engine into `/editor/:projectId`
- wire initial Supabase blocks into local hydration
- wire persistence adapter to `script_blocks`
- keep existing project layout and side panes
- keep CoachPane, StoryNavigator, StoryBuilder, FeatureDock as surrounding tools

Not allowed:

- rebuilding unrelated pages
- changing product navigation
- redesigning StoryPulse
- changing Academy
- changing table read
- changing storyboard
- changing pitch package
- adding AI features

## Route Rule

The production editor route should compose the experience but not own low-level typing logic.

The route may own:

- project fetching
- character fetching
- initial block fetching
- layout
- side panels
- StoryBuilder wiring

The route must not own:

- Enter logic
- Tab logic
- local block insertion
- caret management
- slash command state
- focused block state
- temp ID juggling

## Stop Condition

Stop when the production editor passes the same acceptance tests as `/editor-lab`.

---

# Pass 4 — Remove Old Broken Machinery

## Goal

After the local-first engine works in production, remove legacy code that can reintroduce focus/caret bugs.

## Remove or retire

- ghost `div role="button"` writing line
- temp ID → real ID focus juggling
- route-owned `pendingTempContent`
- route-owned `inFlightSaves`
- route-owned block insert/update/delete typing machinery
- per-block server-first save assumptions
- invalidation during active typing
- duplicate block type constants

## Stop Condition

Stop when:

- production editor still passes all tests
- route is slimmer
- editor engine owns writing behavior
- no old ghost/temp focus path remains

---

# Required Prompt Pattern

Every Lovable prompt for this work should begin with:

```text
Read AGENTS.md, docs/SCREENPLAY_EDITOR_CONTRACT.md, docs/EDITOR_LAB_SPEC.md, docs/EDITOR_ACCEPTANCE_TESTS.md, and docs/LOVABLE_PASS_SEQUENCE.md before making changes.

Only perform the current pass. Do not move to the next pass. Stop when the pass acceptance test is satisfied.
```

## Anti-Pattern

Do not ask Lovable:

```text
Fix the editor and make it awesome.
```

That causes large, expensive, unfocused changes.

Use small pass-based prompts instead.

## Final Rule

The page must write naturally before anything else matters.
