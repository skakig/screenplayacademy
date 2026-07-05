import { describe, it, expect } from "vitest";
import { isLikelyCharacterName, tallyCharacters, looksLikeStructuralLine, type Block } from "./manuscriptAnalyzer";

function block(i: number, type: string, content: string): Block {
  return { id: `b${i}`, block_type: type, content, order_index: i, metadata: null };
}

describe("looksLikeStructuralLine", () => {
  const cases = [
    "INT. AFRICAN DESERT - DAY",
    "EXT. LIBYAN PLATEAU - DAY",
    "EXT LIBYAN PLATEAU DAY",
    "INT./EXT. TRUCK - MOVING - DAWN",
    "ACT 1",
    "ACT ONE",
    "SCENE 4",
    "OPENING SCENE",
    "PROLOGUE",
    "COLD OPEN",
    "MONTAGE",
    "SERIES OF SHOTS",
    "THE END",
    "FADE IN:",
    "CUT TO:",
    "12",
    "12A",
  ];
  it.each(cases)("flags %s as structural", (line) => {
    expect(looksLikeStructuralLine(line)).toBe(true);
  });
});

describe("isLikelyCharacterName", () => {
  it("rejects structural / heading lines", () => {
    for (const line of [
      "INT. AFRICAN DESERT - DAY",
      "EXT. LIBYAN PLATEAU - DAY",
      "EXT LIBYAN PLATEAU DAY",
      "ACT 1 THIS IS THE OPENING SCENE",
      "SCENE 4",
      "FADE IN:",
      "CUT TO:",
      "THE END",
      "THE",
      "AND",
    ]) {
      expect(isLikelyCharacterName(line), line).toBe(false);
    }
  });

  it("accepts normal character names", () => {
    for (const name of ["STEPHAN", "COMMANDER", "MARIA", "HANS (V.O.)", "J.T."]) {
      expect(isLikelyCharacterName(name), name).toBe(true);
    }
  });
});

describe("tallyCharacters", () => {
  it("does not include scene headings misclassified as character blocks", () => {
    const blocks = [
      block(0, "scene_heading", "INT. AFRICAN DESERT - DAY"),
      // A misclassified "character" block that is actually a heading. Must not surface.
      block(1, "character", "INT. AFRICAN DESERT - DAY"),
      block(2, "dialogue", "Something."),
      block(3, "character", "STEPHAN"),
      block(4, "dialogue", "Just a few more clicks."),
      block(5, "character", "COMMANDER"),
      block(6, "dialogue", "You are lost, soldier."),
    ];
    const names = tallyCharacters(blocks).map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(["STEPHAN", "COMMANDER"]));
    expect(names).not.toContain("INT. AFRICAN DESERT - DAY");
    expect(names).not.toContain("INT.");
  });

  it("does not surface EXT. LIBYAN PLATEAU - DAY or ACT/SCENE labels", () => {
    const blocks = [
      block(0, "character", "EXT. LIBYAN PLATEAU - DAY"),
      block(1, "dialogue", "x"),
      block(2, "character", "ACT 1 THIS IS THE OPENING SCENE"),
      block(3, "dialogue", "x"),
      block(4, "character", "SCENE 4"),
      block(5, "dialogue", "x"),
    ];
    expect(tallyCharacters(blocks)).toEqual([]);
  });

  it("requires at least one dialogue line before surfacing a speaker", () => {
    const blocks = [
      block(0, "character", "STEPHAN"), // no dialogue follows
      block(1, "scene_heading", "INT. NEXT - DAY"),
      block(2, "character", "HANS (V.O.)"),
      block(3, "dialogue", "Hello."),
    ];
    const names = tallyCharacters(blocks).map((c) => c.name);
    expect(names).toEqual(["HANS"]);
  });

  it("counts HANS (V.O.) as HANS with dialogue", () => {
    const blocks = [
      block(0, "character", "HANS (V.O.)"),
      block(1, "dialogue", "Hello."),
    ];
    expect(tallyCharacters(blocks)).toEqual([
      { name: "HANS", lineCount: 1, firstSceneIndex: 0 },
    ]);
  });
});
