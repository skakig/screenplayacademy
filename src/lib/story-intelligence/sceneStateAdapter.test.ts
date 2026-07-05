import { describe, it, expect } from "vitest";
import { normalizeSceneStateForTruthEngine } from "./sceneStateAdapter";

describe("normalizeSceneStateForTruthEngine", () => {
  it("maps goal_in_scene to scene_goal", () => {
    const s = normalizeSceneStateForTruthEngine({ goal_in_scene: "Confront the officer" });
    expect(s?.scene_goal).toBe("Confront the officer");
  });

  it("prefers raw.scene_goal over goal_in_scene when both are present", () => {
    const s = normalizeSceneStateForTruthEngine({
      scene_goal: "Explicit goal",
      goal_in_scene: "Fallback goal",
    });
    expect(s?.scene_goal).toBe("Explicit goal");
  });

  it("sources scene_turn from scene_arc_beats when raw is missing it", () => {
    const s = normalizeSceneStateForTruthEngine({ moral_pressure: "x" }, { scene_turn: "Reversal" });
    expect(s?.scene_turn).toBe("Reversal");
  });

  it("sources stakes_change from scene_arc_beats when raw is missing it", () => {
    const s = normalizeSceneStateForTruthEngine(null, { stakes_change: "Brother now hostage" });
    expect(s?.stakes_change).toBe("Brother now hostage");
  });

  it("does not crash when scene_arc_beat is missing and still maps raw fields", () => {
    const s = normalizeSceneStateForTruthEngine({
      goal_in_scene: "Escape",
      moral_pressure: "Betray or die",
      tactic: "deflect",
    });
    expect(s?.scene_goal).toBe("Escape");
    expect(s?.moral_pressure).toBe("Betray or die");
    expect(s?.tactic).toBe("deflect");
  });

  it("returns null when both inputs are absent or empty", () => {
    expect(normalizeSceneStateForTruthEngine(null, null)).toBeNull();
    expect(normalizeSceneStateForTruthEngine({}, {})).toBeNull();
    expect(normalizeSceneStateForTruthEngine({ moral_pressure: "" }, { scene_turn: null })).toBeNull();
  });

  it("maps relationship_change from beat into relationship_shift", () => {
    const s = normalizeSceneStateForTruthEngine(null, { relationship_change: "trust fractures" });
    expect((s as any)?.relationship_shift).toBe("trust fractures");
  });
});
