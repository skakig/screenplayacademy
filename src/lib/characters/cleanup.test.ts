import { describe, it, expect } from "vitest";
import { detectCleanupCandidates, type CharacterRow } from "./cleanup";

const noRels = {} as Record<string, number>;
const complete = (_: CharacterRow) => 60;
const empty = (_: CharacterRow) => 0;

describe("detectCleanupCandidates", () => {
  it("flags structural junk as high-confidence", () => {
    const rows: CharacterRow[] = [
      { id: "a", name: "CUT TO:" },
      { id: "b", name: "INT. LIBRARY - DAY" },
      { id: "c", name: "EXT." },
      { id: "d", name: "ACT II" },
      { id: "e", name: "SCENE 3" },
      { id: "f", name: "FADE IN" },
      { id: "g", name: "OPENING SCENE" },
    ];
    const out = detectCleanupCandidates(rows, {
      relCounts: noRels, sceneCounts: noRels, completeness: complete,
    });
    expect(out).toHaveLength(rows.length);
    for (const c of out) expect(c.confidence).toBe("high");
  });

  it("does not flag valid names when they have some data", () => {
    const rows: CharacterRow[] = [
      { id: "1", name: "STEPHAN", role: "Hero", summary: "Layered" },
      { id: "2", name: "HANS" },
      { id: "3", name: "HANS (V.O.)" },
      { id: "4", name: "COMMANDER" },
      { id: "5", name: "J.T." },
      { id: "6", name: "MARY-ANNE" },
    ];
    const out = detectCleanupCandidates(rows, {
      relCounts: { "1": 2, "2": 1, "3": 1, "4": 1, "5": 1, "6": 1 },
      sceneCounts: { "1": 3, "2": 1, "3": 1, "4": 1, "5": 1, "6": 1 },
      completeness: complete,
    });
    expect(out).toEqual([]);
  });

  it("flags valid-name but empty stubs as low-confidence", () => {
    const rows: CharacterRow[] = [
      { id: "x", name: "STEPHAN" },
    ];
    const out = detectCleanupCandidates(rows, {
      relCounts: noRels, sceneCounts: noRels, completeness: empty,
    });
    expect(out).toHaveLength(1);
    expect(out[0].confidence).toBe("low");
    expect(out[0].reason).toBe("low_signal");
  });
});
