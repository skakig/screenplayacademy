// Screenplay heuristic adapter — wraps the existing pure-TS screenplay
// parser (`src/lib/import/parser.ts`) behind the provider-neutral
// DocumentParser + Segmenter contracts. Behavior is unchanged; this only
// gives Phase 1+ code a stable interface to call.

import { parseScreenplayText, type Candidate } from "@/lib/import/parser";
import type {
  DocumentParser,
  ParsedDocument,
  Segmenter,
  SourceMediaType,
  SourceSegment,
  SourceType,
} from "../contracts";

const ADAPTER = "screenplay-heuristic";
const VERSION = "1.0.0";

function decodeBytes(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

// Small non-crypto hash so we do not pull node:crypto into the client bundle.
function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export const screenplayHeuristicParser: DocumentParser & {
  supports: (mediaType: SourceMediaType, sourceType: SourceType) => boolean;
} = {
  adapter: ADAPTER,
  version: VERSION,
  supports(mediaType, sourceType) {
    const textLike =
      mediaType === "text/plain" ||
      mediaType === "text/markdown" ||
      mediaType === "application/x-fountain";
    const scriptLike =
      sourceType === "screenplay" ||
      sourceType === "teleplay" ||
      sourceType === "shooting_script" ||
      sourceType === "stage_play" ||
      sourceType === "skit" ||
      sourceType === "creator_script" ||
      sourceType === "podcast_script";
    return textLike && scriptLike;
  },
  async parse({ bytes }): Promise<ParsedDocument> {
    const text = decodeBytes(bytes);
    // Normalize line endings + trim trailing whitespace per line; the
    // downstream parser expects plain \n text.
    const normalizedText = text
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((l) => l.replace(/\s+$/, ""))
      .join("\n");
    return {
      normalizedText,
      diagnostics: { adapter: ADAPTER, byteLength: bytes.byteLength },
    };
  },
};

function candidateToSegment(
  documentId: string | null,
  c: Candidate,
): SourceSegment {
  const isScene = c.proposed_block_type === "scene_heading";
  return {
    id: `${documentId ?? "doc"}:${c.order_index}:${fnv1a(c.raw_text)}`,
    documentId,
    segmentType: isScene ? "screenplay_scene" : "screenplay_block",
    sequence: c.order_index,
    heading: isScene ? c.raw_text : undefined,
    rawText: c.raw_text,
    normalizedText: c.raw_text.trim(),
    location: {
      scene: c.proposed_scene_index,
    },
    speakers:
      c.proposed_block_type === "character" && c.proposed_character_name
        ? [c.proposed_character_name]
        : undefined,
    checksum: fnv1a(c.raw_text),
  };
}

export const screenplayHeuristicSegmenter: Segmenter = {
  adapter: ADAPTER,
  version: VERSION,
  async segment({ documentId, parsed }): Promise<SourceSegment[]> {
    const candidates = parseScreenplayText(parsed.normalizedText);
    return candidates.map((c: Candidate) => candidateToSegment(documentId, c));
  },
};
