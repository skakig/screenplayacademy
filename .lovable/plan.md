# Rebuild SceneSmith Editor as a Real Writing Environment

Transform `/editor/:projectId` from a single-column block list into a **three-pane writing workspace** with a true screenplay canvas, integrated Story Builder + Coach, and a learner-model (ITS/PfHU) telemetry layer.

This is a large rebuild. I'll deliver it in **3 waves** so you can use each one as it lands. You can stop after any wave.

---

## Wave A — The Workspace (the thing you see)

The visible win. After this, the editor feels like a real writing app.

### A1. Three-pane shell (`EditorWorkspace.tsx`)

```text
┌────────────┬───────────────────────────────────┬────────────┐
│  Story     │      Screenplay Canvas            │  Coach /   │
│  Navigator │   (centered page, dark surround)  │  Builder   │
│  280px     │      max-w 680px, full height     │  340px     │
└────────────┴───────────────────────────────────┴────────────┘
```

- Resizable panes via `components/ui/resizable`.
- <1024px: left + right collapse into Sheet drawers triggered from a slim top bar.
- Top bar: title · draft · autosave · page/scene counters · current block type · Story Builder · Coach mode selector.

### A2. Left pane — Story Navigator (`StoryNavigatorPane.tsx`)

Replaces today's `ManuscriptIndex`. Adds:

- Project title + draft, Guided Path progress ring, Act I/II/III dividers.
- Scene cards: number · heading · story beat · main characters (chips) · status badge (Idea/Outlined/Drafting/Needs Rewrite/Strong/Locked) · warning dot when missing purpose/turn/movement.
- Click-to-jump, drag-to-reorder, search, "+ Scene" button.

### A3. Center pane — Screenplay Canvas (`ScreenplayCanvas.tsx`)

The heart. Replace today's block list with a single scrolling page surface.

- Dark workspace surround (`bg-muted/40`), centered 8.5″-feel page (`bg-card`, shadow, max-w 680px), Courier Prime, true screenplay margins per block type.
- Inline-editable blocks with correct visual format (caps for headings/characters/transitions; centered character + narrower dialogue; right-aligned transitions; styled notes that don't export).
- Enter-key next-block logic (already in `nextBlockType.ts`).
- Keyboard: Tab cycle, Cmd/Ctrl+1–7 set block type, Cmd/Ctrl+/ palette.
- Slash menu (`/scene /action /character /dialogue /parenthetical /transition /shot /note /askcoach /storyturn /addconflict /tableread /storyboard`).
- Beautiful empty state inside the page: "Start your first scene" with Write from scratch · Story Builder · Generate from logline · Guided Path · Import.
- Keeps existing autosave, analyzer, and the sticky `EditorCommandBar`.

### A4. Right pane — Intelligent Coach (`CoachPane.tsx`)

Tabs: **Coach · Story Builder · Arc · Characters · Format · Notes · Table Read**.

- Coach mode selector (Off/Gentle/Active/Teaching) wired to existing `useCoachMode`.
- Contextual cards (formatting, scene craft, visual writing, dialogue) — rule-fired from analyzer signals; each card has Apply / Dismiss / "Teach me" → academy lesson.
- Story Builder tab = the full guided creation flow (Foundation, Characters, Arc, Scene Builder, Current Scene, Next Scene with 3 variants: safer/bolder/strange). Existing `StoryBuilder.tsx` dialog becomes the kickoff for the panel.
- Arc/Characters/Format/Table Read tabs reuse existing components (`CharacterAutocomplete`, scene arc data, table-read flow).

### A5. Empty states + redirects

- Remove seeded "INT. AFRICAN DESERT / STEPHAN" dummy content.
- New project opens with empty page + canvas empty-state, caret-ready.

**Deliverables (Wave A files):**

- `src/components/editor/EditorWorkspace.tsx`
- `src/components/editor/panes/StoryNavigatorPane.tsx`
- `src/components/editor/panes/CoachPane.tsx`
- `src/components/editor/canvas/ScreenplayCanvas.tsx`
- `src/components/editor/canvas/ScreenplayBlock.tsx`
- `src/components/editor/canvas/SlashMenu.tsx`
- `src/components/editor/canvas/CanvasEmptyState.tsx`
- `src/components/editor/coach/{CoachTab,StoryBuilderTab,ArcTab,CharactersTab,FormatTab,NotesTab,TableReadTab}.tsx`
- Rewrite `src/routes/_authenticated/editor.$projectId.tsx` to mount `<EditorWorkspace />`.

---

## Wave B — The Brain (ITS / PfHU learner model)

Makes the coach adaptive instead of generic.

### B1. Migration — 4 new tables (RLS + GRANTs)

```text
writer_profiles         one row per user, skill scores 0–100
writing_events          append-only event stream
coach_recommendations   per-project tips with status
editor_sessions         start/end + counters per session
```

All scoped by `auth.uid()` (or `owns_project()`). `service_role` granted for serverFn writes.

### B2. Event spine (`src/lib/its/writerEvents.ts`)

- `emitWriterEvent({ event_type, project_id, scene_id?, character_id?, context })` — fire-and-forget, debounced, no PII.
- Hook into existing flows: block create/type-change, scene create, character create, Story Builder open, AI request/accept/reject, coach tip shown/applied, format error detected, guided step completed, export.

### B3. Aggregator (`src/lib/its/writerProfile.functions.ts`)

- Nightly-ish (on-session-end) serverFn folds events into `writer_profiles` skill scores:
  - format errors per 100 blocks → `formatting_skill_score`
  - scenes with turn+change → `scene_craft_score`
  - dialogue accept-without-edit ratio → `ai_dependence_score`
  - etc.
- Stateless per event, stateful in aggregate (per `pfhu-runtime-orchestration` doctrine).

### B4. Recommendation engine (`src/lib/its/coachRules.ts`)

Deterministic rules → write `coach_recommendations` rows that the Coach tab renders. Examples already specified in the brief (format basics, scene turn, subtext, AI dependence, character arcs).

### B5. PfHU adaptation

Coach card density, tone, and depth read from `writer_profiles.coaching_level` × `confidence_score` × skill gaps:

- Beginner / low confidence → more examples, smaller steps.
- Pro → silent diagnostics only.
- High AI dependence → "write first, then improve" nudge before AI buttons.

---

## Wave C — Polish & Integration

- `/storyturn`, `/addconflict` slash commands wired to AI rewrite.
- "Generate opening scene from my logline" empty-state action.
- Next-scene 3-variant generator (safer/bolder/strange).
- Storyboard + Table Read launch from canvas.
- Studio Mode vs Guided Mode toggle in top bar (drives whether right pane defaults to Builder or Coach).
- Editor tour refresh for the new layout.

---

## Technical notes

- **Stack-pure:** all data writes go through `createServerFn` with `requireSupabaseAuth`; no edge functions. Analyzer + events stay client-side; aggregation is a serverFn.
- **Tokens only:** `bg-background/card/muted`, `text-foreground/muted-foreground`, `border-border`. No raw hex, no `text-white`/`bg-red-500`. Wrong-state cues use amber, not red.
- **Reuse:** keep `autoFormat.ts`, `nextBlockType.ts`, `EditorCommandBar`, `useManuscriptAnalyzer`, `StoryBuilder` dialog, `EmptyEditorTeacher`, `useAutosave`, character/scene tables and serverFns.
- **No secrets in client.** Lovable AI Gateway (`google/gemini-3-flash-preview`) via serverFn for all generation.
- **Migration ordering:** CREATE TABLE → GRANT → ENABLE RLS → POLICY in one migration per table batch.

---

## Open questions before I start

1. **Scope confirmation** — ship all three waves, or do Wave A first and review before B/C? (My recommendation: do A in one pass so the editor is usable, then B as a second pass.) Let's do Wave A first then prompt me to continue to Wave B. 
2. **Studio vs Guided default** — when a returning user opens the editor, should the right pane default to **Coach** (Studio) or **Story Builder** (Guided)? Or driven by their existing `user_onboarding.preferred_mode`? This should be their last prefrence. 
3. **Scene status badges** — auto-derived (Idea = empty, Drafting = has blocks, Needs Rewrite = analyzer flags missing purpose/turn, Strong = all arc fields filled), or also user-settable from the scene card menu? Auto-derived and user-settable. 

Once you answer these, I'll switch to build mode and start with Wave A.