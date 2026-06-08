
# SceneSmith Studio — Cinematic Editor Rebuild

Rebuild `/editor/:projectId` to match the attached concept: a premium dark-mode, three-pane screenplay studio where the **page itself is the product**, not a card surrounded by buttons.

Most of the underlying systems already exist (Wave A + Wave B shipped: `StoryNavigatorPane`, `CoachPane`, `WriterInsightsPanel`, ITS event spine, writer profiles, recommendations, autosave, analyzer, slash menu logic in `nextBlockType.ts`). What's missing is the **visual rebuild** — cinematic shell, real screenplay page, integrated dock — plus a handful of polish behaviors. This plan focuses on the visible product transformation, not re-doing infrastructure.

---

## Wave 1 — Visual Shell & Theme

**1.1 Cinematic theme tokens** — extend `src/styles.css` with the exact palette:
- `--bg-canvas: #070A0E`, `--bg-pane: #10161D`, `--bg-pane-2: #131A22`
- `--gold: #F5B83D` (primary accent), `--purple-teach: #8B5CF6`, `--blue-insight: #3B82F6`
- `--paper: #F4F1E8` (screenplay page color), `--ink: #1a1a1a` (page text)
- Soft border `rgba(255,255,255,0.08)`, premium shadows
- New semantic tokens: `--surface-canvas`, `--surface-pane`, `--surface-paper`, `--accent-gold`, `--accent-teach`, `--accent-insight`

**1.2 Top bar (`EditorTopBar.tsx`)** — replaces current header strip:
- Logo · Project selector · Draft pill · Autosave dot · **Studio Mode / Guided Mode toggle (centered)** · AI Assistant · Table Read · Storyboard · Pitch Package · Avatar
- Slim, full-width, sits above the three panes

**1.3 Three-pane resizable shell** — replace current single-column layout with `ResizablePanelGroup`:
```
[ 300px Story Navigator | flex Canvas | 380px Coach ]
```
- Both side panes collapsible (chevron buttons)
- <1024px: side panes become Sheet drawers triggered from top bar

---

## Wave 2 — The Screenplay Canvas (the heart)

**2.1 Cinematic surround** — center pane = dark `bg-canvas` workspace with the screenplay page floating on it (warm paper color, shadow, ~680px max width, full height with vertical scroll).

**2.2 Formatting toolbar** above the page:
- Block-type dropdown · B / I / U · alignment · lists · zoom · more
- Right side: page count · word count · scene count · undo/redo · copy · focus mode

**2.3 Real screenplay block rendering** — refactor block list into `ScreenplayBlock.tsx` with true screenplay margins:
- Scene Heading: UPPERCASE, left, bold
- Action: full width
- Character: UPPERCASE, centered above dialogue
- Dialogue: narrower centered column
- Parenthetical: narrower under character, italic
- Transition: UPPERCASE, right-aligned
- Shot: UPPERCASE left
- Note: distinct (muted/boxed), excluded from export
- Courier Prime, real page-feel margins

**2.4 Page chrome** — page numbers in corner, optional scene numbers in margin, footer strip "Page 1 of N · words · scenes".

**2.5 Empty-state inside the page** (only when no blocks):
"Start your first scene" + 5 options: Write from scratch · Story Builder · Generate from logline · Guided Path · Import.

**2.6 Reuse existing**: `autoFormat.ts`, `nextBlockType.ts` (Enter logic), keyboard shortcuts (Cmd/Ctrl+1–7), slash menu, `useAutosave`, analyzer.

---

## Wave 3 — Story Navigator Polish (left pane)

Refine existing `StoryNavigatorPane.tsx`:
- Header: "Story Navigator" + search/filter/+ buttons (gold accent)
- Group scenes by **ACT 1 — SETUP / ACT 2 — CONFRONTATION / ACT 3 — RESOLUTION** dividers (derive from `scene_arc_beats.act`)
- Scene card: # · heading · beat · character chips · status icon (✓ green / ⚠ amber / • red / ○ empty)
- Sticky bottom: Project Progress card with bar, %, "X of Y drafted", **View Arc** button, +Scene, import/export icons

---

## Wave 4 — Coach Pane Polish (right pane)

`CoachPane.tsx` already has all 7 tabs (Coach · Story Builder · Arc · Characters · Format · Notes · Table Read). Visual upgrade only:
- Coach tab: redesign suggestion cards (icon · title · observation · Show Examples / Apply / Ignore)
- Purple `Teaching Moment` card variant
- Editable scene-data cards (Scene Purpose / Turn / Stakes / Moral Pressure / Theme / Character Movement) — already partly in `ArcSidebar`, surface inline
- Sticky "Ask Coach…" input at bottom with gold send button
- Story Builder tab: stop being just a button — show inline sections (Foundation / Characters / Arc / Scene Builder / Current Scene / Next Scene 3 variants) with completion status

---

## Wave 5 — Feature Dock

New `FeatureDock.tsx` below the three-pane workspace (collapsible strip):
6 cards in a row, each links to its route:
Character Intelligence · StoryPulse · Storyboard · Table Read · Pitch Package · Academy.
Each: small icon/visual preview · title · one-line description. Premium dark cards with subtle gold hover.

---

## Wave 6 — Mode Toggle Wiring

- Studio/Guided toggle in top bar reads/writes `user_onboarding.preferred_mode`
- **Guided Mode**: right pane defaults to Story Builder tab, Coach cards denser, shows current First Screenplay Path step strip under top bar with "Step X of 13 · Continue"
- **Studio Mode**: right pane defaults to Coach tab, minimal teaching cards, clean

---

## Wave 7 — Polish

- Remove any remaining seeded "INT. AFRICAN DESERT / STEPHAN" demo content from new-project flow
- Slash commands `/storyturn`, `/addconflict`, `/tableread`, `/storyboard` wired to existing serverFns
- Empty-state "Generate opening scene from my logline" → existing AI serverFn
- Editor tour refresh for new layout

---

## Files

**New:**
- `src/components/editor/EditorTopBar.tsx`
- `src/components/editor/EditorWorkspace.tsx` (three-pane shell)
- `src/components/editor/canvas/ScreenplayCanvas.tsx`
- `src/components/editor/canvas/ScreenplayBlock.tsx`
- `src/components/editor/canvas/CanvasToolbar.tsx`
- `src/components/editor/canvas/CanvasEmptyState.tsx`
- `src/components/editor/FeatureDock.tsx`
- `src/components/editor/coach/SuggestionCard.tsx`, `TeachingMomentCard.tsx`, `SceneDataCard.tsx`, `AskCoachInput.tsx`

**Edited:**
- `src/styles.css` — cinematic palette tokens
- `src/routes/_authenticated/editor.$projectId.tsx` — mount `<EditorWorkspace />`, drop legacy layout
- `src/components/editor/StoryNavigatorPane.tsx` — act dividers, polish
- `src/components/editor/CoachPane.tsx` — Story Builder inline sections, card redesigns

**Reused as-is:** `autoFormat.ts`, `nextBlockType.ts`, `EditorCommandBar`, `useManuscriptAnalyzer`, `useAutosave`, `WriterInsightsPanel`, all ITS infra, all serverFns.

---

## Out of scope (already done or separate)

- DB schema (writer_profiles, writing_events, coach_recommendations, editor_sessions exist)
- ITS rules engine (Wave B shipped)
- Auth/RLS (already enforced)
- New AI edge functions (existing serverFns reused)

---

## Build order recommendation

Ship **Wave 1 + 2** first (theme + screenplay canvas) — that's the visual transformation the user is asking for. Then Wave 3–7 as a second pass.

**Question before I switch to build:** Ship Wave 1 + 2 in one pass (the editor will look and feel rebuilt), or do all 7 waves before handing back?
