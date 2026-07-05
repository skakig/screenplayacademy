import { describe, it, expect } from "vitest";
import { parseScreenplayText } from "./parser";

function typesFor(raw: string) {
  return parseScreenplayText(raw).map((c) => ({ text: c.raw_text, type: c.proposed_block_type }));
}

describe("parseScreenplayText — character hardening", () => {
  it("never classifies INT./EXT. slugs as characters", () => {
    const cases = [
      "INT. AFRICAN DESERT - DAY\nThe sun burns.",
      "EXT. LIBYAN PLATEAU - DAY\nHans walks.",
      "INT./EXT. TRUCK - MOVING - DAWN\nDust flies.",
    ];
    for (const raw of cases) {
      const out = typesFor(raw);
      expect(out[0].type, raw).toBe("scene_heading");
      expect(out.some((x) => x.type === "character"), raw).toBe(false);
    }
  });

  it("never classifies act/scene/structural labels as characters", () => {
    const raw = [
      "ACT 1 THIS IS THE OPENING SCENE",
      "The desert stretches on.",
      "SCENE 4",
      "More desert.",
      "COLD OPEN",
      "A radio crackles.",
      "THE END",
    ].join("\n");
    const out = typesFor(raw);
    expect(out.some((x) => x.type === "character")).toBe(false);
  });

  it("never classifies transitions or FADE IN/OUT as characters", () => {
    const raw = ["FADE IN:", "The sun rises.", "CUT TO:", "A new scene."].join("\n");
    const out = typesFor(raw);
    expect(out.some((x) => x.type === "character")).toBe(false);
  });

  it("never classifies lines ending in a time-of-day tail as characters", () => {
    const raw = "EXT LIBYAN PLATEAU DAY\nStephan walks.";
    const out = typesFor(raw);
    expect(out.some((x) => x.type === "character")).toBe(false);
  });

  it("rejects long uppercase sentences (>5 words) as characters", () => {
    const raw = "ALL OF THIS IS WAY TOO LONG TO BE A NAME\nSome dialogue?";
    const out = typesFor(raw);
    expect(out.some((x) => x.type === "character")).toBe(false);
  });

  it("still recognises real character/dialogue pairs", () => {
    const raw = "STEPHAN\nJust a few more clicks.\nCOMMANDER\nYou are lost, soldier.";
    const out = typesFor(raw);
    expect(out[0]).toMatchObject({ text: "STEPHAN", type: "character" });
    expect(out[1].type).toBe("dialogue");
    expect(out[2]).toMatchObject({ text: "COMMANDER", type: "character" });
    expect(out[3].type).toBe("dialogue");
  });

  it("recognises HANS (V.O.) as a character", () => {
    const raw = "HANS (V.O.)\nHello.";
    const out = typesFor(raw);
    expect(out[0].type).toBe("character");
    expect(out[1].type).toBe("dialogue");
  });
});
