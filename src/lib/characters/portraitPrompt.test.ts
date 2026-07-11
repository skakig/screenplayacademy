import { describe, it, expect } from "vitest";
import {
  composePortraitPrompt,
  profileStrength,
  isPortraitReady,
  PORTRAIT_STRENGTH_TARGET,
} from "./portraitPrompt";

const rich = {
  name: "Stephan",
  importance: "main",
  story_function: "protagonist",
  role: "Reluctant company commander",
  external_goal: "Hold the line and protect his men",
  act2_pressure: "A collapsing front line",
  fear: "Becoming his father",
  wound: "The night his brother was taken",
  core_lie: "If I stay in control, nobody else gets hurt",
  relationships: "Hans keeps offering him mercy",
  voice_summary: "Clipped, formal, asks questions instead of answering",
  character_arc: "From self-reliance as armor to chosen vulnerability",
};

describe("portrait prompt composer", () => {
  it("counts filled fields", () => {
    expect(profileStrength({})).toBe(0);
    expect(profileStrength(rich)).toBeGreaterThanOrEqual(PORTRAIT_STRENGTH_TARGET);
    expect(isPortraitReady(rich)).toBe(true);
  });

  it("gates portraits when the profile is sparse", () => {
    expect(isPortraitReady({ name: "Only" })).toBe(false);
  });

  it("weaves wound, lie, and voice into a single prompt", () => {
    const p = composePortraitPrompt(rich);
    expect(p).toMatch(/Stephan/);
    expect(p).toMatch(/lead character presence/);
    expect(p).toMatch(/brother was taken/);
    expect(p).toMatch(/stay in control/);
    expect(p).toMatch(/Clipped, formal/);
    expect(p).toMatch(/Negative:/);
  });

  it("uses a project style contract for cast consistency", () => {
    const a = composePortraitPrompt(rich, { era: "1943 North Africa", palette: "sand and rust" });
    const b = composePortraitPrompt(
      { ...rich, name: "Hans", role: "Loyal mechanic" },
      { era: "1943 North Africa", palette: "sand and rust" },
    );
    // Both share the era + palette line — cast reads as one film.
    expect(a).toMatch(/1943 North Africa/);
    expect(b).toMatch(/1943 North Africa/);
    expect(a).toMatch(/sand and rust/);
    expect(b).toMatch(/sand and rust/);
  });
});
