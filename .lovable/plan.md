
# StoryPulse — Arc Engine

Make every scene answer one question: *what changes because this scene exists?* The Arc Engine sits inside the screenplay editor and across a dedicated timeline page, tracking story beats, character moral movement (TMH 1–9), relationship shifts, and scene strength.

Public-facing name: **StoryPulse**. Internal/system name: **Arc Engine**.

---

## 1. Database (one migration)

Four new tables, all RLS-scoped via `owns_project(project_id)`, with `authenticated` + `service_role` grants and `updated_at` triggers.

- `story_arcs` — project-level arc: type, structure model, central question, theme, opening/midpoint/darkest/climax/final state.
- `character_arcs` — per character: arc type (Transformation, Fall, Flat/Tested, Redemption, Corruption), starting/ending belief, core lie, truth learned, TMH start/midpoint/ending/regression levels, temptation, moral test, climax choice, final image.
- `scene_arc_beats` — per scene: act, sequence, story beat, scene purpose, external plot change, relationship change, moral pressure, theme connection, stakes change, scene turn, question raised, question answered, emotional charge 1–10, scene strength 0–100, arc status (Unreviewed / Strong / Needs Work / Missing Turn / No Character Movement / No Stakes Change).
- `character_scene_arc_states` — per (scene, character): goal, need, lie believed, tactic, emotional state start/end, TMH start/end, arc movement (Rise / Fall / Regression / Revelation / Resistance / No Change), cost, revelation, relationship shift. Unique `(scene_id, character_id)`.

Note: existing `character_scene_states` overlaps partially; we keep it (already wired to characters hub) and add the richer `character_scene_arc_states` for editor-driven beats. Future cleanup can merge them.

---

## 2. Editor sidebar — `Arc` tab

Right sidebar on `/editor/$projectId` gets four tabs: **AI Assistant**, **Arc**, **Characters**, **Notes**. The Arc tab is contextual to the currently selected scene (derived from the cursor's nearest `scene_heading` block).

Sections inside the Arc tab:

- **Scene Arc** — editable form bound to `scene_arc_beats`, auto-saving on blur. Includes a top "Arc Header" preview that can also be pinned above the script block in Write Mode.
- **Character Movement** — for each character appearing in the scene, an expandable card editing `character_scene_arc_states` (TMH sliders, arc movement chip, cost, revelation).
- **AI Arc Tools** — buttons listed in the spec (Find scene turn, Strengthen character movement, Add moral pressure, Connect scene to theme, Raise stakes, Make protagonist choose, Pressure the wound, Diagnose weak scene, Suggest stronger ending, Suggest midpoint reversal, Strengthen climax choice, Fix Act 2 sag). Each calls a server fn; polished demo output when `LOVABLE_API_KEY` is absent — never dead.

Editor itself gets a small collapsible **Scene Arc Header** rendered above each scene heading block, showing purpose / beat / turn / TMH movement, so writers see the arc inline without leaving Write Mode.

---

## 3. New page — Arc Timeline (`/arc-timeline/$projectId`)

Horizontal/vertical scrollable timeline with one card per scene in `order_index`. Each card shows: scene number, heading, act, story beat, purpose, turn, stakes change, main characters (avatars), scene strength score, arc status badge, color-coded movement strip (Plot / Char / Rel / Moral / Weak).

- Filters: All / Weak / No Turn / No Character Movement / No Stakes Change / Protagonist / Antagonist / Relationship / High Moral Pressure.
- **Character Track**: select a character → timeline filters to scenes featuring that character, showing TMH path (L_start → L_end), cost, revelation, and a sparkline of the TMH trajectory.
- Warnings rail (live, computed client-side from the data): long protagonist silence, repeated emotional state, flat arc stretches, ending vs. wound mismatch, climax-vs-TMH mismatch.

---

## 4. New pages — Story Arc & Character Arc

- `/story-arc/$projectId` — single editable record from `story_arcs` with structure-model picker (Three-Act Feature, Five-Act TV, Save the Cat, Hero's Journey, Short Film, TV Pilot, Comic Issue, Audio Drama).
- Character Arc lives as a new **Arc** tab inside the existing `CharacterProfileDialog` so it stays in the Characters hub. Stores into `character_arcs` and reuses the TMH sliders + arc-type select.

Both are added to the project nav (`ProjectNav.tsx`).

---

## 5. Server functions (`src/lib/arc.functions.ts`)

All use `requireSupabaseAuth`, validate with Zod, and re-check ownership via `owns_project`. CRUD upserts plus AI generators:

- `upsertSceneArc`, `upsertCharacterSceneArc`, `upsertStoryArc`, `upsertCharacterArc`.
- `findSceneTurn`, `strengthenCharacterMovement`, `addMoralPressure`, `connectSceneToTheme`, `raiseStakes`, `makeProtagonistChoose`, `pressureTheWound`, `diagnoseWeakScene`, `suggestStrongerEnding`, `suggestMidpointReversal`, `strengthenClimaxChoice`, `fixAct2Sag`.
- `diagnoseProject` — returns a structured warning list (weak scenes, flat protagonist stretch, antagonist silence, wound unresolved, repeated TMH band in climax).
- `computeSceneStrength` — deterministic 0–100 score from filled fields + presence of turn/stakes/choice; no AI required, so it always works.

AI calls go through the existing `callJson` / `callText` helpers in `characters.functions.ts` (Lovable AI Gateway, Gemini Flash). Demo fallbacks return polished, project-aware text built from the scene/character fields.

---

## 6. Diagnostics & scene strength

`computeSceneStrength` runs on every scene save and after AI tools, writing back to `scene_arc_beats.scene_strength_score` and `arc_status`. Categories scored: clear objective, conflict, turn, story-state change, character-state change, stakes rise, theme link, visual action, ending momentum. Surfaced as a chip on each card and a "Strong / Needs work" breakdown in the sidebar.

---

## Technical notes

- All new tables follow the four-step pattern (CREATE → GRANT → ENABLE RLS → POLICY) using `owns_project(project_id)` (already executable by `authenticated`).
- Use `useServerFn` + TanStack Query mutations; invalidate `["scene-arc", sceneId]`, `["scene-arcs", projectId]`, `["character-arc", characterId]`, `["story-arc", projectId]`.
- Sidebar tabs use existing `Tabs` primitive; the editor's current right pane gets refactored to host them without disturbing the autosave loop or `/slash` aliases shipped earlier.
- Color coding uses existing semantic tokens (`--primary`, `--accent`, `--destructive`, `--muted`) plus the TMH band colors already defined for `TMHBadge`.
- Demo outputs deterministic: same input → same text, so users never see blank states.

---

## Build order (matches the spec)

1. Migration + `scene_arc_beats` fields wired into the editor's Arc sidebar tab.
2. `character_scene_arc_states` editor + collapsible Scene Arc Header in Write Mode.
3. AI Arc Tools (server fns + buttons, with demo fallbacks).
4. `/arc-timeline/$projectId` page with filters and Character Track.
5. `/story-arc/$projectId` page + Character Arc tab in the Characters hub.
6. `diagnoseProject` warnings rail + scene strength scoring everywhere.

---

## Out of scope (this pass)

- Merging the older `character_scene_states` into `character_scene_arc_states` (kept side-by-side for now).
- Drag-to-reorder on the timeline (uses existing `order_index` only).
- Realtime multi-writer collaboration.
- Export of arc data to PDF/Final Draft (future pitch package work).
