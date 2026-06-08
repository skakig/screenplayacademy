# Waves 3–7: Finish the SceneSmith Studio Rebuild

Waves 1+2 shipped the cinematic shell, paper canvas, mode toggle, and feature dock. This plan completes the studio.

## Wave 3 — Story Navigator (left pane)

Edit `src/components/editor/StoryNavigatorPane.tsx`:
- Group scenes into three ACT sections (SETUP / CONFRONTATION / RESOLUTION) using existing scene index + project beat data. Acts derived from scene position (1–25%, 25–75%, 75–100%) until structured act data exists.
- Scene cards: status icon (✓ complete, ⚠ needs work, • active, ○ empty) derived from scene length + analyzer flags.
- Sticky footer card: Project Progress (% scenes with content), "View Arc" button (opens existing StoryPulse drawer), icon row: +Scene, Import, Export.
- Search/filter input at top.

## Wave 4 — Coach Pane redesign (right pane)

New files in `src/components/editor/coach/`:
- `SuggestionCard.tsx` — icon, title, observation text, "Show Examples" expand, Apply / Ignore actions. Wires to existing `coachRecommendations` serverFn.
- `TeachingMomentCard.tsx` — purple (`--purple-teach`) accent, dismissible, links to Academy lesson.
- `SceneDataCard.tsx` — editable fields for Purpose, Turn, Stakes, Moral Pressure, Theme, Character Movement. Persists via existing scene metadata serverFn (add `updateSceneMeta` if missing).
- `AskCoachInput.tsx` — sticky bottom textarea + gold send button, posts to coach recommendations.

Edit `src/components/editor/CoachPane.tsx`:
- Three tabs: **Coach** (default Studio), **Story Builder** (default Guided), **Insights** (existing WriterInsightsPanel).
- Coach tab: list of `SuggestionCard` + occasional `TeachingMomentCard` + sticky `SceneDataCard` for current scene + `AskCoachInput`.

## Wave 5 — Story Builder tab (inline, not modal)

New `src/components/editor/story-builder/StoryBuilderPanel.tsx` with collapsible sections:
1. Foundation (logline, genre, theme)
2. Characters (protagonist/antagonist quick-edit, links to Character Intelligence)
3. Arc (3-act beats checklist)
4. Scene Builder (current scene goals)
5. Current Scene (snapshot)
6. Next Scene — 3 AI variants (calls existing `generateNextScene` serverFn or stub)

Each section shows completion status dot. Reuses existing project + scene serverFns.

## Wave 6 — Feature Dock wiring

Edit `src/components/editor/FeatureDock.tsx`:
- Character Intelligence → opens existing character sheet drawer
- StoryPulse → opens manuscript analyzer drawer
- Storyboard, Table Read, Pitch Package → open polished demo sheets (`<Sheet>` with sample output + "Coming soon" badge)
- Academy → routes to `/academy`

No new serverFns; demo sheets use static fixtures.

## Wave 7 — Mode toggle behavior + polish

- `StudioModeToggle` already persists `preferred_mode`. Hook a `useOnboarding()` read at editor root and pass `mode` into `CoachPane` to set default tab + density.
- Guided mode: show compact "First Screenplay Path" step strip above canvas (5 steps, current highlighted).
- Studio mode: hide step strip, denser layout.
- Remove demo content from new-project creation flow (`createProject` serverFn — drop seed scenes if `mode === 'studio'`).
- Wire slash menu "Generate from logline" empty state to existing AI serverFn.
- Visual polish: hover states on cards, focus ring tokens, scrollbar styling on three panes.

## Files

**New (10):** `coach/SuggestionCard.tsx`, `coach/TeachingMomentCard.tsx`, `coach/SceneDataCard.tsx`, `coach/AskCoachInput.tsx`, `story-builder/StoryBuilderPanel.tsx`, `story-builder/StoryBuilderSection.tsx`, `editor/ActDivider.tsx`, `editor/SceneStatusIcon.tsx`, `editor/ProjectProgressCard.tsx`, `editor/GuidedStepStrip.tsx`

**Edited (5):** `StoryNavigatorPane.tsx`, `CoachPane.tsx`, `FeatureDock.tsx`, `editor.$projectId.tsx`, `src/styles.css` (act divider + status icon tokens)

**Reused:** all existing ITS serverFns, `useOnboarding`, `useManuscriptAnalyzer`, `useWriterEvents`, `coachRecommendations`, scene/project serverFns.

## Out of scope

- New DB tables (use existing schema)
- New AI providers
- Auth/RLS changes
- Real Storyboard/Table Read/Pitch generation (demo only this pass)

## Build order

Wave 3 → Wave 4 → Wave 5 → Wave 6 → Wave 7, shipped together. Estimate: one pass.

Ready to switch to build mode when you approve.