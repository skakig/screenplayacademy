# Full Sweep — Beginner-Proof End-to-End Path + App Polish

## Goal

Guarantee that a 0% beginner can land in the app and be carried from "I have nothing" → finished rough draft → pitch package, without ever hitting a dead-end, broken AI button, locked step, or confusing screen. Then fix bugs and polish UX across the rest of the app.

This is a multi-turn build. Each phase ships a working, navigable surface.

---

## Phase 1 — Beginner Pathway Continuity (biggest user value)

Make sure the guided path actually flows. Today there are gaps: the editor steps don't auto-complete when the user writes, completion is manual, and several "destination → return" loops don't exist.

1. **Guarantee Step 1 (create_project) auto-completes.** When entering `first-screenplay/$projectId`, auto-mark `create_project` as `complete` and unlock Step 2 (the project already exists). User shouldn't have to click "Mark complete" on a step that's literally done.
2. **Editor-driven step completion.** For `opening_scene`, `act1`, `rough_draft` steps, detect progress automatically:
   - `opening_scene` → complete when ≥1 `scene_heading` block + ≥5 action/dialogue blocks exist.
   - `act1` → complete when ≥3 scenes exist and total block count ≥40 (rough heuristic).
   - `rough_draft` → complete when total block count ≥150 OR user explicitly marks complete.
   Add a small "Auto-detected progress" hint in the step card so the user understands.
3. **"Back to guided path" breadcrumb everywhere.** When the user clicks `Open editor` / `Open characters` / `Open story-arc` / `Open scenes` / `Open pitch` / `Open tableread` from a guided step, add a sticky banner at the top of those pages: "Step N of First Screenplay Path — Return to guided path →". Only visible when `?from=guided` query param is set, or when an in-progress guided project exists.
4. **Resume on reload.** Persist current step focus in URL hash (`#step-protagonist`) so reloading the guided page scrolls to where the user was.
5. **Onboarding → first-project handoff.** After onboarding for guided users, route to `/projects/new` (not `/dashboard`) when the user has zero projects. Today both branches go to `/dashboard`, forcing an extra click. For studio users with zero projects, also push to `/projects/new`.
6. **Empty-state Guided Dashboard CTA.** When the user has no project yet, the "Create your first project" button should be bigger, with an explanation of what the path will do (13 steps, ~ time estimate, what they'll end with).

## Phase 2 — Guided Step Card Reliability

The card has several rough edges that break trust for a beginner.

1. **AI button enabled for ALL steps that have an `aiHelper`.** Currently `create_project`, `opening_scene`, `act1`, `table_read`, `pitch` have no helper — give them one or remove the visual void:
   - `opening_scene` → reuse `aiGenerateRewriteExercise` as "Draft an opening scene" with a tuned prompt.
   - `act1` → "Outline Act 1 beats" (new helper variant of arc).
   - `table_read` → keep no AI, but show a friendly "Open Table Read to hear it" CTA instead of empty toolbar.
   - `pitch` → already has destination; surface "Generate pitch" via existing pitch route.
2. **Lock state is too punitive.** If a user wants to jump ahead and look at the brief for Step 5, today it just says "Complete the previous step." Render the concept/why/example **read-only** even when locked, with a soft "Unlock by finishing Step N" footer.
3. **AI output panel: clear, copy, regenerate, accept-and-apply.** Add a `Regenerate` button next to `Use as my answer` and `Copy`. Add `Accept & Apply to project` as a one-click combo so a beginner doesn't have to understand the 3-button workflow (Use → Apply → Mark complete).
4. **"Mark complete" disabled when there is nothing.** Today you can mark complete with empty draft+AI and the step just saves null. Disable when both are empty for `APPLIABLE_STEPS`, with hover text "Write something or run the AI helper first."
5. **Error toasts include actionable next step**, not raw server messages. Map common failures (no AI credits, rate limit, parse error) to friendly copy.

## Phase 3 — Editor + Coach Mode Fine-Tuning

1. **Coach Panel visibility tied to mode + level.** If `coaching_level === "off"`, hide the panel entirely (not just collapsed). If user is in guided mode, default-open the panel.
2. **Coach panel "What should I do next?" CTA** — for guided-mode users, the panel shows the active First Screenplay step title + a "Continue path" link. This is the single most important beginner safety-net.
3. **`/scene` slash-shortcut UX.** Confirm shortcuts still trigger; add a hint chip on first empty block: `Tip: type /scene, /char, /dialogue to switch block types.`
4. **Insert-block scaling bug.** `insertBlockAfter` re-normalizes the whole project on each insert with N round-trips — this stalls in large scripts. Replace with a single bulk update: select all blocks ordered, recompute indexes, send one `upsert` array. (Bug fix.)
5. **Empty-editor friendly state.** When the project has 0 blocks, render a starter prompt: "Start with `/scene INT. LOCATION — TIME`" + one-click "Insert your first scene heading" button.

## Phase 4 — Onboarding + Auth + Cross-App Polish

1. **Auth → onboarding → dashboard chain.** Confirm the `_authenticated` gate redirects un-onboarded users to `/onboarding` (today the redirect lives in `dashboard.tsx`, so other routes skip it). Move the redirect into `_authenticated/route.tsx` so every authenticated page enforces it.
2. **`AppShell` mobile nav.** Ensure the nav collapses cleanly at ≤803 px (user's current viewport). Verify ProjectNav doesn't overflow.
3. **Design tokens audit.** Sweep `src/components/guided/*`, `src/components/dashboard/GuidedDashboard.tsx`, `onboarding.tsx`, `projects.new.tsx` for raw color literals like `bg-secondary`, `border-border/60` consistency. Replace one-off opacities (`/30`, `/40`, `/60`) with consistent tokens (`/40` standard for subtle borders).
4. **Typography consistency.** Standardize on `font-display` for h1/h2 across guided/dashboard/onboarding/settings (some pages mix `font-bold` w/o `font-display`).
5. **Loading states.** Replace `"Loading…"` text-only with a small `Skeleton` component on dashboard, first-screenplay, characters, scenes pages.

## Phase 5 — Verification

For each phase: smoke-test the end-to-end happy path in the preview:
- New user signs up → onboarding → guided dashboard → create project → 13 steps → editor → pitch.
- AI helper runs on at least 4 distinct steps and the output is applied to the right table.
- Re-opening project resumes at the right step.
- Coach Mode toggles work in editor.

Run lint/build between phases.

## Out of scope (this build)

- Real export to PDF/Fountain.
- Multi-user collaboration.
- New AI models or providers.
- New pages beyond what's listed.
- Major DB schema changes (only small column additions if strictly needed; none planned today).

## Technical notes

- All AI helpers stay on `createServerFn` with `requireSupabaseAuth` + Lovable AI Gateway, `google/gemini-3-flash-preview`. No new secrets.
- Auto-step-completion logic runs client-side in `first-screenplay.$projectId.tsx` using existing `blocks` and `scenes` queries; it calls `updateGuidedStep` once per detection to avoid re-triggering.
- Breadcrumb banner is a new `<GuidedReturnBanner>` mounted in `AppShell` when route matches editor/characters/scenes/story-arc/pitch/tableread AND the active project has an in-progress guided step.
- No migration is required for the planned work; if Phase 3 #2 needs a "current step" field, we'll derive it from `project_guided_steps.status === 'in_progress'` rather than add a column.

## Phase order & turns

- **Turn 1:** Phase 1 (pathway continuity) + Phase 2 (step card reliability).
- **Turn 2:** Phase 3 (editor + coach).
- **Turn 3:** Phase 4 (onboarding gate + design polish) + Phase 5 (verification).

Approve to start Turn 1.
