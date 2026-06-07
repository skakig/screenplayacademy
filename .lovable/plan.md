## Goal

Inside `CharacterProfileDialog`, upgrade the existing **Arc** tab so the selected character has a real **Character Arc** editor bound to the `character_arcs` table, plus a visual **TMH Movement** preview (start → midpoint → ending, with optional regression).

The current Arc tab only edits free-text fields on the `characters` row (starting_belief, climax_choice, etc.). It does not touch `character_arcs`, so arc_type, TMH start/midpoint/ending/regression, core_lie, truth_learned, temptation, moral_test are unreachable from the dialog.

## What gets built

### 1. New component: `src/components/characters/CharacterArcSection.tsx`

A self-contained section rendered at the top of the Arc tab.

- Reads `character_arcs` for `(project_id, character_id)` via `supabase.from("character_arcs").select().eq().maybeSingle()` inside a `useQuery` keyed `["character-arc", characterId]`.
- Persists via the existing `upsertCharacterArc` server fn (already in `src/lib/arc.functions.ts`), debounced on blur per field (same pattern as `story-arc.$projectId.tsx`).
- Fields, in order:
  - **Arc Type** (select): Transformation, Fall, Flat / Tested, Redemption, Corruption, Tragedy, Coming of Age.
  - **Starting belief**, **Ending belief**, **Core lie**, **Truth learned** (textareas).
  - **Temptation**, **Moral test**, **Climax choice**, **Final image** (textareas).
  - **TMH Movement** block — four 1–9 sliders for `starting_tmh_level`, `midpoint_tmh_level`, `ending_tmh_level`, `regression_level`. Each commits on `onValueCommit`.

### 2. TMH Movement preview (inside the same section)

A compact visual strip above the sliders:

```text
[L6 Altruism] ──▶ [L2 Self-Interest] ──▶ [L7 Integrity]   (regress: L1)
   start              midpoint              ending
```

- Renders three `<TMHBadge>` chips with arrows between them. If `regression_level` is set, append a dimmed `regress: L#` chip.
- Below the chips, a 9-row horizontal sparkline rendered with inline SVG: x-axis = start / midpoint / ending; y-axis = TMH 1–9. Line color uses the band color of the **ending** level (via the existing `tmhVar(level)` helper). Dots use each point's band color. No new chart lib.
- If only some levels are filled, only those points are drawn; if none, show a muted hint: "Set TMH levels below to preview the moral arc."

### 3. Dialog wiring

In `CharacterProfileDialog.tsx`, inside the existing `<TabsContent value="arc">`:
- Mount `<CharacterArcSection projectId={projectId} characterId={characterId} />` **above** the current free-text grid.
- Keep the existing free-text grid and the "Find contradictions" card as a secondary "Notes" block titled "Arc notes (on character)" so prior data stays editable.

### 4. No schema changes, no new server fns

`character_arcs` already exists with all needed columns and RLS. `upsertCharacterArc` already exists. We only add UI and one query.

## Technical notes

- TanStack Query invalidation on save: `["character-arc", characterId]`.
- Reuse `TMH_LEVELS`, `tmhLabel`, `tmhVar`, `TMHBadge` from `src/components/characters/tmh.ts` / `TMHBadge.tsx`.
- Sliders use the shadcn `Slider`, same pattern as the TMH tab in the same dialog.
- All controls are disabled until the initial fetch resolves, to avoid overwriting a real row with empty values.
- SVG sparkline is ~220×60, semantic tokens only (`stroke`/`fill` via CSS vars), no hex literals in components.

## Out of scope (this pass)

- Editing `character_arcs` from the Characters list grid.
- Scene-by-scene TMH track (lives in StoryPulse / `character_scene_arc_states`).
- AI "Generate character arc" button (existing `analyzeCharacterArc` stays as today).