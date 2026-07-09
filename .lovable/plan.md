# Plan — Exact-value `WouldTheyDoThisTab` integration tests per experience level

Extend `src/lib/story-intelligence/wouldTheyDoThisFlow.test.ts` with one `describe` block that asserts the *exact* rendered guidance shape for each onboarding `writerExperienceLevel`: `first`, `guided`, `adapting`, `experienced`, `pitching`.

No production code changes. No new files. No UI, DB, or AI changes.

## What each new test asserts

For each level we build a real `CharacterTruthResult` via `evaluateActionFit` (already used in the file), run it through `createTruthCoachOutput(result, profile)`, then through the existing `renderTab` mirror, and assert the concrete rendered shape.

### 1. `first` (basic + active)
- `tone` path: teaching (via `mode: "basic"`).
- `reasonsShown.length === Math.min(1, result.reasons.length)` (basic caps at 1).
- `missingBlockVisible === false` when a teaching prompt is present, else missing list capped at 1.
- `evidenceVisible === false`, `fixesVisible === false`.
- `headlineVisible === true`, `nextStepVisible === true`.
- If `teachingVisible`, `conceptVisible === true` (beginner concept label on).

### 2. `guided` (basic + active)
- Must render **identically** to `first`: same `reasonsShown.length`, `missingBlockVisible`, `evidenceVisible`, `fixesVisible`, `teachingVisible`, `conceptVisible`, `nextStepVisible`.
- Locks in that `guided` is treated as beginner and shares the `first` contract.

### 3. `adapting` (basic + active)
- Same exact shape as `first` and `guided` (also a beginner token in basic mode).
- Explicit assertion so a future token reshuffle can't silently demote `adapting`.

### 4. `experienced` (advanced + active)
- `reasonsShown.length === Math.min(4, result.reasons.length)`.
- `missingBlockVisible === (result.missingInputs.length > 0 && !coach.teachingPrompt)`; when visible, `missingShown.length <= 5`.
- `evidenceVisible === (result.evidence.length > 0)`.
- `fixesVisible === (result.suggestedFixes.length > 0)`.
- `conceptVisible === false` (no beginner label).
- `nextStepVisible === true`.

### 5. `pitching` (advanced + gentle — the realistic default for a pitching writer)
- `reasonsShown.length === Math.min(2, result.reasons.length)`.
- `evidenceVisible === false` (gentle hides evidence).
- `fixesVisible === (result.suggestedFixes.length > 0)` (gentle keeps fixes).
- `conceptVisible === false`.
- `nextStepVisible === true`.
- Plus an `advanced + active` variant for `pitching` asserting it matches the `experienced + active` shape — confirms `pitching` doesn't accidentally trigger beginner paths regardless of coaching level.

### 6. Cross-level exact-equality matrix
One final test builds the rendered shape for all five levels with a fixed profile pair (basic+active for beginners, advanced+active for advanced) and asserts:
- `first`, `guided`, `adapting` shapes are deeply equal to each other.
- `experienced` and `pitching` (advanced+active) shapes are deeply equal to each other.
- Beginner group shape is **not** equal to advanced group shape.

## Technical notes

- File: `src/lib/story-intelligence/wouldTheyDoThisFlow.test.ts` — append a new `describe("exact rendered guidance per onboarding experience level", …)` block; keep existing tests untouched.
- Reuse existing `makeResult()`, `render()`, `RenderedTab`, and `renderTab()` helpers already in the file — no new fixtures or engine calls beyond what's already imported.
- Assertions compare against `Math.min(cap, result.reasons.length)` and against `result.missingInputs/evidence/suggestedFixes` lengths rather than hardcoded counts, so tests stay robust to engine tuning while still pinning the exact PfHU-driven caps and visibility flags.
- Add a small helper `shapeOf(o: RenderedTab)` local to the new describe (extract the object already used in the last test) to keep matrix assertions readable.

## Out of scope

- No React mounting (vitest env is node-only for `*.test.ts`, matching the existing file).
- No changes to `writerProfileSignals.ts`, `truthCoach.ts`, or `WouldTheyDoThisTab.tsx`.
- No new onboarding tokens.

## Acceptance

- All existing tests still pass.
- Five new per-level tests + one matrix test pass.
- No UI, DB, editor, or AI changes.
