import { describe, it, expect } from "vitest";
import {
  normalizeName,
  similarity,
  collapseCandidateVariants,
  proposeMerges,
} from "./identityEngine";

describe("normalizeName", () => {
  it("strips speaker labels", () => {
    expect(normalizeName("HANS (V.O.)").normalized).toBe("HANS");
    expect(normalizeName("HANS (CONT'D)").normalized).toBe("HANS");
    expect(normalizeName("HANS (O.S.)").normalized).toBe("HANS");
  });

  it("folds diacritics and casing", () => {
    expect(normalizeName("Zoë").normalized).toBe("ZOE");
    expect(normalizeName("François").normalized).toBe("FRANCOIS");
  });

  it("extracts rank without destroying source", () => {
    const n = normalizeName("LT. HANS");
    expect(n.rank).toBe("LT.");
    expect(n.normalized).toBe("HANS");
    expect(n.raw).toBe("LT. HANS");
  });

  it("extracts numbered roles", () => {
    expect(normalizeName("SOLDIER #1").numberedRole).toEqual({ base: "SOLDIER", number: 1 });
    expect(normalizeName("SOLDIER 2").numberedRole).toEqual({ base: "SOLDIER", number: 2 });
    expect(normalizeName("SOLDIER ONE").numberedRole).toEqual({ base: "SOLDIER", number: 1 });
  });
});

describe("collapseCandidateVariants (acceptance test 1)", () => {
  it("collapses HANS / Hans / HANS (V.O.) / HANS (CONT'D) into one group", () => {
    const rows = [
      { detected_name: "HANS" },
      { detected_name: "Hans" },
      { detected_name: "HANS (V.O.)" },
      { detected_name: "HANS (CONT'D)" },
    ];
    const groups = collapseCandidateVariants(rows);
    expect(groups.size).toBe(1);
    expect(groups.get("HANS")?.length).toBe(4);
  });
});

describe("similarity — acceptance tests 2, 3, 8, 9", () => {
  it("test 2: Hans vs Hanns — proposed ~0.85, never auto", () => {
    const s = similarity({ id: "a", name: "Hans" }, { id: "b", name: "Hanns" });
    expect(s.auto).toBe(false);
    expect(s.score).toBeGreaterThanOrEqual(0.85);
    expect(s.reasons).toContain("damerau_levenshtein_1");
  });

  it("test 3: OBERLEUTNANT HANS-DIETER VON ZWICK vs LT. HANS — proposed, rank captured", () => {
    const a = normalizeName("OBERLEUTNANT HANS-DIETER VON ZWICK");
    const b = normalizeName("LT. HANS");
    expect(a.rank).toBe("OBERLEUTNANT");
    expect(b.rank).toBe("LT.");
    const s = similarity(
      { id: "a", name: "OBERLEUTNANT HANS-DIETER VON ZWICK", sceneIds: ["s1", "s2"] },
      { id: "b", name: "LT. HANS", sceneIds: ["s3"] },
    );
    expect(s.auto).toBe(false);
    expect(s.reasons).toContain("token_subset");
    expect(s.score).toBeGreaterThanOrEqual(0.75);
    expect(s.score).toBeLessThanOrEqual(0.92);
  });

  it("test 8: SOLDIER #1 vs SOLDIER #2 — never proposed", () => {
    const s = similarity(
      { id: "a", name: "SOLDIER #1" },
      { id: "b", name: "SOLDIER #2" },
    );
    expect(s.score).toBe(0);
    expect(s.reasons).toContain("numbered_role_distinct");
  });

  it("test 9: SOLDIER #1, SOLDIER #2, PRIVATE KRUEGER — three distinct", () => {
    const cast = [
      { id: "1", name: "SOLDIER #1" },
      { id: "2", name: "SOLDIER #2" },
      { id: "3", name: "PRIVATE KRUEGER" },
    ];
    const props = proposeMerges(cast);
    expect(props.length).toBe(0);
  });

  it("co-occurrence in same scene reduces confidence and warns", () => {
    const s = similarity(
      { id: "a", name: "HANS", sceneIds: ["s1"] },
      { id: "b", name: "HANS", sceneIds: ["s1"] },
    );
    expect(s.reasons.some((r) => r.startsWith("co_occurrence_warning"))).toBe(true);
    expect(s.score).toBeLessThan(0.98);
  });

  it("keepSeparate memory suppresses re-proposal (acceptance test 7)", () => {
    const cast = [
      { id: "a", name: "HANS" },
      { id: "b", name: "HANS" },
    ];
    const withoutMemory = proposeMerges(cast);
    expect(withoutMemory.length).toBe(1);
    const key = ["a", "b"].sort().join("|");
    const withMemory = proposeMerges(cast, new Set([key]));
    expect(withMemory.length).toBe(0);
  });

  it("never auto-merges established records", () => {
    const cast = [
      { id: "a", name: "HANS" },
      { id: "b", name: "Hans" },
    ];
    const props = proposeMerges(cast);
    expect(props.length).toBe(1);
    // proposeMerges yields proposals only; the caller never auto-applies.
    // Sanity: similarity itself never returns auto=true.
    expect(similarity(cast[0], cast[1]).auto).toBe(false);
  });
});
