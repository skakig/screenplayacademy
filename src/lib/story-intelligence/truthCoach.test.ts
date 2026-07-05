import { describe, it, expect } from "vitest";
import {
  createTruthCoachOutput,
  selectPrimaryMissingInput,
} from "./truthCoach";
import type { CharacterTruthResult } from "./characterTruthEngine";
import {
  evaluateActionFit,
  type CharacterLike,
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

function fakeResult(overrides: Partial<CharacterTruthResult> = {}): CharacterTruthResult {
  return {
    verdict: "fits",
    confidence: "high",
    reasons: ["one", "two", "three"],
    suggestedFixes: ["fix one"],
    missingInputs: [],
    evidence: [{ source: "character", field: "external_goal", value: "x" }],
    ...overrides,
  };
}

describe("selectPrimaryMissingInput", () => {
  it("prioritizes wound over other missing fields", () => {
    const r = fakeResult({
      missingInputs: [
        { field: "fear", prompt: "?" },
        { field: "wound", prompt: "wound prompt" },
        { field: "external_goal", prompt: "?" },
      ],
    });
    expect(selectPrimaryMissingInput(r)?.field).toBe("wound");
  });
});

describe("createTruthCoachOutput", () => {
  it("1. coachingLevel 'off' returns quiet output with no teaching prompt or next step", () => {
    const r = evaluateActionFit(integrityChar, "Hans betrays Stephan", {
      sceneState: { moral_pressure: "brother will die" },
    });
    const out = createTruthCoachOutput(r, { mode: "advanced", coachingLevel: "off" });
    expect(out.tone).toBe("quiet");
    expect(out.teachingPrompt).toBeUndefined();
    expect(out.nextStep).toBeUndefined();
    expect(out.showEvidence).toBe(false);
    expect(out.showSuggestedFixes).toBe(false);
    expect(out.maxReasons).toBe(0);
  });

  it("2. Basic + insufficient_data surfaces a teaching prompt from the primary missing input", () => {
    const r = evaluateActionFit(bareChar, "Hans betrays Stephan");
    const out = createTruthCoachOutput(r, { mode: "basic", coachingLevel: "gentle" });
    expect(r.verdict).toBe("insufficient_data");
    expect(out.teachingPrompt).toBeDefined();
    const primary = selectPrimaryMissingInput(r);
    expect(out.teachingPrompt).toBe(primary?.prompt);
  });

  it("3. Basic caps maxReasons to 1", () => {
    const out = createTruthCoachOutput(fakeResult(), {
      mode: "basic",
      coachingLevel: "gentle",
    });
    expect(out.maxReasons).toBe(1);
  });

  it("4. Basic hides evidence and suggested fixes", () => {
    const out = createTruthCoachOutput(fakeResult(), {
      mode: "basic",
      coachingLevel: "gentle",
    });
    expect(out.showEvidence).toBe(false);
    expect(out.showSuggestedFixes).toBe(false);
  });

  it("5. Advanced shows evidence and suggested fixes", () => {
    const out = createTruthCoachOutput(fakeResult(), {
      mode: "advanced",
      coachingLevel: "gentle",
    });
    expect(out.showEvidence).toBe(true);
    expect(out.showSuggestedFixes).toBe(true);
    expect(out.maxReasons).toBe(3);
  });

  it("6. strained verdict produces a next step about making pressure visible", () => {
    const out = createTruthCoachOutput(
      fakeResult({ verdict: "strained", confidence: "medium" }),
      { mode: "basic", coachingLevel: "gentle" },
    );
    expect(out.nextStep?.toLowerCase()).toMatch(/pressure/);
  });

  it("7. fits + high confidence encourages continuing without over-explaining", () => {
    const out = createTruthCoachOutput(
      fakeResult({ verdict: "fits", confidence: "high" }),
      { mode: "basic", coachingLevel: "gentle" },
    );
    expect(out.nextStep?.toLowerCase()).toMatch(/keep writing/);
    // Basic should stay short — no diagnostic essay.
    expect(out.explanation.length).toBeLessThan(200);
  });

  it("8. Missing wound maps to a craft question, not the raw field name", () => {
    const r = evaluateActionFit(bareChar, "Hans betrays Stephan");
    const out = createTruthCoachOutput(r, { mode: "basic", coachingLevel: "gentle" });
    expect(out.teachingPrompt).toBeDefined();
    expect(out.teachingPrompt).not.toBe("wound");
    expect(out.teachingPrompt!.length).toBeGreaterThan(20);
    // No raw field-name jargon
    expect(out.teachingPrompt!).not.toMatch(/tmh_|_id\b/i);
  });

  it("9. Low-confidence results include an honest-uncertainty phrase", () => {
    const out = createTruthCoachOutput(
      fakeResult({ verdict: "strained", confidence: "low" }),
      { mode: "basic", coachingLevel: "gentle" },
    );
    expect(out.explanation.toLowerCase()).toMatch(/first-pass|based on what/);
  });

  it("10. does not mutate the input result", () => {
    const r = fakeResult({
      verdict: "strained",
      confidence: "low",
      missingInputs: [{ field: "wound", prompt: "What past hurt?" }],
    });
    const before = JSON.stringify(r);
    const frozen = Object.freeze(r);
    expect(() =>
      createTruthCoachOutput(frozen as CharacterTruthResult, {
        mode: "advanced",
        coachingLevel: "teaching",
      }),
    ).not.toThrow();
    expect(JSON.stringify(r)).toBe(before);
  });

  it("Basic mode avoids TMH jargon in the headline and explanation", () => {
    const r = evaluateActionFit(integrityChar, "Hans betrays Stephan", {
      sceneState: { moral_pressure: "brother will die" },
    });
    const out = createTruthCoachOutput(r, { mode: "basic", coachingLevel: "gentle" });
    expect(out.headline).not.toMatch(/TMH|L\d/);
    expect(out.explanation).not.toMatch(/TMH|L\d baseline|regression/i);
  });
});
