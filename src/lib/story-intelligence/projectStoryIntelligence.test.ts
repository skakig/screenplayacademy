import { describe, expect, it } from "vitest";
import {
  assembleStoryIntelligence,
  nameSimilarity,
  normalizeName,
  parseLocationFromHeading,
  type AssemblerInput,
} from "./projectStoryIntelligence.functions";

const projectId = "p1";
const universe = { id: "u1", name: "Test Universe" };

function baseInput(overrides: Partial<AssemblerInput> = {}): AssemblerInput {
  return {
    project: { id: projectId, title: "Test", user_id: "user-1" },
    universe,
    characters: [],
    aliases: [],
    relationships: [],
    sceneStates: [],
    scenes: [],
    scriptBlocks: [],
    sources: [],
    candidates: [],
    evidence: [],
    worldLocations: [],
    worldFactions: [],
    worldEvents: [],
    worldRules: [],
    worldArtifacts: [],
    worldThreads: [],
    worldTimeline: [],
    bibles: [],
    ...overrides,
  };
}

describe("normalizeName / parseLocationFromHeading / nameSimilarity", () => {
  it("normalizes punctuation and case", () => {
    expect(normalizeName("  JOHN'S CAFE! ")).toBe("johns cafe");
  });
  it("parses INT/EXT heading and trims time-of-day", () => {
    expect(parseLocationFromHeading("INT. DESERT CAMP - NIGHT")).toEqual({
      rawText: "DESERT CAMP",
      normalizedKey: "desert camp",
    });
    expect(parseLocationFromHeading("EXT. CITY STREET - DAY")?.normalizedKey).toBe(
      "city street",
    );
    expect(parseLocationFromHeading("")).toBeNull();
    expect(parseLocationFromHeading(null)).toBeNull();
  });
  it("similarity: identical == 1, close == high, distant == low", () => {
    expect(nameSimilarity("JOHN", "JOHN")).toBe(1);
    expect(nameSimilarity("JOHN", "JOHN D.")).toBeGreaterThan(0.85);
    expect(nameSimilarity("JOHN", "MARY")).toBeLessThan(0.5);
  });
});

describe("assembleStoryIntelligence", () => {
  it("returns empty universe-scoped counts when universe is null", () => {
    const r = assembleStoryIntelligence(baseInput({ universe: null }));
    expect(r.universe).toEqual({ id: null, name: null, isDefault: false });
    expect(r.world.locations.count).toBe(0);
    expect(r.candidates.unresolved).toBe(0);
  });

  it("marks characters as manual vs imported based on promoted candidates", () => {
    const input = baseInput({
      characters: [
        { id: "c-manual", name: "MANUAL", importance: null, quarantined_at: null },
        { id: "c-imp", name: "IMPORTED", importance: "lead", quarantined_at: null },
      ],
      candidates: [
        {
          id: "cand-1",
          candidate_type: "character",
          normalized_key: "imported",
          status: "accepted",
          document_id: "d1",
          promoted_ref: { table: "characters", id: "c-imp" },
          proposed_payload: null,
        },
      ],
      evidence: [{ candidate_id: "cand-1" }, { candidate_id: "cand-1" }],
    });
    const r = assembleStoryIntelligence(input);
    const manual = r.characters.find((c) => c.id === "c-manual")!;
    const imported = r.characters.find((c) => c.id === "c-imp")!;
    expect(manual.source).toBe("manual");
    expect(manual.evidenceCount).toBe(0);
    expect(imported.source).toBe("imported");
    expect(imported.evidenceCount).toBe(2);
  });

  it("reports manual characters missing from latest Bible", () => {
    const input = baseInput({
      characters: [
        { id: "c-manual", name: "MANUAL", importance: null, quarantined_at: null },
        { id: "c-imp", name: "IMPORTED", importance: null, quarantined_at: null },
      ],
      candidates: [
        {
          id: "cand-1",
          candidate_type: "character",
          normalized_key: "imported",
          status: "accepted",
          document_id: null,
          promoted_ref: { table: "characters", id: "c-imp" },
          proposed_payload: null,
        },
      ],
      bibles: [
        {
          version: 1,
          created_at: "2024-01-01",
          entries: [{ character_id: "c-imp" }],
        },
      ],
    });
    const r = assembleStoryIntelligence(input);
    expect(r.diagnostics.manualCharactersMissingFromBible).toEqual(["c-manual"]);
    expect(r.characters.find((c) => c.id === "c-imp")!.latestBible).toEqual({
      version: 1,
      included: true,
    });
    expect(r.characters.find((c) => c.id === "c-manual")!.latestBible).toEqual({
      version: 1,
      included: false,
    });
    expect(r.bibles.latestVersion).toBe(1);
  });

  it("detects scene locations, links to world_locations, and flags unlinked", () => {
    const input = baseInput({
      scenes: [
        { id: "s1", scene_heading: "INT. DESERT CAMP - NIGHT", order_index: 0 },
        { id: "s2", scene_heading: "EXT. UNKNOWN PLACE - DAY", order_index: 1 },
      ],
      scriptBlocks: [
        { id: "b1", scene_id: "s1", block_type: "scene_heading", character_id: null, content: null },
        { id: "b2", scene_id: "s1", block_type: "dialogue", character_id: "c-x", content: "hi" },
      ],
      worldLocations: [
        { id: "wl1", name: "Desert Camp", normalized_key: "desert camp", candidate_id: "cand-9" },
      ],
    });
    const r = assembleStoryIntelligence(input);
    expect(r.scenes[0].detectedLocations[0].normalizedKey).toBe("desert camp");
    expect(r.scenes[0].detectedLocations[0].sourceBlockId).toBe("b1");
    expect(r.scenes[0].linkedWorldLocationIds).toEqual(["wl1"]);
    expect(r.scenes[0].characters).toEqual([
      { characterId: "c-x", basis: "dialogue" },
    ]);
    expect(r.scenes[1].linkedWorldLocationIds).toEqual([]);
    expect(r.diagnostics.sceneLocationsWithoutWorldLink).toEqual(["s2"]);
  });

  it("proposes duplicate characters with confidence + reasonCode + evidence", () => {
    const r = assembleStoryIntelligence(
      baseInput({
        characters: [
          { id: "a", name: "JOHN", importance: null, quarantined_at: null },
          { id: "b", name: "JOHN D.", importance: null, quarantined_at: null },
          { id: "c", name: "MARY", importance: null, quarantined_at: null },
        ],
      }),
    );
    expect(r.diagnostics.possibleCharacterDuplicates).toHaveLength(1);
    const dup = r.diagnostics.possibleCharacterDuplicates[0];
    expect(dup.aId).toBe("a");
    expect(dup.bId).toBe("b");
    expect(dup.confidence).toBeGreaterThan(0.85);
    expect(dup.reasonCode).toBe("normalized_name_similarity");
    expect(dup.evidence).toEqual(["JOHN", "JOHN D."]);
  });

  it("summarizes source candidate totals", () => {
    const r = assembleStoryIntelligence(
      baseInput({
        sources: [{ id: "d1", title: "Novel", status: "ready" }],
        candidates: [
          { id: "x1", candidate_type: "character", normalized_key: "k", status: "pending", document_id: "d1", promoted_ref: null, proposed_payload: null },
          { id: "x2", candidate_type: "location", normalized_key: "k", status: "accepted", document_id: "d1", promoted_ref: null, proposed_payload: null },
          { id: "x3", candidate_type: "location", normalized_key: "k", status: "rejected", document_id: "d1", promoted_ref: null, proposed_payload: null },
        ],
      }),
    );
    expect(r.sources[0].candidateTotals).toEqual({
      pending: 1, accepted: 1, rejected: 1, merged: 0,
    });
    expect(r.candidates.unresolved).toBe(1);
    expect(r.candidates.byKind).toEqual({ character: 1 });
  });
});
