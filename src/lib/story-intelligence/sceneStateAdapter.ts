/**
 * Adapter: SceneSmith Studio scene fields → Character Truth Engine input.
 *
 * Pure, deterministic. No schema change. Normalizes the existing
 * `character_scene_states` fields (goal_in_scene, moral_pressure, tactic,
 * tmh_level, ...) and optionally merges in a `scene_arc_beats` row so the
 * engine can see turn/stakes-level context that the writer already recorded.
 */
import type { SceneStateLike } from "./characterTruthEngine";

type AnyRow = Partial<Record<string, unknown>> | null | undefined;

function pick(...vals: unknown[]): unknown {
  for (const v of vals) {
    if (v !== null && v !== undefined && String(v).trim().length > 0) return v;
  }
  return undefined;
}

function isEmptyRow(row: AnyRow): boolean {
  if (!row) return true;
  return Object.values(row).every(
    (v) => v === null || v === undefined || (typeof v === "string" && v.trim() === ""),
  );
}

/**
 * Merge a raw `character_scene_states` row and an optional `scene_arc_beats`
 * row into the shape the engine understands. Returns `null` when there is
 * nothing meaningful to pass in.
 */
export function normalizeSceneStateForTruthEngine(
  raw?: AnyRow,
  beat?: AnyRow,
): SceneStateLike | null {
  if (isEmptyRow(raw) && isEmptyRow(beat)) return null;

  const r = (raw ?? {}) as Record<string, unknown>;
  const b = (beat ?? {}) as Record<string, unknown>;

  const out: Record<string, unknown> = {
    // Identity passthrough — harmless if missing.
    character_id: r.character_id,
    scene_id: r.scene_id ?? b.scene_id,

    // Core engine fields — SceneSmith names on the left, engine names on the right.
    scene_goal: pick(r.scene_goal, r.goal_in_scene),
    moral_pressure: pick(r.moral_pressure, b.moral_pressure),
    tactic: pick(r.tactic),
    tmh_level: r.tmh_level ?? null,

    // Beat-level context — the engine treats these as evidence when present.
    scene_turn: pick(r.scene_turn, b.scene_turn),
    stakes_change: pick(r.stakes_change, b.stakes_change),
    character_choice: pick(
      r.character_choice,
      (b as any).climax_choice,
      (b as any).scene_choice,
    ),

    // Passthrough of extra SceneSmith fields the engine may key off in future.
    emotional_state: r.emotional_state,
    fear_in_scene: r.fear_in_scene,
    relationship_shift: pick(r.relationship_shift, b.relationship_change),
    secret_status: r.secret_status,
  };

  // Strip undefined so the resulting object stays clean for tests/logs.
  for (const k of Object.keys(out)) {
    if (out[k] === undefined) delete out[k];
  }

  return out as SceneStateLike;
}
