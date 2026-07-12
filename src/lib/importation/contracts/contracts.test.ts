// Phase 0 contract test: two mock adapters must satisfy the same interface
// and be interchangeable through the AdapterRegistry.

import { describe, it, expect } from "vitest";
import {
  pickParser,
  type AdapterRegistry,
  type DocumentParser,
  type SourceMediaType,
  type SourceType,
} from "./index";
import {
  screenplayHeuristicParser,
  screenplayHeuristicSegmenter,
} from "../adapters/screenplay-heuristic";

const mockPlainParser: DocumentParser & {
  supports: (m: SourceMediaType, s: SourceType) => boolean;
} = {
  adapter: "mock-plain",
  version: "0.0.1",
  supports: (m) => m === "text/plain",
  async parse({ bytes }) {
    return { normalizedText: new TextDecoder().decode(bytes) };
  },
};

describe("importation contracts", () => {
  it("two adapters implement the same DocumentParser shape", async () => {
    const a = await screenplayHeuristicParser.parse({
      bytes: new TextEncoder().encode("INT. ROOM - DAY\nHans stands.\n"),
      mediaType: "text/plain",
      sourceType: "screenplay",
    });
    const b = await mockPlainParser.parse({
      bytes: new TextEncoder().encode("hello"),
      mediaType: "text/plain",
      sourceType: "unknown",
    });
    expect(typeof a.normalizedText).toBe("string");
    expect(typeof b.normalizedText).toBe("string");
    expect(screenplayHeuristicParser.adapter).toBe("screenplay-heuristic");
    expect(mockPlainParser.adapter).toBe("mock-plain");
  });

  it("registry picks a screenplay-capable parser for screenplay input", () => {
    const registry: AdapterRegistry = {
      documentParsers: [mockPlainParser, screenplayHeuristicParser],
      transcribers: [],
      segmenters: [screenplayHeuristicSegmenter],
      entityExtractors: [],
      identityResolvers: [],
      embeddingProviders: [],
      continuityAnalyzers: [],
    };
    const parser = pickParser(registry, "text/plain", "screenplay");
    // mockPlainParser also supports text/plain but for `sourceType: unknown`;
    // for screenplay both match — either is acceptable, but at least one
    // adapter must be chosen and it must implement the contract.
    expect(parser).toBeTruthy();
    expect(typeof parser!.parse).toBe("function");
    expect(typeof parser!.version).toBe("string");
  });

  it("screenplay segmenter produces typed segments with stable ids", async () => {
    const parsed = await screenplayHeuristicParser.parse({
      bytes: new TextEncoder().encode(
        "INT. DESERT - DAY\nThe sun burns.\n\nHANS\nJust a few more clicks.\n",
      ),
      mediaType: "text/plain",
      sourceType: "screenplay",
    });
    const segments = await screenplayHeuristicSegmenter.segment({
      documentId: "doc-1",
      sourceType: "screenplay",
      parsed,
    });
    expect(segments.length).toBeGreaterThan(0);
    expect(segments[0]?.segmentType).toMatch(/^screenplay_/);
    expect(segments.every((s) => s.id.startsWith("doc-1:"))).toBe(true);
    // Re-run: identical output (deterministic segmentation).
    const again = await screenplayHeuristicSegmenter.segment({
      documentId: "doc-1",
      sourceType: "screenplay",
      parsed,
    });
    expect(again.map((s) => s.id)).toEqual(segments.map((s) => s.id));
  });
});
