# PfHU Signal Layer Pass — Implementation Plan

## 1. Files to create

`**src/lib/story-intelligence/writerProfileSignals.ts**` — Pure TypeScript. No React, Supabase, AI, or UI imports.

Exports:

- Types: `WriterGuidanceDepth`, `WriterProfileSignals`, `ResolvedWriterGuidance`
- `isBeginnerExperience(level?)` — matches (case-insensitive, trimmed): `beginner`, `new`, `new_writer`, `first_time`, `first-time`, `student`, `novice`, `learning`, `hobbyist`
- `isAdvancedExperience(level?)` — matches: `advanced`, `professional`, `pro`, `expert`, `experienced`, `working_writer`, `produced`
- `resolveWriterGuidance(profile)` — returns `ResolvedWriterGuidance` following the matrix below. Never mutates input.

Resolution matrix (checked in order):


| Condition                        | depth      | tone       | maxReasons | maxMissing | evidence | fixes | plainLang | conceptLabel | nextStep |
| -------------------------------- | ---------- | ---------- | ---------- | ---------- | -------- | ----- | --------- | ------------ | -------- |
| coachingLevel === "off"          | minimal    | quiet      | 0          | 0          | false    | false | true      | false        | false    |
| basic + beginner                 | teaching   | teaching   | 1          | 1          | false    | false | true      | true         | true     |
| basic + other                    | guided     | teaching   | 1          | 1          | false    | false | true      | false        | true     |
| advanced + gentle (default)      | gentle     | gentle     | 2          | 3          | false    | true  | false     | false        | true     |
| advanced + active                | diagnostic | diagnostic | 4          | 5          | true     | true  | false     | false        | true     |
| advanced + teaching              | teaching   | teaching   | 4          | 5          | true     | true  | false     | true         | true     |
| advanced + unknown coachingLevel | gentle     | gentle     | 2          | 3          | false    | true  | false     | false        | true     |


Null/unknown values fall back to `advanced + gentle` when mode is `advanced`, and `basic + non-beginner` when mode is `basic`.

`**src/lib/story-intelligence/writerProfileSignals.test.ts**` — 10 tests per the prompt.

## 2. Files to edit

`**src/lib/story-intelligence/truthCoach.ts**`

- Import `resolveWriterGuidance` and call it once at the top of `createTruthCoachOutput`.
- Replace hardcoded `isBasic ? ... : ...` display flags (`showEvidence`, `showSuggestedFixes`, `maxReasons`, `tone`) with values from the resolved guidance.
- Keep verdict/headline/explanation/teachingPrompt/concept/nextStep logic in this file — the coach still owns writer-facing wording.
- Gate `nextStep` on `guidance.includeNextStep`.
- Gate `concept` on `guidance.includeConceptLabel`.
- Coaching-off short-circuit still returns quiet output, but the display flags now come from `resolveWriterGuidance` for consistency.
- Extend `TruthCoachOutput.tone` union to include `"gentle"` (advanced+gentle case).
- Add an optional `maxMissingInputs: number` field on `TruthCoachOutput` so the UI can cap displayed missing inputs.

`**src/components/characters/WouldTheyDoThisTab.tsx**`

- Read `coach.maxMissingInputs` and slice the missing-inputs list before rendering.
- Continue honoring `coach.maxReasons`, `showEvidence`, `showSuggestedFixes`.
- Only render the "Next step" line when `coach.nextStep` is present.
- Only render the concept label when `coach.concept` is present.
- No new UI panels, tabs, or routes.

## 3. Tests to add

`writerProfileSignals.test.ts`:

1. coachingLevel="off" → depth minimal, tone quiet, all caps 0, no next step
2. basic + "beginner" → teaching depth, plain language, concept label on
3. basic + "professional" → guided depth, no concept label
4. advanced + gentle → evidence hidden, fixes shown, maxReasons 2
5. advanced + active → evidence shown, maxReasons 4
6. advanced + teaching → concept label on, evidence shown
7. null/undefined coachingLevel + advanced mode → safe default (gentle)
8. `isBeginnerExperience` matches beginner/new/first_time/student (case-insensitive)
9. `isAdvancedExperience` matches professional/advanced/expert
10. `resolveWriterGuidance` does not mutate input (Object.freeze test)

Update `truthCoach.test.ts` only where existing assertions conflict with new signal-driven values (e.g. tests that asserted `tone: "diagnostic"` for advanced+gentle would now expect `"gentle"`). Keep existing test names/intents intact.

## 4. How profile signals change Truth Check behavior

- **Coaching off**: verdict-only badge, no reasons, no missing inputs, no next step.
- **Basic beginner**: one plain-language reason, one craft prompt, concept label ("Character wound"), one next step.
- **Basic non-beginner**: same shape, no concept label — assumes writer recognizes the craft term.
- **Advanced gentle** (default advanced): up to 2 reasons, up to 3 missing inputs, suggested fixes shown, evidence still hidden to keep the panel calm.
- **Advanced active**: full diagnostic — 4 reasons, 5 missing inputs, evidence + fixes.
- **Advanced teaching**: diagnostic + concept labels (writer wants to learn the vocabulary too).

Approved with two amendments.

This is the right next pass. It creates a PfHU signal layer without adding DB tables, AI calls, logs, dashboards, or editor changes.

Proceed with:

- `src/lib/story-intelligence/writerProfileSignals.ts`

- `src/lib/story-intelligence/writerProfileSignals.test.ts`

- updates to `truthCoach.ts`

- updates to `WouldTheyDoThisTab.tsx`

- minimal updates to `truthCoach.test.ts`

## Amendment 1 — Add Truth Coach integration tests

In addition to `writerProfileSignals.test.ts`, update `truthCoach.test.ts` to prove the coach actually obeys the resolved signals.

Add/update tests for:

1. Advanced + gentle hides evidence but still shows suggested fixes.

2. Advanced + active shows evidence.

3. Advanced + teaching includes concept labels.

4. Basic + beginner includes concept labels.

5. Basic + professional/advanced experience does not include concept labels.

6. Coaching off still returns verdict-only behavior.

## Amendment 2 — Advanced gentle should still feel advanced

Advanced + gentle may hide evidence by default, but it should not feel like Basic Mode.

Advanced + gentle should still:

- show suggested fixes

- allow up to 2 reasons

- use diagnostic language when appropriate

- avoid beginner/tutorial phrasing

- preserve the sense that this is a professional writing tool

## Everything else is approved

Keep all hard boundaries:

- no editor changes

- no autosave changes

- no screenplay behavior changes

- no DB schema changes

- no AI calls

- no new route

- no new dashboard

- no TMH upsell yet

## 5. Risks

- Existing `truthCoach.test.ts` assertions that hardcoded `tone: "diagnostic"` for advanced now need updating for the gentle default. Mitigation: update in the same pass, re-run all 30 tests.
- `writerExperienceLevel` values in the wild are free-text — beginner/advanced detection must be conservative and default to "neither" when unsure, so unknown values fall into the safe `basic non-beginner` / `advanced gentle` buckets.
- Widening `TruthCoachOutput.tone` union is a low-risk type change; UI currently doesn't switch on tone, but confirm before shipping.

## 6. Out of scope

- `useScreenplayDocument`, `ScreenplayLine`, `screenplayKeymap`, screenplay persistence, autosave, Enter/Tab/slash behavior
- Payments, webhooks, entitlements
- Persistent PfHU logs, DB schema, new tables, RLS
- AI calls of any kind
- TMH upsell CTA, full TMH reports
- Director's Chair, Dramatic Pulse, inline screenplay annotations
- New UI panels, tabs, routes, or dashboards
- Changes to onboarding schema or `use-onboarding` hook