import { describe, it, expect } from "vitest";
import {
  resolveWriterGuidance,
  isBeginnerExperience,
  isAdvancedExperience,
  type WriterProfileSignals,
} from "./writerProfileSignals";

describe("resolveWriterGuidance", () => {
  it("1. coachingLevel 'off' resolves to quiet/minimal with zero caps", () => {
    const g = resolveWriterGuidance({ mode: "advanced", coachingLevel: "off" });
    expect(g.depth).toBe("minimal");
    expect(g.tone).toBe("quiet");
    expect(g.maxReasons).toBe(0);
    expect(g.maxMissingInputs).toBe(0);
    expect(g.showEvidence).toBe(false);
    expect(g.showSuggestedFixes).toBe(false);
    expect(g.includeNextStep).toBe(false);
  });

  it("2. Basic + beginner resolves to teaching depth with plain language and concept label", () => {
    const g = resolveWriterGuidance({
      mode: "basic",
      coachingLevel: "gentle",
      writerExperienceLevel: "beginner",
    });
    expect(g.depth).toBe("teaching");
    expect(g.preferPlainLanguage).toBe(true);
    expect(g.includeConceptLabel).toBe(true);
    expect(g.maxReasons).toBe(1);
  });

  it("3. Basic + professional resolves to guided depth (no concept label)", () => {
    const g = resolveWriterGuidance({
      mode: "basic",
      coachingLevel: "gentle",
      writerExperienceLevel: "professional",
    });
    expect(g.depth).toBe("guided");
    expect(g.includeConceptLabel).toBe(false);
    expect(g.preferPlainLanguage).toBe(true);
  });

  it("4. Advanced + gentle hides evidence but shows suggested fixes", () => {
    const g = resolveWriterGuidance({ mode: "advanced", coachingLevel: "gentle" });
    expect(g.showEvidence).toBe(false);
    expect(g.showSuggestedFixes).toBe(true);
    expect(g.maxReasons).toBe(2);
    expect(g.tone).toBe("gentle");
  });

  it("5. Advanced + active shows evidence and full reasons", () => {
    const g = resolveWriterGuidance({ mode: "advanced", coachingLevel: "active" });
    expect(g.showEvidence).toBe(true);
    expect(g.maxReasons).toBe(4);
    expect(g.tone).toBe("diagnostic");
  });

  it("6. Advanced + teaching includes concept labels", () => {
    const g = resolveWriterGuidance({ mode: "advanced", coachingLevel: "teaching" });
    expect(g.includeConceptLabel).toBe(true);
    expect(g.showEvidence).toBe(true);
    expect(g.tone).toBe("teaching");
  });

  it("7. Advanced with null coachingLevel defaults to gentle", () => {
    const g = resolveWriterGuidance({ mode: "advanced", coachingLevel: null });
    expect(g.depth).toBe("gentle");
    expect(g.tone).toBe("gentle");
  });

  it("8. isBeginnerExperience matches expected tokens (case-insensitive)", () => {
    expect(isBeginnerExperience("beginner")).toBe(true);
    expect(isBeginnerExperience("BEGINNER")).toBe(true);
    expect(isBeginnerExperience("new")).toBe(true);
    expect(isBeginnerExperience("first_time")).toBe(true);
    expect(isBeginnerExperience("first-time")).toBe(true);
    expect(isBeginnerExperience("student")).toBe(true);
    expect(isBeginnerExperience("novice")).toBe(true);
    expect(isBeginnerExperience("professional")).toBe(false);
    expect(isBeginnerExperience(null)).toBe(false);
    expect(isBeginnerExperience("")).toBe(false);
  });

  it("9. isAdvancedExperience matches expected tokens", () => {
    expect(isAdvancedExperience("professional")).toBe(true);
    expect(isAdvancedExperience("Advanced")).toBe(true);
    expect(isAdvancedExperience("expert")).toBe(true);
    expect(isAdvancedExperience("working_writer")).toBe(true);
    expect(isAdvancedExperience("beginner")).toBe(false);
    expect(isAdvancedExperience(null)).toBe(false);
  });

  it("10. resolveWriterGuidance does not mutate the input profile", () => {
    const profile: WriterProfileSignals = {
      mode: "advanced",
      coachingLevel: "active",
      writerExperienceLevel: "professional",
    };
    const frozen = Object.freeze({ ...profile });
    const before = JSON.stringify(frozen);
    expect(() => resolveWriterGuidance(frozen)).not.toThrow();
    expect(JSON.stringify(frozen)).toBe(before);
  });

  it("11. SceneSmith onboarding values are recognized correctly", () => {
    expect(isBeginnerExperience("first")).toBe(true);
    expect(isBeginnerExperience("guided")).toBe(true);
    expect(isBeginnerExperience("adapting")).toBe(true);
    expect(isAdvancedExperience("experienced")).toBe(true);
    expect(isAdvancedExperience("pitching")).toBe(true);
  });

  it("12. Short tokens do not create false positives via substring matching", () => {
    // "pro" should not match inside unrelated words
    expect(isAdvancedExperience("program")).toBe(false);
    expect(isAdvancedExperience("improvisation")).toBe(false);
    // But "pro" itself and explicit tokens still match
    expect(isAdvancedExperience("pro")).toBe(true);
    expect(isAdvancedExperience("professional")).toBe(true);
  });
});
