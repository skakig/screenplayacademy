# PfHU Signal Layer — Onboarding Value Alignment Patch

## Problem

`writerProfileSignals.ts` currently maps generic beginner/advanced tokens like `"beginner"`, `"new"`, `"pro"`, etc. SceneSmith's real onboarding values are `"first" | "guided" | "experienced" | "adapting" | "pitching"`, so a user selecting "My first screenplay" (stored as `"first"`) is not recognized as a beginner. Also, `n.includes(t)` substring matching risks false positives from short tokens like `"pro"`.

## Plan

### 1. Update token arrays and matching logic

**File:** `src/lib/story-intelligence/writerProfileSignals.ts`

- Add SceneSmith-native tokens to `BEGINNER_TOKENS`: `"first"`, `"guided"`, `"adapting"`.
- Add SceneSmith-native tokens to `ADVANCED_TOKENS`: `"experienced"`, `"pitching"`.
- Replace `n.includes(t)` with a safer `matchesToken(n, t)` helper that supports:
  - exact match
  - underscore / dash / space normalized match (e.g. `"first_time"` matches `"first time"`)
  - word-boundary match (prevents short tokens like `"pro"` from matching inside unrelated words)
- Update `isBeginnerExperience` and `isAdvancedExperience` to use the new helper.

### 2. Update tests

**File:** `src/lib/story-intelligence/writerProfileSignals.test.ts`

- Add tests proving:
  - `isBeginnerExperience("first") === true`
  - `isBeginnerExperience("guided") === true`
  - `isBeginnerExperience("adapting") === true`
  - `isAdvancedExperience("experienced") === true`
  - `isAdvancedExperience("pitching") === true`
  - Short token `"pro"` does not create false positives (e.g. `"improvisation"`, `"professional"` still matches via exact token but a generic `"program"` does not match `"pro"`)
- Verify all existing 44 tests still pass.

## Acceptance

- All existing 44 tests pass.
- New tests pass.
- No UI changes.
- No DB changes.
- No editor changes.
- No AI.

Approved.

This is the correct hardening patch before we move on.

Please proceed with:

- adding SceneSmith-native onboarding tokens:

  - beginner/guided: `first`, `guided`, `adapting`

  - advanced/studio: `experienced`, `pitching`

- replacing broad `includes()` matching with safer token matching:

  - exact match

  - normalized separator match

  - safe word-boundary match

- adding tests for:

  - `first`

  - `guided`

  - `adapting`

  - `experienced`

  - `pitching`

  - `pro` not falsely matching unrelated words like `program` or `improvisation`

One note:

Keep `professional` as an advanced match because it is already an explicit advanced token. Just make sure `pro` itself does not become a broad substring match.

No UI changes.

No DB changes.

No editor changes.

No AI.

## Out of scope

- Persistent PfHU logs, TMH upsell CTA, full TMH reports, Director's Chair, Dramatic Pulse, inline screenplay annotations, database schema changes, AI integration.