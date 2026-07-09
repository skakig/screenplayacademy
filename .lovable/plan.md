## Scope

Tackle roadmap items #5 (i18n sweep), #6 (Focus Mode), #8 (writer_profiles wiring), then #4 (Academy content). A full i18n sweep of every string in the codebase is a multi-day effort; this plan does a **structured Pass 1** — infrastructure + high-visibility surfaces — and defines the follow-up pattern.

## #5 — i18n sweep (Pass 1)

- Keep the current `t()` + `keys.ts` map (no library swap — that would be a rewrite).
- Split `keys.ts` into namespaced files: `keys.editor.ts`, `keys.import.ts`, `keys.academy.ts`, `keys.common.ts`, `keys.focus.ts`, plus a new `keys.chrome.ts` for nav/toolbar/toasts.
- Add a Vitest that asserts no duplicate keys and that all keys use `namespace.…` shape.
- Migrate these high-visibility surfaces to `t()`:
  - Editor route header, toolbar, save banner, tour, empty state
  - `WriterInsightsPanel` (skills, coach recs)
  - `CoachPane`, `StoryNavigatorPane`, `FeatureDock` labels
  - Character page: cleanup panel, delete/undo toasts (Pass 1 target since it was recently touched)
- Defer: Academy lesson bodies, dialogs deep in seldom-used flows, admin surfaces. Track remainder in a checklist committed to `docs/lovable/10_I18N.md`.

## #6 — Focus Mode

- Add `focusMode` state in the editor route (persisted to `localStorage` per project).
- New `<FocusModeToggle />` button in editor header (keyboard shortcut `⌘.` / `Ctrl+.`).
- In focus mode: hide `StoryNavigatorPane`, `FeatureDock`, `CoachPane`, `WriterInsightsPanel`, `EditorSummonBar`; collapse toolbar to a minimal auto-hiding strip that appears on caret-move; widen the manuscript to `max-w-[7in]` centered; dim non-current blocks to `opacity-60` (fully readable, not black).
- Escape or toggle exits focus mode.
- Emit `focus_mode_entered` / `focus_mode_exited` writer events.

## #8 — Wire writer_profiles skill updates

- Currently `aggregateWriterProfile` only runs when `WriterInsightsPanel` mounts. Wire a real loop:
  - Debounced trigger (`aggregateWriterProfile`) after every N=25 writer events emitted in a session, tracked in a `useWriterEvents` internal counter.
  - Also trigger on `beforeunload` / route unmount (fire-and-forget).
- Expand event coverage in editor route:
  - Emit `format_error` when auto-format corrects a block (from `screenplayAutoFormat`).
  - Emit `ai_accepted` / `ai_rejected` from AI suggestion apply/dismiss handlers (already partially there — audit and fill gaps).
  - Emit `scene_created` with `has_turn: true` when a scene arc beat is added.
  - Emit `block_created` with `visual: true` when action block contains verbs from a small visual-verb list.
- Add unit test for the aggregator with a synthetic events fixture asserting expected score bands.

## #4 — Academy real curriculum

- Migration seeds two modules with real lesson bodies:
  - `screenplay-basics` (6 lessons): Scene headings, Action lines, Character cues, Dialogue rhythm, Parentheticals, Transitions.
  - `story-engine` (5 lessons): Scene turn, Goal & obstacle, Stakes change, Character wound, Moral hierarchy intro.
- Each lesson has: `title`, `slug`, `est_minutes`, `body_markdown` (~300–500 words, screenwriting-specific with 2–3 concrete before/after examples), `check_prompt` (a single reflective/practice prompt), `skill_tag` matching `writer_profiles` fields.
- Coach recs' `lesson_slug` values must resolve to seeded lessons — cross-check `coachRecommendations.functions.ts`.
- Lesson viewer route already exists (`/academy/$moduleSlug/$lessonSlug`); no route changes, just ensure it renders `body_markdown` via existing markdown pipeline.

## Order of operations

1. Pass 1 i18n infrastructure + migrate editor chrome (#5)
2. Focus Mode toggle + styling (#6)
3. Aggregation trigger + expanded event emission + test (#8)
4. Academy seed migration + content (#4)
5. Typecheck + smoke-run acceptance test steps 1–5 (typing) to confirm nothing regressed.

Approve to build, or tell me which piece to reshape (e.g. "skip focus dimming", "seed only screenplay-basics", "swap `t()` for real react-i18next now").