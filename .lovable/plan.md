
# What's actually broken

You're right — the current app has the *parts* of a great screenplay tool (Editor, Scenes, Characters, Story Arc, StoryPulse, Storyboard) but no *spine* connecting them. A beginner lands on "Guided Path → Open editor" and is dropped into a blank typewriter with no idea what a scene heading is, why character matters, or what arc they're building. The fancy tabs feel like unrelated toys.

A genius screenplay app does three things the current one doesn't:
1. **Teaches you while you write** (not in a separate "course" you'll never open).
2. **Every tab feeds the others** — your characters show up in dialogue autocomplete, your story arc lights up scene cards, StoryPulse reads your real pages.
3. **The guided path is the app**, not a separate page you visit once.

# The plan — 5 phases

## Phase 1 — Screenplay University (the missing brain)

A new `/academy` hub plus inline mini-lessons that appear *exactly where you need them*.

- **`/academy` landing**: 4 tracks — Fundamentals (format, sluglines, action vs dialogue), Character (archetypes, want vs need, arc types: positive/negative/flat), Plot (3-act, Save the Cat beats, Hero's Journey, Kishōtenketsu), Style (genre voice, tone, dialogue craft).
- **Lesson format**: 2–3 min read + 1 example from a real screenplay + "Try it in your script" button that deep-links into the Editor with a pre-seeded prompt block.
- **Inline "Learn this" chips**: every empty state (no characters yet, no arc set, blank scene) shows a tiny "New to this? 60-sec primer →" link that opens the relevant lesson in a side sheet without leaving the editor.
- **AI Coach lessons**: Coach Panel gains a "Teach me" mode — ask "what's a character arc?" and get a contextual answer that references *your* characters.

## Phase 2 — One continuous Guided Path (fix the hand-off)

Right now Guided Path → Editor = cliff. Fix it:

- **Persistent guided rail**: when a project is in guided mode, the Editor (and every other tab) shows a slim left rail with the current step ("Step 3 of 12: Write your opening scene"), a "What to do now" hint, and Prev/Next.
- **Step-aware editor**: opening the editor from a guided step pre-seeds the right block type and shows a ghost-text example ("INT. COFFEE SHOP — DAY") the user can tab-accept.
- **Completion = real progress**: steps auto-complete when you actually do the thing (added a character → character step ✓), not just by clicking Next.
- **Guided steps span every tab**: Characters tab, Story Arc tab, Storyboard all participate in the path — the rail follows you.

## Phase 3 — Make the tabs actually connect

The tabs need to share data so they stop feeling decorative.

- **Characters → Editor**: typing a character name autocompletes from your Characters list; adding a new CHARACTER block offers "Save to cast."
- **Story Arc → Scenes**: each scene card shows which beat it serves (Inciting Incident, Midpoint, etc.); drag scenes onto the arc to assign.
- **StoryPulse → real script**: pacing/tension graph reads actual block counts and dialogue density from the current script, not mock data.
- **Storyboard → Scenes**: each scene gets an optional image slot; the storyboard view is just scenes in order.
- **Scenes tab**: becomes the *outline* view — reorder, split, merge, jump-to-editor.

## Phase 4 — Editor that actually works for beginners

- **Fix save reliability**: verify the autosave we just shipped is firing on every block (toast on failure, not silent).
- **"Start writing" empty state**: instead of dumping you into a blank page, show 3 big choices — "Start from a logline" (AI scaffolds 3 scenes), "Start from a template" (genre templates), "Start blank."
- **Inline format helper**: a thin always-visible strip under the active block says "This is an ACTION line — describe what we see, present tense" with a "?" for the full lesson.
- **Keyboard-first**: Tab cycles block types (industry standard); show the legend.
- **Scene-at-a-time view toggle**: beginners write one scene; advanced users see the whole script.

## Phase 5 — The "writing partner" loop

Tie it together with one always-on AI surface:

- **Coach Panel upgrade**: knows your logline, characters, arc, and current scene. Suggestions are specific ("Sarah hasn't spoken in 8 pages — is she still in this scene?") not generic.
- **"What should I do next?"** button on every screen routes to the most valuable next action across the whole project, not just the current tab.
- **Weekly check-in**: dashboard shows pages written, scenes completed, which arc beats are still empty.

# Technical sketch

```text
src/routes/_authenticated/
  academy.tsx                  (NEW — hub)
  academy.$trackId.tsx         (NEW — track)
  academy.$trackId.$lessonId.tsx (NEW — lesson)

src/components/
  academy/                     (NEW — LessonCard, TrackProgress, InlinePrimer)
  guided/GuidedRail.tsx        (NEW — persistent left rail, replaces banner)
  editor/FormatHelper.tsx      (NEW — active-block hint strip)
  editor/EmptyStateChoices.tsx (NEW — logline/template/blank)
  editor/CharacterAutocomplete.tsx (NEW)
  coach/TeachMeMode.tsx        (NEW — lesson-aware coach)

src/lib/
  academy.content.ts           (NEW — lesson data, ~12 lessons to start)
  guided/stepCompletion.ts     (NEW — auto-detect step completion from project state)
  storypulse.functions.ts      (UPDATE — read real blocks)

DB:
  academy_progress (user_id, lesson_id, completed_at)
  scene_arc_assignments (scene_id, beat_id)
  characters gets `auto_detected` flag for inline-created characters
```

# What I'd ship first (if you say go)

I'd do this in 2 build turns:

**Turn A — the spine** (Phases 1 + 2): Academy hub with 6 starter lessons, persistent GuidedRail across all tabs, step auto-completion, editor empty-state with 3 choices, inline "Learn this" chips on every empty state.

**Turn B — the connections** (Phases 3 + 4 + 5): character autocomplete, scenes-to-arc linking, StoryPulse reads real data, Coach "Teach me" mode, format helper strip.

# One question before I build

Do you want me to (a) **go big** — ship Turn A end-to-end now (Academy + GuidedRail + new empty state, ~12 files), or (b) **start with the highest-pain fix** — just the GuidedRail + Academy hub + 3 inline lessons so you can feel the difference before I wire up the rest?
