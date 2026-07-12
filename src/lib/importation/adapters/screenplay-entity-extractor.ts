// Phase 2 — heuristic entity extractor.
//
// Emits `character`, `location`, and `relationship` candidates from
// screenplay-shaped segments, each with ≥1 evidence link pointing back to
// the source segment. Deterministic; no LLM calls. Wraps segments produced
// by the screenplay heuristic segmenter but stays behind the
// `EntityExtractor` contract so later adapters can slot in.

import type {
  EntityExtractor,
  EvidenceLink,
  ImportCandidate,
  SourceSegment,
} from "../contracts";

const ADAPTER = "screenplay-heuristic-entity";
const VERSION = "1.0.0";

function normalizeName(input: string): string {
  return input
    .replace(/\([^)]*\)/g, "") // drop parentheticals like (V.O.)
    .replace(/\b(V\.O\.|O\.S\.|CONT'D|CONTD|CONT|MOS)\b/gi, "")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function parseSlugline(heading: string): {
  where?: string;
  int_ext?: "INT" | "EXT" | "INT/EXT";
} {
  const m = heading.match(/^\s*(INT\.?\/EXT\.?|INT\.?|EXT\.?)\s+(.+?)(?:\s+[-–—]\s+.+)?$/i);
  if (!m) return {};
  const raw = m[1].toUpperCase().replace(/\./g, "");
  const int_ext = raw === "INTEXT" || raw === "INT/EXT" ? "INT/EXT" : (raw as "INT" | "EXT");
  return { int_ext, where: m[2].trim() };
}

export const screenplayHeuristicEntityExtractor: EntityExtractor = {
  adapter: ADAPTER,
  version: VERSION,
  async extract({ segments }) {
    // Aggregators keyed by normalized name.
    const characters = new Map<
      string,
      { display: string; evidence: EvidenceLink[]; sceneIndexes: Set<number> }
    >();
    const locations = new Map<
      string,
      { display: string; int_ext?: string; evidence: EvidenceLink[] }
    >();
    // Co-occurrence pairs within the same scene.
    const relationships = new Map<
      string,
      { a: string; b: string; evidence: EvidenceLink[]; scenes: Set<number> }
    >();

    // Group segments by scene index so we can detect co-presence.
    const sceneOf = (s: SourceSegment): number =>
      (s.location?.scene as number | undefined) ?? -1;

    // Track speaking characters per scene for relationship inference.
    const sceneCharacters = new Map<number, Set<string>>();

    for (const seg of segments) {
      if (seg.segmentType === "screenplay_scene" && seg.heading) {
        const parsed = parseSlugline(seg.heading);
        if (parsed.where) {
          const key = normalizeName(parsed.where);
          if (key.length > 0) {
            const bucket = locations.get(key) ?? {
              display: parsed.where.trim(),
              int_ext: parsed.int_ext,
              evidence: [],
            };
            bucket.evidence.push({
              segmentId: seg.id,
              excerpt: seg.rawText.slice(0, 240),
              evidenceType: "objective_narration",
              confidence: 0.85,
              directOrInferred: "direct",
              locationHint: `scene ${sceneOf(seg) + 1}`,
            });
            locations.set(key, bucket);
          }
        }
      }

      // Speaker labels appear on character segments.
      const speaker = seg.speakers?.[0];
      if (speaker) {
        const key = normalizeName(speaker);
        if (key.length === 0) continue;
        const bucket = characters.get(key) ?? {
          display: speaker.trim(),
          evidence: [],
          sceneIndexes: new Set<number>(),
        };
        bucket.evidence.push({
          segmentId: seg.id,
          excerpt: seg.rawText.slice(0, 240),
          evidenceType: "character_dialogue",
          confidence: 0.9,
          directOrInferred: "direct",
          locationHint: `scene ${sceneOf(seg) + 1}`,
        });
        const s = sceneOf(seg);
        if (s >= 0) bucket.sceneIndexes.add(s);
        characters.set(key, bucket);

        if (s >= 0) {
          const inScene = sceneCharacters.get(s) ?? new Set<string>();
          inScene.add(key);
          sceneCharacters.set(s, inScene);
        }
      }
    }

    // Build relationship candidates from co-occurrence in the same scene.
    for (const [sceneIdx, keys] of sceneCharacters.entries()) {
      const list = Array.from(keys).sort();
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i]!;
          const b = list[j]!;
          const relKey = `${a}::${b}`;
          const bucket = relationships.get(relKey) ?? {
            a,
            b,
            evidence: [],
            scenes: new Set<number>(),
          };
          bucket.scenes.add(sceneIdx);
          // Cite one segment from that scene as evidence.
          const sceneSeg = segments.find(
            (s) => sceneOf(s) === sceneIdx && s.segmentType === "screenplay_scene",
          );
          if (sceneSeg) {
            bucket.evidence.push({
              segmentId: sceneSeg.id,
              excerpt: (sceneSeg.heading ?? sceneSeg.rawText).slice(0, 240),
              evidenceType: "objective_narration",
              confidence: 0.6,
              directOrInferred: "inferred",
              locationHint: `scene ${sceneIdx + 1}`,
            });
          }
          relationships.set(relKey, bucket);
        }
      }
    }

    const out: ImportCandidate[] = [];

    for (const [key, v] of characters.entries()) {
      const scenesCount = v.sceneIndexes.size;
      // Confidence scales with scene appearances (max 0.98).
      const confidence = Math.min(0.6 + scenesCount * 0.08, 0.98);
      out.push({
        id: `character:${key}`,
        candidateType: "character",
        normalizedKey: key,
        proposedPayload: {
          name: v.display,
          detected_name: v.display,
          scene_count: scenesCount,
          importance: scenesCount >= 5 ? "lead" : scenesCount >= 2 ? "supporting" : "minor",
        },
        confidence,
        evidence: v.evidence.slice(0, 12),
      });
    }

    for (const [key, v] of locations.entries()) {
      out.push({
        id: `location:${key}`,
        candidateType: "location",
        normalizedKey: key,
        proposedPayload: {
          name: v.display,
          int_ext: v.int_ext ?? null,
          appearance_count: v.evidence.length,
        },
        confidence: Math.min(0.5 + v.evidence.length * 0.05, 0.95),
        evidence: v.evidence.slice(0, 8),
      });
    }

    for (const [key, v] of relationships.entries()) {
      // Only propose relationships with ≥2 shared scenes.
      if (v.scenes.size < 2) continue;
      out.push({
        id: `relationship:${key}`,
        candidateType: "relationship",
        normalizedKey: key,
        proposedPayload: {
          a: v.a,
          b: v.b,
          shared_scenes: v.scenes.size,
          kind: "co_present",
        },
        confidence: Math.min(0.4 + v.scenes.size * 0.05, 0.9),
        evidence: v.evidence.slice(0, 6),
      });
    }

    return out;
  },
};
