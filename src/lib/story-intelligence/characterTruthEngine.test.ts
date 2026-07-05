import { describe, it, expect } from "vitest";
import {
  evaluateActionFit,
  evaluateDialogueFit,
  evaluateScenePressure,
  summarizeMoralTrajectory,
  findMissingCharacterTruthInputs,
  detectCharacterContradictions,
  type CharacterLike,
  type SceneStateLike,
} from "./characterTruthEngine";

const bareChar: CharacterLike = { name: "HANS" };

const integrityChar: CharacterLike = {
  name: "HANS",
  external_goal: "Save his brother",
  internal_need: "Accept help",
  wound: "Was betrayed by his father as a boy",
  fear: "Being seen as weak",
  core_lie: "If I stay in control nobody gets hurt",
  voice_style: "Clipped, dry, spare",
  sentence_rhythm: "short",
  emotional_openness: "closed",
  directness_level: "indirect",
  tmh_baseline: 7,
  tmh_stress: 2,
  tmh_aspirational: 8,
};

describe("evaluateActionFit", () => {
  it("returns insufficient_data when want/need/wound are all missing", () => {
    const r = evaluateActionFit(bareChar, "Hans betrays Stephan");
    expect(r.verdict).toBe("insufficient_data");
    const missingFields = r.missingInputs.map((m) => m.field);
    expect(missingFields).toEqual(expect.arrayContaining(["external_goal", "internal_need", "wound"]));
  });

  it("L7 baseline + L2 stress under pressure → strained with stress-drop reasoning", () => {
    const scene: SceneStateLike = { moral_pressure: "His brother will die if he refuses to hand over the informant" };
    const r = evaluateActionFit(integrityChar, "Hans betrays Stephan to save his brother", { sceneState: scene });
    expect(r.verdict).toBe("strained");
    expect(r.reasons.join(" ")).toMatch(/regress|stress profile/i);
    const fields = r.evidence.map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(["tmh_baseline", "tmh_stress", "moral_pressure"]));
  });

  it("betrayal wound raises pressure on betrayal-themed action", () => {
    const scene: SceneStateLike = { moral_pressure: "informant scene" };
    const r = evaluateActionFit(integrityChar, "Hans betrays Stephan", { sceneState: scene });
    expect(r.reasons.some((s) => /betrayal wound/i.test(s))).toBe(true);
  });

  it("high-trust high-conflict relationship adds more reasons than a stranger", () => {
    const rich = evaluateActionFit(integrityChar, "Hans lies to her", {
      sceneState: { moral_pressure: "she must not know" },
      relationships: [{ related_name: "LENA", trust_level: 4, conflict_level: 4 }],
    });
    const stranger = evaluateActionFit(integrityChar, "Hans lies to her", {
      sceneState: { moral_pressure: "she must not know" },
      relationships: [{ related_name: "Stranger", trust_level: 0, conflict_level: 0 }],
    });
    expect(rich.reasons.length).toBeGreaterThan(stranger.reasons.length);
  });

  it("does not mutate its inputs", () => {
    const frozen = Object.freeze({ ...integrityChar });
    expect(() => evaluateActionFit(frozen, "Hans betrays Stephan", {
      sceneState: Object.freeze({ moral_pressure: "x" }) as SceneStateLike,
    })).not.toThrow();
  });

  it("every fired reason has evidence with a real field name", () => {
    const r = evaluateActionFit(integrityChar, "Hans betrays Stephan", { sceneState: { moral_pressure: "x" } });
    for (const e of r.evidence) {
      expect(typeof e.field).toBe("string");
      expect(e.field.length).toBeGreaterThan(0);
    }
  });
});

describe("evaluateDialogueFit", () => {
  it("florid line vs clipped voice → strained, not contradicts", () => {
    const r = evaluateDialogueFit(
      integrityChar,
      "Oh my darling, in the golden light of this endless morning I feel every silver breath of the wind whispering across my open, aching heart!",
      {},
    );
    expect(r.verdict).toBe("strained");
    expect(r.verdict).not.toBe("contradicts");
  });
});

describe("evaluateScenePressure", () => {
  it("flags moral pressure without choice or scene turn", () => {
    const r = evaluateScenePressure(integrityChar, {
      scene_goal: "Confront",
      moral_pressure: "Betray or lose the brother",
    });
    expect(r.reasons.join(" ")).toMatch(/pressure/i);
    expect(r.reasons.join(" ")).toMatch(/choice|decision/i);
  });
});

describe("summarizeMoralTrajectory", () => {
  it("flat TMH across ≥4 scene states returns a flat-arc warning", () => {
    const states: SceneStateLike[] = [
      { tmh_level: 5 }, { tmh_level: 5 }, { tmh_level: 5 }, { tmh_level: 5 },
    ];
    const t = summarizeMoralTrajectory(null, states);
    expect(t.trajectory).toBe("flat");
    expect(t.warning).toBeTruthy();
  });
});

describe("findMissingCharacterTruthInputs", () => {
  it("returns writer-facing prompts, not raw field names", () => {
    const missing = findMissingCharacterTruthInputs(bareChar);
    expect(missing.length).toBeGreaterThan(0);
    for (const m of missing) {
      expect(typeof m.prompt).toBe("string");
      // Prompt should be a real sentence, not just the field name.
      expect(m.prompt.length).toBeGreaterThan(m.field.length + 5);
      expect(m.prompt).not.toBe(m.field);
    }
  });
});

describe("detectCharacterContradictions", () => {
  it("returns structured result even when data is thin", () => {
    const r = detectCharacterContradictions(bareChar);
    expect(r).toHaveProperty("verdict");
    expect(r).toHaveProperty("missingInputs");
    expect(Array.isArray(r.missingInputs)).toBe(true);
  });
});
