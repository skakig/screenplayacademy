/**
 * Integration test — proves onboarding writerExperienceLevel flows through
 * resolveWriterGuidance → createTruthCoachOutput and shapes the exact
 * rendering decisions WouldTheyDoThisTab makes for the result card.
 *
 * We mirror the component's render-time derivations rather than mounting
 * React (the vitest env is node-only and matches `*.test.ts`):
 *
 *   reasonsToShow    = result.reasons.slice(0, coach.maxReasons)
 *   missingShown     = coach.tone !== "quiet"
 *                        && result.missingInputs.length > 0
 *                        && !coach.teachingPrompt
 *                        && coach.maxMissingInputs > 0
 *   missingList      = result.missingInputs.slice(0, coach.maxMissingInputs)
 *   headlineVisible  = coach.tone !== "quiet"
 *   evidenceVisible  = coach.showEvidence && result.evidence.length > 0
 *   fixesVisible     = coach.showSuggestedFixes && result.suggestedFixes.length > 0
 *   teachingVisible  = coach.tone !== "quiet" && !!coach.teachingPrompt
 *   conceptVisible   = teachingVisible && !!coach.concept
 *   nextStepVisible  = coach.tone !== "quiet" && !!coach.nextStep
 *
 * If any assertion here fails, the tab's visible output for that onboarding
 * experience value has drifted from the PfHU signal layer contract.
 */

import { describe, it, expect } from "vitest";
import {
  evaluateActionFit,
  type CharacterTruthResult,
} from "./characterTruthEngine";
import {
  createTruthCoachOutput,
  type TruthCoachOutput,
} from "./truthCoach";

// ---------------------------------------------------------------------------
// Mirror WouldTheyDoThisTab render derivations
// ---------------------------------------------------------------------------

type RenderedTab = {
  headlineVisible: boolean;
  headline: string;
  explanationVisible: boolean;
  teachingVisible: boolean;
  conceptVisible: boolean;
  concept?: string;
  reasonsShown: string[];
  missingBlockVisible: boolean;
  missingShown: Array<{ field: string; prompt: string }>;
  fixesVisible: boolean;
  fixesShown: string[];
  evidenceVisible: boolean;
  nextStepVisible: boolean;
  nextStep?: string;
};

function renderTab(
  result: CharacterTruthResult,
  coach: TruthCoachOutput,
): RenderedTab {
  const isQuiet = coach.tone === "quiet";
  const reasonsShown = result.reasons.slice(0, coach.maxReasons);
  const teachingVisible = !isQuiet && !!coach.teachingPrompt;
  const missingBlockVisible =
    !isQuiet &&
    result.missingInputs.length > 0 &&
    !coach.teachingPrompt &&
    coach.maxMissingInputs > 0;
  const missingShown = missingBlockVisible
    ? result.missingInputs.slice(0, coach.maxMissingInputs)
    : [];
  const fixesVisible =
    coach.showSuggestedFixes && result.suggestedFixes.length > 0;
  return {
    headlineVisible: !isQuiet,
    headline: coach.headline,
    explanationVisible: !isQuiet && !!coach.explanation,
    teachingVisible,
    conceptVisible: teachingVisible && !!coach.concept,
    concept: coach.concept,
    reasonsShown,
    missingBlockVisible,
    missingShown,
    fixesVisible,
    fixesShown: fixesVisible ? result.suggestedFixes : [],
    evidenceVisible: coach.showEvidence && result.evidence.length > 0,
    nextStepVisible: !isQuiet && !!coach.nextStep,
    nextStep: coach.nextStep,
  };
}

// ---------------------------------------------------------------------------
// Fixtures — a real engine result (not hand-built), so the flow is honest
// ---------------------------------------------------------------------------

const CHARACTER = {
  id: "c1",
  name: "HANS",
  // Sparse on purpose: forces "insufficient_data" or "strained" verdict
  // with real missingInputs from the engine.
};

function makeResult(): CharacterTruthResult {
  return evaluateActionFit(
    CHARACTER as any,
    "HANS quietly hands the informant's name to the officer.",
    { sceneState: null, relationships: [], arc: null },
  );
}

function render(
  result: CharacterTruthResult,
  profile: Parameters<typeof createTruthCoachOutput>[1],
) {
  return renderTab(result, createTruthCoachOutput(result, profile));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WouldTheyDoThisTab integration flow (writerExperienceLevel → rendered output)", () => {
  it("engine produces a real result with reasons or missing inputs to render", () => {
    const r = makeResult();
    expect(r).toBeTruthy();
    expect(Array.isArray(r.reasons)).toBe(true);
    expect(Array.isArray(r.missingInputs)).toBe(true);
    // Sparse character → engine should surface something to guide the writer.
    expect(r.reasons.length + r.missingInputs.length).toBeGreaterThan(0);
  });

  it("basic + 'first' (first screenplay) → teaching tone, concept label, capped output", () => {
    const r = makeResult();
    const out = render(r, {
      mode: "basic",
      coachingLevel: "active",
      writerExperienceLevel: "first",
    });
    expect(out.headlineVisible).toBe(true);
    expect(out.nextStepVisible).toBe(true);
    // Teaching depth caps reasons tightly.
    expect(out.reasonsShown.length).toBeLessThanOrEqual(2);
    // Beginners never see raw evidence/fixes surfaces.
    expect(out.evidenceVisible).toBe(false);
    expect(out.fixesVisible).toBe(false);
    // When a teaching prompt fires, concept label must accompany it.
    if (out.teachingVisible) {
      expect(out.conceptVisible).toBe(true);
    }
  });

  it("basic + 'guided' → same beginner-friendly shape as 'first'", () => {
    const r = makeResult();
    const first = render(r, {
      mode: "basic",
      coachingLevel: "active",
      writerExperienceLevel: "first",
    });
    const guided = render(r, {
      mode: "basic",
      coachingLevel: "active",
      writerExperienceLevel: "guided",
    });
    expect(guided.reasonsShown.length).toBe(first.reasonsShown.length);
    expect(guided.evidenceVisible).toBe(first.evidenceVisible);
    expect(guided.fixesVisible).toBe(first.fixesVisible);
    expect(guided.teachingVisible).toBe(first.teachingVisible);
    expect(guided.conceptVisible).toBe(first.conceptVisible);
  });

  it("advanced + 'experienced' + active → diagnostic depth: evidence, fixes, up to 4 reasons", () => {
    const r = makeResult();
    const out = render(r, {
      mode: "advanced",
      coachingLevel: "active",
      writerExperienceLevel: "experienced",
    });
    expect(out.headlineVisible).toBe(true);
    expect(out.reasonsShown.length).toBeLessThanOrEqual(4);
    expect(out.reasonsShown.length).toBe(Math.min(4, r.reasons.length));
    if (r.evidence.length > 0) expect(out.evidenceVisible).toBe(true);
    if (r.suggestedFixes.length > 0) expect(out.fixesVisible).toBe(true);
    // Advanced writers do not get the beginner concept label.
    expect(out.conceptVisible).toBe(false);
  });

  it("advanced + 'pitching' → gentle default: evidence + fixes on, tight reason cap", () => {
    const r = makeResult();
    const out = render(r, {
      mode: "advanced",
      coachingLevel: "gentle",
      writerExperienceLevel: "pitching",
    });
    expect(out.headlineVisible).toBe(true);
    expect(out.reasonsShown.length).toBeLessThanOrEqual(2);
    if (r.evidence.length > 0) expect(out.evidenceVisible).toBe(true);
    if (r.suggestedFixes.length > 0) expect(out.fixesVisible).toBe(true);
    expect(out.conceptVisible).toBe(false);
  });

  it("coachingLevel 'off' → quiet tab: verdict headline only, no reasons/missing/next-step", () => {
    const r = makeResult();
    const out = render(r, {
      mode: "advanced",
      coachingLevel: "off",
      writerExperienceLevel: "experienced",
    });
    expect(out.headline.length).toBeGreaterThan(0);
    expect(out.headlineVisible).toBe(false); // isQuiet gates headline block
    expect(out.explanationVisible).toBe(false);
    expect(out.teachingVisible).toBe(false);
    expect(out.reasonsShown.length).toBe(0);
    expect(out.missingBlockVisible).toBe(false);
    expect(out.nextStepVisible).toBe(false);
    expect(out.evidenceVisible).toBe(false);
    expect(out.fixesVisible).toBe(false);
  });

  it("onboarding value swap changes rendered output shape (beginner vs experienced)", () => {
    const r = makeResult();
    const beginner = render(r, {
      mode: "basic",
      coachingLevel: "active",
      writerExperienceLevel: "first",
    });
    const experienced = render(r, {
      mode: "advanced",
      coachingLevel: "active",
      writerExperienceLevel: "experienced",
    });
    // The two must not render identically — that would mean the signal
    // layer is not shaping the tab.
    const shapeOf = (o: RenderedTab) => ({
      reasons: o.reasonsShown.length,
      evidence: o.evidenceVisible,
      fixes: o.fixesVisible,
      concept: o.conceptVisible,
    });
    expect(shapeOf(beginner)).not.toEqual(shapeOf(experienced));
  });

  it("unrelated onboarding token ('program') does not trip beginner or advanced paths", () => {
    const r = makeResult();
    const control = render(r, {
      mode: "advanced",
      coachingLevel: "gentle",
      writerExperienceLevel: null,
    });
    const noisy = render(r, {
      mode: "advanced",
      coachingLevel: "gentle",
      writerExperienceLevel: "program",
    });
    expect(noisy.reasonsShown.length).toBe(control.reasonsShown.length);
    expect(noisy.evidenceVisible).toBe(control.evidenceVisible);
    expect(noisy.fixesVisible).toBe(control.fixesVisible);
    expect(noisy.conceptVisible).toBe(control.conceptVisible);
  });
});
