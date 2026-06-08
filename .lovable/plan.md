## Turn 2 — Phase 3: Editor + Coach Mode Polish

Focus on making the script editor usable for a 0% beginner and making Coach Mode actually helpful.

### 1. Editor empty-state starter
- When `script_blocks` is empty for a project, show a friendly starter card in the editor: "Start with a scene heading" + one-click button that inserts `INT. LOCATION - DAY` and an action block, then focuses the action block.
- If the user came from the guided path (`?from=guided&step=opening_scene`), pre-fill copy: "Let's write your opening scene."

### 2. Fix `insertBlockAfter` bulk update bug
- Current implementation reorders blocks one-by-one which can cause race conditions and flicker. Replace with a single batched update (collect new order, send one `upsert` with all changed `order_index` values).
- Add optimistic update so insertion feels instant.

### 3. Coach panel — mode/level aware
- Coach panel currently always renders. Gate by `user_onboarding.coaching_level`:
  - `off` → hide panel entirely
  - `gentle` → collapsed by default, single "What should I do next?" CTA
  - `active` → expanded with contextual suggestions
- Suggestions derived from current editor state:
  - 0 blocks → "Add a scene heading to start"
  - heading only → "Describe what we see — action lines"
  - action only → "Who's in the scene? Add a character + dialogue"
  - ≥1 scene complete → "Add the next scene heading"

### 4. "What should I do next?" CTA
- Single button at top of Coach panel that runs a server fn (`aiNextStepHint`) — returns 1-2 sentence guidance based on current scene state + active guided step.
- Uses Lovable AI Gateway, `google/gemini-3-flash-preview`, `createServerFn` with `requireSupabaseAuth`.

### 5. Guided breadcrumb in editor header
- If `?from=guided` in URL or active guided step is `opening_scene`/`act1`/`rough_draft`, show a pill: "← Guided: Opening Scene" linking back to `/first-screenplay/:projectId#step-<key>`.
- Complements the global `GuidedReturnBanner` with route-local context.

### 6. Block-type quick switcher
- Beginners don't know Tab/Enter shortcuts. Add a small floating toolbar on the focused block: `Heading | Action | Character | Dialogue | Parenthetical`.
- Keep existing keyboard shortcuts working.

### Technical scope
- Files to edit:
  - `src/routes/_authenticated/editor.$projectId.tsx` — empty state, breadcrumb, query param handling
  - `src/components/editor/CoachPanel.tsx` (or equivalent) — mode-aware rendering
  - `src/components/editor/ScriptBlock.tsx` (or equivalent) — block-type toolbar
  - `src/lib/script.functions.ts` — fix `insertBlockAfter` batching
  - `src/lib/academy.functions.ts` — add `aiNextStepHint`
- No DB migrations.
- No new packages.

### Out of scope (Turn 3)
- Mobile nav, auth redirect move to `_authenticated/route.tsx`, design token audit, skeleton loaders, full smoke test (Phases 4+5).

Say **"continue"** to implement Turn 2.
