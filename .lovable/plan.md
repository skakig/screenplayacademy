# ITS/PfHU First Integration Pass — Truth Coach Adapter

Translate Character Truth Engine results into writer-facing coaching, gated by onboarding mode + coaching level. No new DB, no AI, no editor changes, no new routes, no dashboard.

## Files to create

1. `**src/lib/story-intelligence/truthCoach.ts**` — pure TS module.
  - No React / Supabase / AI / UI imports. Deterministic. Does not mutate input.
  - Exports:
    - Types: `WriterMode` (`"basic" | "advanced"`), `CoachingLevel` (`"off" | "gentle" | "active" | "teaching"`), `WriterProfileForCoach`, `TruthCoachOutput`.
    - `createTruthCoachOutput(result, profile): TruthCoachOutput` — main entry point.
    - `selectPrimaryMissingInput(result)` — picks the single most useful missing field (priority: `wound` → `external_goal` → `internal_need` → `fear` → `core_lie` → first available).
    - `explainVerdictForWriter(result, profile)` — verdict-specific headline + explanation.
    - `getNextWriterAction(result, profile)` — one-line "do this next".
  - Rule shape (see Behavior below).
2. `**src/lib/story-intelligence/truthCoach.test.ts**` — Vitest coverage for the 10 acceptance tests listed in the prompt.

## Files to edit

1. `**src/components/characters/WouldTheyDoThisTab.tsx**`
  - Accept new props: `coachingLevel?: CoachingLevel | null`, `writerExperienceLevel?: string | null`.
  - After `analyze()` produces `result`, compute `coach = createTruthCoachOutput(result, { mode, coachingLevel, writerExperienceLevel })`.
  - Route existing Basic/Advanced display through `coach` instead of scattered `isBasic` conditions:
    - `coach.maxReasons` caps the reasons list.
    - `coach.showSuggestedFixes` gates the "Suggested adjustment" block.
    - `coach.showEvidence` gates evidence toggle + list.
    - Render new coaching block above the raw reasons: `headline`, `explanation`, optional `teachingPrompt`, optional `nextStep`. Tone class from `coach.tone`.
  - `coachingLevel === "off"` → render verdict + confidence only (no headline block, no teaching prompt, no next step, no missing-input prompts).
2. `**src/components/characters/CharacterProfileDialog.tsx**`
  - Pass through onboarding fields already fetched via `useOnboarding()`:

## Behavior rules (encoded in `truthCoach.ts`)

**Coaching off** → `{ tone: "quiet", headline: verdictLabel, explanation: "", showEvidence: false, showSuggestedFixes: false, maxReasons: 0 }`. No teaching prompt, no next step.

**Basic Mode** (`mode === "basic"`, coaching on):

- `tone: "teaching"`, `maxReasons: 1`, `showEvidence: false`, `showSuggestedFixes: false`.
- Headline uses plain writer language ("Not enough character truth yet", "This fits", "This feels off under pressure", "This contradicts who they are").
- `teachingPrompt` = `selectPrimaryMissingInput(result).prompt` when verdict is `insufficient_data` OR when confidence is `"low"` and a primary missing input exists.
- `nextStep` = one imperative sentence ("Answer that first, then run Truth Check again." / "Make the pressure visible on the page." / "Keep writing — this rings true.").
- Missing inputs list capped at 2 items, phrased as craft questions (already the case in the engine).

**Advanced Mode** (coaching on):

- `tone: "diagnostic"`, `maxReasons: result.reasons.length`, `showEvidence: true`, `showSuggestedFixes: true`.
- Headline uses diagnostic phrasing ("Fits under stress, strains the aspirational arc", etc.).
- `explanation` may reference TMH regression, wound sensitivity, voice mismatch when those evidence sources are present.
- `nextStep` still surfaces but honest about uncertainty for low confidence.

**Verdict → next step matrix** (both modes):

- `fits` + high confidence → "Keep writing."
- `fits` + medium/low → "Trust it, but watch how the next beat lands."
- `strained` → "Make the pressure visible on the page." (Basic) / "Show the pressure that justifies this behavior, or soften the beat." (Advanced)
- `contradicts` → "Either raise the pressure until this fits, or pick a different action." 
- `insufficient_data` → "Answer the question above, then run Truth Check again."

**PfHU-lite**: only reads `mode`, `coachingLevel`, `writerExperienceLevel` from the profile. `writerExperienceLevel === "beginner"` bumps tone toward gentler phrasing (still Basic caps). No writes, no logs, no new fields.

## Tests to add (`truthCoach.test.ts`)

1. `coachingLevel: "off"` returns `tone: "quiet"`, no `teachingPrompt`, no `nextStep`, `showEvidence: false`.
2. Basic + `insufficient_data` (bare char) → `teachingPrompt` matches the primary missing input's prompt (wound question).
3. Basic caps `maxReasons` to 1.
4. Basic sets `showEvidence: false` and `showSuggestedFixes: false`.
5. Advanced sets `showEvidence: true` and `showSuggestedFixes: true`.
6. `strained` verdict → `nextStep` contains "pressure".
7. `fits` verdict + high confidence → `nextStep` encourages continuing, no over-explanation.
8. Missing `wound` maps to a craft question (contains "hurt" / "past" / "wound" as sentence, not the raw field name).
9. Low-confidence result includes an honest-uncertainty phrase in `explanation` (e.g. "first-pass", "based on what you've told me").
10. Calling `createTruthCoachOutput` on a frozen result does not throw and does not mutate `result.reasons` / `result.missingInputs` / `result.evidence`.

## UI behavior changes

- Truth Check tab gains a small coaching header card above existing "Why / Suggested adjustment / Missing / Evidence" sections.
- Basic writers see: one headline, one plain-language question, one next step. Reasons capped to 1, no evidence, no suggested fixes.
- Advanced writers see: diagnostic headline + explanation + full reasons + suggested fixes + evidence toggle (current behavior, now driven by the adapter).
- Coaching off writers see: verdict badge + confidence only (matches "quiet" tone).
- Focus mode still hides the tab entirely (unchanged, via `useWriteMode` gate in the dialog).

Approved with two amendments.

The plan is the right size and direction:

- pure `truthCoach.ts`

- tests

- no DB

- no AI

- no editor changes

- no dashboard

- onboarding-driven coaching behavior

- `WouldTheyDoThisTab` uses the adapter instead of scattered Basic/Advanced conditions

Please apply these amendments before coding.

## Amendment 1 — Basic Mode should focus on one primary teaching prompt

In Basic Mode, if `teachingPrompt` exists, show that as the main prompt.

Do not overwhelm the writer with multiple missing-input questions at once.

If a missing-input list is still shown, cap it to 1 primary item by default, or place secondary missing inputs behind a subtle “More to fill later” disclosure.

Basic Mode principle:

> one useful next step, not a checklist.

## Amendment 2 — Keep TMH language mostly out of Basic Mode

In Basic Mode, prefer plain screenplay language over TMH labels.

Use language like:

- “under pressure”

- “when cornered”

- “what they justify”

- “what choice reveals them”

- “what past hurt makes them overreact”

Avoid leading with:

- “TMH regression”

- “L7 baseline”

- “L2 stress”

Advanced Mode may use TMH terminology when evidence supports it.

## Everything else is approved

Proceed with:

- `src/lib/story-intelligence/truthCoach.ts`

- `src/lib/story-intelligence/truthCoach.test.ts`

- pass `coachingLevel` and `writerExperienceLevel` into `WouldTheyDoThisTab`

- route Truth Check display through `createTruthCoachOutput`

- respect `coachingLevel === "off"`

- keep Focus mode hidden

- no new DB

- no AI

- no editor changes

## Risks

- Adapter drifting into duplicating engine logic. Mitigation: adapter only reformats/prioritizes; all rule firing stays in the engine.
- Basic-mode phrasing feeling condescending. Mitigation: neutral craft questions, no exclamation, no "you should".
- Onboarding row absent for older users → both `coachingLevel` and `writerExperienceLevel` will be `null`. Adapter must default sensibly (treat null coachingLevel as `"gentle"` → normal coaching on).
- Tests coupling too tightly to phrasing. Mitigation: assert on substrings / structure, not exact strings.

## Out of scope

- No DB schema changes, no migrations, no RLS edits.
- No new PfHU tables, no logs, no persistent writer profile learning.
- No AI calls, no server functions.
- No new routes, no dashboard, no new tab.
- No TMH upsell / premium report CTA yet.
- No changes to `useScreenplayDocument`, `ScreenplayLine`, `screenplayKeymap`, screenplay persistence, autosave, Enter/Tab/slash behavior.
- No changes to `evaluateDialogueFit` scene-awareness (deferred).
- No Director's Chair integration, no cross-script dashboards, no inline screenplay annotations.
- No payments / webhooks / entitlements changes.