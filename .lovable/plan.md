# Phase 3 — Connect the tabs

Right now Characters, Story Arc, StoryPulse, and Coach are separate islands. This phase wires them into the editor so the fancy names start to mean something while you write.

## What you'll feel

1. **Type a character name in the editor → it autocompletes** from your Characters tab. New names you type get offered as "Add to cast".
2. **StoryPulse shows your real script**, not placeholder numbers — scene count, page count, pacing, character screen-time pulled from actual blocks.
3. **Coach gets a "Teach me" mode** — a toggle in the Coach panel that switches its answers from "fix this line" to "explain the concept" with a link into the matching Academy lesson.
4. **Scenes ↔ Story Arc** — each scene heading shows which beat it belongs to (Setup / Inciting / Midpoint / Climax / Resolution) and you can assign from a dropdown.

## Build order

### A. Character autocomplete (editor)
- New `CharacterAutocomplete.tsx` — listens for `@` or all-caps typing inside a `character` block, queries existing characters for the project, renders a small popover.
- "Add new character" inline action → inserts into `characters` table with `auto_detected=true` so the Characters tab can show "detected from script".
- Server fn `listProjectCharacters` (read) + reuse existing create mutation.

### B. StoryPulse real data
- Replace mocked numbers in StoryPulse with a `getStoryPulse(projectId)` server fn that aggregates blocks:
  - scene count, est. page count (1 page ≈ 55 lines), avg scene length, dialogue/action ratio, character line counts.
- Keep the existing UI shell, swap data source.

### C. Coach "Teach me" mode
- Toggle in `CoachPanel` header: **Fix** | **Teach**.
- In Teach mode, the system prompt shifts to "explain the screenwriting concept behind the user's question, ≤120 words, then link the matching Academy lesson by slug".
- Coach response renders a "Open lesson →" chip when a slug is returned.

### D. Scene ↔ Arc assignment
- New table `scene_arc_assignments(project_id, scene_block_id, beat)` with RLS.
- Small beat picker rendered next to each `scene_heading` block.
- Story Arc tab reads these assignments to show which scenes fill which beat (and which beats are still empty).

## Files

**New**
- `src/components/editor/CharacterAutocomplete.tsx`
- `src/components/editor/SceneBeatPicker.tsx`
- `src/lib/characters.functions.ts` (list + detect)
- `src/lib/storypulse.functions.ts` (real aggregation)
- `src/lib/sceneArc.functions.ts`

**Edited**
- `src/routes/_authenticated/editor.$projectId.tsx` — mount autocomplete + beat picker
- `src/components/editor/CoachPanel.tsx` — Fix/Teach toggle, lesson chip
- `src/routes/_authenticated/storypulse.$projectId.tsx` — swap to real data
- `src/routes/_authenticated/story-arc.$projectId.tsx` — read scene assignments

**DB migration**
- `scene_arc_assignments` table (+ GRANT + RLS)
- `characters.auto_detected boolean default false` column

## Out of scope (saved for Phase 4–5)
- Editor empty-state templates ("Start from logline")
- Weekly check-in dashboard
- Storyboard ordering by scene

## Question for you
Want me to ship **all four (A–D)** in one turn, or start with **A + C** (the two you'll feel while writing) and do StoryPulse + Scene-Arc in a follow-up?
