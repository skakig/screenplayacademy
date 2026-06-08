
# SceneSmith Academy + Guided/Studio Mode Build

Multi-turn build. This plan locks the architecture so every turn lands cleanly. Each phase ends in a working, navigable surface.

## Architecture overview

- **Persistence:** 5 new tables in Lovable Cloud (Supabase), all RLS-scoped.
- **AI:** 10 helpers via `createServerFn` in `src/lib/academy.functions.ts`, calling Lovable AI Gateway (`google/gemini-3-flash-preview`). Demo fallback when key missing.
- **Mode switching:** `user_onboarding.preferred_mode` ∈ `guided | studio` drives Dashboard layout, Settings toggle, and walkthrough behavior.
- **Coach Mode:** `coaching_level` ∈ `off | gentle | active | teaching` stored on `user_onboarding`; editor reads it from a `useCoachMode()` hook.
- **Lesson engine:** one reusable `<Lesson>` component renders any row from `academy_lessons`. Same component is reused inside `/first-screenplay/:projectId` steps.
- **Guided steps:** `project_guided_steps` is seeded on project creation for guided-mode users via a server fn.

## Phase 1 — Foundation (DB + onboarding + mode switch)

**Migration 1 (single migration, all 5 tables + grants + RLS + seed):**

- `user_onboarding` (1 row per user): `writer_experience_level`, `preferred_mode`, `coaching_level`, `app_walkthrough_completed bool`, `first_project_created bool`.
- `academy_modules`: `title, slug unique, description, order_index, estimated_minutes`.
- `academy_lessons`: FK `module_id`, `title, slug, concept, why_it_matters, example, task_prompt, ai_button_label, order_index, estimated_minutes`.
- `user_lesson_progress`: FK `lesson_id`, `status (not_started|in_progress|complete)`, `completed_at`, `saved_output_id uuid null`. Unique `(user_id, lesson_id)`.
- `project_guided_steps`: FK `project_id`, `step_key, title, status, output_type, output_reference_id uuid null, order_index, completed_at`. Unique `(project_id, step_key)`.

RLS: owner-scoped via `auth.uid()` (or `owns_project()` for `project_guided_steps`). Modules/lessons readable by all authenticated. GRANTs for `authenticated` + `service_role`. `update_updated_at_column` triggers on mutable tables. Seed 8 modules + ~3 starter lessons in "Start Here" + "Screenplay Foundations" (rest seeded in Phase 2).

**Code:**
- `src/lib/onboarding.functions.ts`: `getOnboarding`, `upsertOnboarding`, `markWalkthroughComplete`.
- `src/lib/academy.functions.ts` (stub for Phase 1): `seedGuidedSteps(projectId)` invoked on project create when mode = guided.
- `src/routes/_authenticated/onboarding.tsx`: 2-step flow ("What kind of writer?" → "How should SceneSmith help?"). Maps answers to `preferred_mode` + `coaching_level`. Redirects to Dashboard (studio) or `/first-screenplay/new` (guided).
- `src/routes/_authenticated/_layout.tsx` (or existing root gate): redirect to `/onboarding` if no `user_onboarding` row.
- `src/components/onboarding/AppWalkthrough.tsx`: 12-step overlay (Dashboard → Export) using shadcn `Popover` anchored to nav items; `Next / Skip / Show me later` buttons; writes `app_walkthrough_completed`.
- `src/components/settings/ModeSettings.tsx`: toggle Guided/Studio + Coach Mode select; mounted in existing Settings route.
- `src/routes/_authenticated/dashboard.tsx` (or existing): split into `<GuidedDashboard>` and `<StudioDashboard>` based on mode.
- `src/components/ProjectNav.tsx`: add Academy link; show "First Screenplay Path" link when mode = guided and an active project exists.

## Phase 2 — Academy + lesson engine

**Migration 2:** Insert remaining lessons across all 8 modules (Start Here, Screenplay Foundations, Story Architecture, Character Creation, Scene Craft, Dialogue, Rewriting, Pitching). ~4–6 lessons per module.

**Code:**
- `src/routes/_authenticated/academy.index.tsx`: module grid with progress (completed/total lessons), estimated minutes, CTA.
- `src/routes/_authenticated/academy.$moduleSlug.tsx`: lesson list with completion checkmarks.
- `src/routes/_authenticated/academy.$moduleSlug.$lessonSlug.tsx`: renders `<Lesson>`.
- `src/components/academy/Lesson.tsx`: reusable card with Title / Concept / Why it matters / Example / Try it now (textarea) / AI assist button / Save to project / Mark complete. Wired to `user_lesson_progress`.
- `src/components/academy/ContextualHelp.tsx`: `<WhyThisMatters term="logline" />` tooltip component; static dictionary of ~18 terms (logline, theme, want, need, wound, lie, scene purpose, scene turn, stakes, midpoint, climax choice, character arc, TMH baseline, TMH stress, voice, subtext, treatment, pitch). Mount in Editor/Characters/StoryPulse for the listed fields.
- `src/lib/academy.functions.ts` — first 4 AI helpers implemented: `aiGenerateLoglineOptions`, `aiGenerateThemeOptions`, `aiExplainScreenplayConcept`, `aiCoachCurrentScene`. Shared `callLovableAI()` helper with demo fallback when `LOVABLE_API_KEY` absent.

## Phase 3 — First Screenplay Path + remaining AI

- `src/routes/_authenticated/first-screenplay.$projectId.tsx`: vertical stepper of 13 steps from `project_guided_steps`. Active step renders a step view; locked steps disabled; completed steps collapsed with summary.
- `src/routes/_authenticated/first-screenplay.new.tsx`: project-creation step (Step 1) that creates the project then redirects to `/first-screenplay/:projectId`.
- `src/components/first-screenplay/GuidedStep.tsx`: per-step container with embedded `<Lesson>`, AI helper, "Save to project" (writes to `projects`, `characters`, `story_arcs`, `scenes`, etc. depending on `output_type`), completion checkbox, Next.
- Step → table mapping:

```text
Step 1  create_project         → projects
Step 2  logline                → projects.logline
Step 3  protagonist            → characters
Step 4  antagonist             → characters
Step 5  theme                  → story_arcs.theme
Step 6  story_arc              → story_arcs
Step 7  scene_cards            → scenes (bulk)
Step 8  opening_scene          → script_blocks
Step 9  act1                   → scenes.status updates
Step 10 midpoint               → story_arcs.midpoint_shift
Step 11 rough_draft            → derived from scenes/script_blocks
Step 12 table_read             → audio_assets
Step 13 pitch                  → pitch_packages
```

- `src/lib/academy.functions.ts` — remaining 6 AI helpers: `aiCreateProtagonistFromLesson`, `aiCreateAntagonistFromLesson`, `aiBuildStoryArcFromLesson`, `aiCreateSceneListFromLesson`, `aiDiagnoseBeginnerScript`, `aiGenerateRewriteExercise`.

## Phase 4 — Coach Mode in editor

- `src/hooks/use-coach-mode.ts`: reads `coaching_level` from `user_onboarding`.
- `src/components/editor/CoachPanel.tsx`: collapsible right-side card; behavior gated by level (off renders nothing, gentle only on weak-scene heuristic, active offers craft tips, teaching adds principles). Calls `aiCoachCurrentScene`. Suggestions in collapsible cards, never modal popups.
- `src/components/editor/CoachModeToggle.tsx`: dropdown in editor toolbar mirroring Settings.
- Wire `<WhyThisMatters>` tooltips into editor scene/character side panels.

## Acceptance verification

Each phase ends with a checklist mapping to the spec's 10 acceptance criteria. Phase 4 closes all 10.

## Out of scope (this build)

- Email notifications, certifications, social sharing of lessons, video lesson content, multi-user collaboration on guided path, mobile-specific layouts beyond responsive defaults.

## Notes

- Every `createServerFn` that touches user data uses `requireSupabaseAuth` (`attachSupabaseAuth` already wired in `src/start.ts`).
- No edge functions, no new secrets — `LOVABLE_API_KEY` already provisioned.
- All AI helpers return `{ ok: true, data, demo: boolean }` so UI can label demo output.
