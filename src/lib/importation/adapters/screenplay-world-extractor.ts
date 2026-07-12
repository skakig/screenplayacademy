// Phase 3 — heuristic world & story entity extractor.
//
// Emits `event`, `artifact`, and `thread` candidates from screenplay-shaped
// segments with ≥1 evidence link each. Deterministic; no LLM calls. Sits
// alongside `screenplayHeuristicEntityExtractor` (Phase 2) so runs remain
// cache-keyable by adapter+version. Locations are already emitted by Phase 2
// and re-used here to link events to a `normalizedKey`.
//
// Doctrine: docs/ITS_PfHU_Importation.md §4.5 (canon vs belief vs inference),
// §5.3 (world/story candidates), §6.5 (evidence citation).

import type {
  EntityExtractor,
  EvidenceLink,
  ImportCandidate,
  SourceSegment,
} from "../contracts";

const ADAPTER = "screenplay-heuristic-world";
const VERSION = "1.0.0";

const STOP_TOKENS = new Set([
  "INT", "EXT", "DAY", "NIGHT", "MORNING", "EVENING", "AFTERNOON", "DAWN",
  "DUSK", "CONTINUOUS", "LATER", "CUT", "TO", "FADE", "IN", "OUT", "ON",
  "THE", "AND", "OF", "A", "AN", "TO", "FROM", "AT", "IN", "OUT", "OVER",
  "UP", "DOWN", "WITH", "INTO", "ONTO", "IS", "ARE", "WAS", "WERE",
  "MOS", "VO", "OS", "CONTD",
]);

function normalizeName(input: string): string {
  return input
    .replace(/\([^)]*\)/g, "")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function parseSlugline(heading: string): {
  where?: string;
  int_ext?: string;
  time?: string;
} {
  const m = heading.match(
    /^\s*(INT\.?\/EXT\.?|INT\.?|EXT\.?)\s+(.+?)(?:\s+[-–—]\s+(.+))?$/i,
  );
  if (!m) return {};
  const raw = m[1].toUpperCase().replace(/\./g, "");
  return {
    int_ext: raw === "INTEXT" || raw === "INT/EXT" ? "INT/EXT" : raw,
    where: m[2].trim(),
    time: m[3]?.trim(),
  };
}

export const screenplayHeuristicWorldExtractor: EntityExtractor = {
  adapter: ADAPTER,
  version: VERSION,
  async extract({ segments }) {
    const sceneOf = (s: SourceSegment): number =>
      (s.location?.scene as number | undefined) ?? -1;

    // Character-name blocklist so ALL-CAPS speaker labels don't become
    // artifact candidates.
    const speakerKeys = new Set<string>();
    for (const seg of segments) {
      const sp = seg.speakers?.[0];
      if (sp) speakerKeys.add(normalizeName(sp));
    }

    const events = new Map<
      string,
      {
        display: string;
        sequence: number;
        int_ext?: string;
        time?: string;
        locationKey?: string;
        evidence: EvidenceLink[];
      }
    >();
    const artifacts = new Map<
      string,
      { display: string; scenes: Set<number>; evidence: EvidenceLink[] }
    >();
    const threads = new Map<
      string,
      { display: string; evidence: EvidenceLink[] }
    >();

    for (const seg of segments) {
      // --- events: one per scene heading ---
      if (seg.segmentType === "screenplay_scene" && seg.heading) {
        const idx = sceneOf(seg);
        const slug = parseSlugline(seg.heading);
        const key = normalizeName(seg.heading);
        if (key.length > 0 && !events.has(key)) {
          events.set(key, {
            display: seg.heading.trim(),
            sequence: idx >= 0 ? idx : events.size,
            int_ext: slug.int_ext,
            time: slug.time,
            locationKey: slug.where ? normalizeName(slug.where) : undefined,
            evidence: [
              {
                segmentId: seg.id,
                excerpt: seg.heading.slice(0, 240),
                evidenceType: "objective_narration",
                confidence: 0.85,
                directOrInferred: "direct",
                locationHint: `scene ${(idx >= 0 ? idx : 0) + 1}`,
              },
            ],
          });
        }
      }

      // --- artifacts: recurring ALL-CAPS proper nouns in action blocks ---
      if (
        seg.segmentType === "screenplay_block" &&
        seg.rawText &&
        !seg.speakers?.length
      ) {
        // ALL-CAPS phrases of 1–4 words, e.g. "THE ORB", "BLACK LOTUS RING".
        const matches = seg.rawText.match(
          /\b([A-Z][A-Z0-9'’-]{2,}(?:\s+[A-Z][A-Z0-9'’-]{2,}){0,3})\b/g,
        );
        if (matches) {
          const scene = sceneOf(seg);
          for (const raw of matches) {
            const key = normalizeName(raw);
            if (key.length < 3) continue;
            // reject if it's a stopword-only phrase, a speaker, or looks
            // like a slugline fragment.
            const tokens = key.split(" ");
            if (tokens.every((t) => STOP_TOKENS.has(t))) continue;
            if (speakerKeys.has(key)) continue;
            const bucket = artifacts.get(key) ?? {
              display: raw.trim(),
              scenes: new Set<number>(),
              evidence: [],
            };
            if (scene >= 0) bucket.scenes.add(scene);
            if (bucket.evidence.length < 6) {
              bucket.evidence.push({
                segmentId: seg.id,
                excerpt: seg.rawText.slice(0, 240),
                evidenceType: "objective_narration",
                confidence: 0.55,
                directOrInferred: "inferred",
                locationHint: scene >= 0 ? `scene ${scene + 1}` : undefined,
              });
            }
            artifacts.set(key, bucket);
          }
        }
      }

      // --- threads: unresolved questions raised in dialogue ---
      if (seg.speakers?.length && seg.rawText) {
        const scene = sceneOf(seg);
        const lines = seg.rawText.split(/(?<=[?])\s+/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.endsWith("?")) continue;
          if (trimmed.length < 8 || trimmed.length > 200) continue;
          const key = trimmed.toLowerCase().replace(/\s+/g, " ");
          const bucket = threads.get(key) ?? {
            display: trimmed,
            evidence: [],
          };
          if (bucket.evidence.length < 3) {
            bucket.evidence.push({
              segmentId: seg.id,
              excerpt: trimmed.slice(0, 240),
              evidenceType: "character_dialogue",
              confidence: 0.5,
              directOrInferred: "inferred",
              locationHint: scene >= 0 ? `scene ${scene + 1}` : undefined,
            });
          }
          threads.set(key, bucket);
        }
      }
    }

    const out: ImportCandidate[] = [];

    for (const [key, v] of events.entries()) {
      out.push({
        id: `event:${key}`,
        candidateType: "event",
        normalizedKey: key,
        proposedPayload: {
          name: v.display,
          sequence: v.sequence,
          int_ext: v.int_ext ?? null,
          time: v.time ?? null,
          location_key: v.locationKey ?? null,
        },
        confidence: 0.75,
        evidence: v.evidence,
      });
    }

    for (const [key, v] of artifacts.entries()) {
      if (v.scenes.size < 2) continue; // recurrence gate
      out.push({
        id: `artifact:${key}`,
        candidateType: "artifact",
        normalizedKey: key,
        proposedPayload: {
          name: v.display,
          mention_scenes: v.scenes.size,
        },
        confidence: Math.min(0.45 + v.scenes.size * 0.07, 0.92),
        evidence: v.evidence,
      });
    }

    for (const [key, v] of threads.entries()) {
      out.push({
        id: `thread:${key}`,
        candidateType: "thread",
        normalizedKey: key.slice(0, 200),
        proposedPayload: {
          name: v.display.slice(0, 200),
          question: v.display,
          status: "open",
        },
        confidence: 0.5,
        evidence: v.evidence,
      });
    }

    return out;
  },
};
