# Character Truth Engine — Bridge Patch Plan

Small, contained patch so ITS/PfHU can safely build on top. No new features, no editor/autosave/schema/payment changes.

## 1. Pass real Basic/Advanced mode into the Truth Check tab

Source of truth already exists: `user_onboarding.preferred_mode` (`"guided" | "studio"`), read via `getOnboarding` and used in `ModeSettings`. Focus is separate (`useWriteMode`) and already hides the tab.

- In `src/components/characters/CharacterProfileDialog.tsx`:
  - Add a `useQuery(["onboarding"], getOnboarding)` read (or reuse if already fetched upstream) to get `preferred_mode`.
  - Compute `resolvedMode: "basic" | "advanced" = preferred_mode === "guided" ? "basic" : "advanced"`.
  - Pass `<WouldTheyDoThisTab projectId={projectId} character={local} mode={resolvedMode} />`.
- Focus behavior unchanged (tab still hidden when `focusOn`).
- Do NOT treat `useWriteMode` as Basic/Advanced.

## 2. SceneSmith → Engine scene-state adapter

New pure module `src/lib/story-intelligence/sceneStateAdapter.ts`:

```ts
export function normalizeSceneStateForTruthEngine(
  raw?: Partial<Record<string, any>> | null,
  beat?: Partial<Record<string, any>> | null,
): SceneStateLike | null
```

Mapping (nullish coalescing, no schema change):

- `scene_goal` ← `raw.goal_in_scene ?? raw.scene_goal`
- `moral_pressure` ← `raw.moral_pressure`
- `tactic` ← `raw.tactic`
- `tmh_level` ← `raw.tmh_level`
- `emotional_state` ← `raw.emotional_state`
- `fear_in_scene` ← `raw.fear_in_scene` (passed through for engine keyword checks)
- `relationship_shift` ← `raw.relationship_shift`
- `secret_status` ← `raw.secret_status`
- `scene_turn` ← `raw.scene_turn ?? beat?.scene_turn`
- `stakes_change` ← `raw.stakes_change ?? beat?.stakes_change`
- `character_choice` ← `raw.character_choice ?? beat?.climax_choice ?? beat?.scene_choice`

Returns `null` if both inputs are absent. Never throws.

If `SceneStateLike` in `characterTruthEngine.ts` is missing any of the mapped optional fields, widen the type additively (no behavior change to existing evaluators).

## 3. Fetch selected scene_arc_beat in the Truth Check tab

In `src/components/characters/WouldTheyDoThisTab.tsx`:

- Add a `useQuery` enabled by `sceneId`:
  - `supabase.from("scene_arc_beats").select("*").eq("scene_id", sceneId).maybeSingle()`.
- Before calling `evaluateActionFit` / `evaluateDialogueFit`, run raw `sceneState` and `beat` through `normalizeSceneStateForTruthEngine`.
- Graceful when no beat / no scene selected (adapter returns `null` → engine sees no scene state, existing behavior).

## 4. Tests

New `src/lib/story-intelligence/sceneStateAdapter.test.ts`:

- `goal_in_scene` maps to `scene_goal`.
- `scene_turn` sourced from beat when raw missing.
- `stakes_change` sourced from beat when raw missing.
- Missing beat does not throw and still maps raw fields.
- Both inputs absent → returns `null`.

Extend `WouldTheyDoThisTab` test coverage (or add a focused render test) confirming:

- With `mode="basic"`, only simplified sections render (no evidence toggle, no Suggested adjustment, reasons truncated).

Approved with two amendments.

This bridge patch is the right size before ITS/PfHU. It should stay small and contained.

## Amendment 1 — Scene evidence in Truth Check

The adapter should normalize `goal_in_scene`, `scene_turn`, and `stakes_change`, but Truth Check currently calls `evaluateActionFit` / `evaluateDialogueFit`, not `evaluateScenePressure`.

So either:

1. Add normalized scene fields to `evaluateActionFit` / `evaluateDialogueFit` evidence when present, without changing scoring/verdict logic, or

2. Revise acceptance so only `moral_pressure` is expected in Truth Check evidence.

Preferred: option 1. Evidence-only addition. No behavior/scoring change.

## Amendment 2 — Scene arc beat query

If `scene_arc_beats` may contain more than one row per scene, avoid fragile `.maybeSingle()` behavior.

Use a safe query pattern such as:

```ts

supabase

  .from("scene_arc_beats")

  .select("*")

  .eq("scene_id", sceneId)

  .limit(1)

  .maybeSingle()

## Files

Create:

- `src/lib/story-intelligence/sceneStateAdapter.ts`
- `src/lib/story-intelligence/sceneStateAdapter.test.ts`

Edit:

- `src/components/characters/CharacterProfileDialog.tsx` (fetch onboarding, pass `mode`)
- `src/components/characters/WouldTheyDoThisTab.tsx` (accept mode already; add beat query; run adapter)
- `src/lib/story-intelligence/characterTruthEngine.ts` (only if `SceneStateLike` needs additive fields; no logic changes)

## Out of scope

- Editor, autosave, Enter/Tab/slash behavior.
- DB schema, RLS, payments, entitlements.
- New AI calls, new UI panels, new routes.
- Refactoring `useWriteMode` or the Focus pill.
- Any ITS/PfHU work.

## Risks

- Double-fetching onboarding in the dialog — mitigate by reusing an existing query key if already in cache.
- `scene_arc_beats` may have multiple rows per scene → use `.maybeSingle()` or `.limit(1)` and treat missing as no beat.
- `SceneStateLike` field widening could ripple into engine tests — keep it additive/optional only.

## Acceptance

- Truth Check still works with no scene selected.
- Focus mode hides the tab.
- Basic user sees simplified output; Advanced sees evidence + suggestions.
- Selecting a scene surfaces `goal_in_scene`, `moral_pressure`, and beat-level `scene_turn`/`stakes_change` in engine evidence when present.
- No editor files touched. `bun test` green.