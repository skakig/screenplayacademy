// Provider-neutral contracts for ITS/PfHU Importation.
//
// Every stage of the import pipeline (parse, transcribe, segment, extract
// entities, resolve identities, embed, analyze continuity) is expressed as a
// typed interface here. Concrete providers live in `../adapters/` and are
// instantiated inside `createServerFn` handlers — never at module scope.
//
// Doctrine: docs/ITS_PfHU_Importation.md §4.7 (provider neutrality) and §7
// (staged, restartable pipeline). Cost idempotency requires every adapter to
// return its own `version` so `import_extraction_runs` can cache by
// `(document_checksum, stage, version)`.
//
// Phase 0 ships the shapes only. Later phases add tables, storage, and UI.

// ---------- Shared types ----------

export type SourceMediaType =
  | "text/plain"
  | "text/markdown"
  | "application/pdf"
  | "application/x-fountain"
  | "application/x-fdx"
  | "application/x-final-draft"
  | "application/msword"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "audio/mpeg"
  | "audio/wav"
  | "audio/mp4"
  | "video/mp4"
  | "image/png"
  | "image/jpeg"
  | "application/octet-stream";

export type SourceType =
  | "screenplay"
  | "teleplay"
  | "shooting_script"
  | "novel"
  | "novella"
  | "short_story"
  | "manuscript"
  | "series_bible"
  | "character_bible"
  | "lore_document"
  | "production_note"
  | "transcript"
  | "audiobook"
  | "audio_drama"
  | "stage_play"
  | "skit"
  | "creator_script"
  | "podcast_script"
  | "interactive_export"
  | "revision_note"
  | "editorial_decision"
  | "unknown";

export type SegmentType =
  | "screenplay_scene"
  | "screenplay_block"
  | "chapter"
  | "paragraph"
  | "page"
  | "dialogue_turn"
  | "transcript_span"
  | "episode_segment"
  | "editorial_decision";

export type EvidenceType =
  | "source_quotation"
  | "objective_narration"
  | "character_dialogue"
  | "character_belief"
  | "rumor"
  | "lie"
  | "memory"
  | "prophecy"
  | "inference"
  | "production_note";

export type CandidateType =
  | "character"
  | "alias"
  | "relationship"
  | "location"
  | "faction"
  | "rule"
  | "event"
  | "artifact"
  | "belief"
  | "thread"
  | "theme"
  | "style_observation";

/** Every adapter reports its own version so runs are cache-keyable. */
export type AdapterVersion = {
  /** Stable adapter identifier, e.g. `screenplay-heuristic`. */
  readonly adapter: string;
  /** Semver-ish string. Bump when output shape or heuristics change. */
  readonly version: string;
};

/** Portable, provider-neutral segment shape. Persisted by Phase 1. */
export interface SourceSegment {
  /** Client-assigned stable id (uuid or content hash). */
  id: string;
  /** Owning `source_documents.id` once persisted; may be null pre-persist. */
  documentId: string | null;
  segmentType: SegmentType;
  /** 0-based ordinal within the document. */
  sequence: number;
  /** Optional human-readable heading (scene heading, chapter title, etc). */
  heading?: string;
  /** Original text as it appeared in the source. */
  rawText: string;
  /** Whitespace-normalized text used for extraction and search. */
  normalizedText: string;
  /** Optional page / chapter / timestamp metadata. */
  location?: {
    page?: number;
    scene?: number;
    chapter?: number;
    startMs?: number;
    endMs?: number;
  };
  /** Speaker labels detected in this segment (character candidates). */
  speakers?: string[];
  language?: string;
  /** Cheap deterministic hash of `rawText` for dedupe. */
  checksum: string;
}

/** Evidence link produced by an extractor. Persisted by Phase 2. */
export interface EvidenceLink {
  segmentId: string;
  excerpt: string;
  evidenceType: EvidenceType;
  confidence: number; // 0..1
  directOrInferred: "direct" | "inferred";
  locationHint?: string; // "p.42" or "00:12:03"
}

/** Extracted candidate awaiting human review. Persisted by Phase 2. */
export interface ImportCandidate {
  /** Client-side id; final row id assigned on persist. */
  id: string;
  candidateType: CandidateType;
  /** Normalized string used to group likely-same candidates before review. */
  normalizedKey: string;
  /** Typed payload; shape varies by candidateType. */
  proposedPayload: Record<string, unknown>;
  confidence: number; // 0..1
  evidence: EvidenceLink[];
}

/** Non-destructive identity proposal. Persisted by Phase 2. */
export interface IdentityProposal {
  candidateIds: string[];
  proposedCanonicalName: string;
  reason: string;
  confidence: number;
  conflictingFacts?: string[];
}

// ---------- Stage contracts ----------

export interface ParsedDocument {
  /** Normalized full-text output. Adapters should strip page breaks etc. */
  normalizedText: string;
  /** Detected primary language, ISO 639-1 when known. */
  language?: string;
  /** Optional structural hints for the Segmenter (page breaks, headings). */
  structuralHints?: {
    pageBreakOffsets?: number[];
    headingOffsets?: { offset: number; text: string; level?: number }[];
  };
  /** Adapter-specific diagnostics (never provider secrets). */
  diagnostics?: Record<string, unknown>;
}

export interface DocumentParser extends AdapterVersion {
  /**
   * Read bytes and return normalized text + structural hints.
   * MUST be deterministic given the same input and version — the caller keys
   * cache on `(checksum, adapter, version)`.
   */
  parse(input: {
    bytes: Uint8Array;
    mediaType: SourceMediaType;
    sourceType: SourceType;
    filename?: string;
  }): Promise<ParsedDocument>;
}

export interface TranscribedSpan {
  startMs: number;
  endMs: number;
  text: string;
  speakerLabel?: string;
  confidence?: number;
}

export interface Transcriber extends AdapterVersion {
  /** Audio bytes → timestamped text spans. Used from Phase 8. */
  transcribe(input: {
    bytes: Uint8Array;
    mediaType: SourceMediaType;
    language?: string;
  }): Promise<{ language?: string; spans: TranscribedSpan[] }>;
}

export interface Segmenter extends AdapterVersion {
  /**
   * Normalized text (or transcript spans) → typed segments. Must be
   * deterministic; segment ids are content-hash-derived so re-segmentation
   * with the same adapter version is stable.
   */
  segment(input: {
    documentId: string | null;
    sourceType: SourceType;
    parsed: ParsedDocument;
    transcript?: TranscribedSpan[];
  }): Promise<SourceSegment[]>;
}

export interface EntityExtractor extends AdapterVersion {
  /**
   * Segments → typed candidates with evidence.
   * MUST NOT mutate canon. MUST attach ≥1 EvidenceLink per candidate.
   */
  extract(input: {
    segments: SourceSegment[];
    sourceType: SourceType;
    types: CandidateType[];
  }): Promise<ImportCandidate[]>;
}

export interface IdentityResolver extends AdapterVersion {
  /**
   * Candidates → identity proposals. Only proposes; never merges.
   * Callers persist decisions in `import_identity_decisions` (Phase 2).
   */
  propose(input: {
    candidates: ImportCandidate[];
    previouslyKeptSeparate?: { candidateIds: string[] }[];
  }): Promise<IdentityProposal[]>;
}

export interface EmbeddingRow {
  segmentId: string;
  vector: number[];
  dim: number;
}

export interface EmbeddingProvider extends AdapterVersion {
  embed(input: { segments: SourceSegment[] }): Promise<EmbeddingRow[]>;
}

export interface ContinuityFinding {
  affectedSegmentIds: string[];
  category:
    | "character_behavior"
    | "voice_drift"
    | "knowledge_state"
    | "location_state"
    | "object_state"
    | "relationship_state"
    | "timeline"
    | "world_rule"
    | "repeated_arc"
    | "retcon_conflict";
  severity: "info" | "warning" | "critical";
  confidence: number;
  explanation: string;
  evidence: EvidenceLink[];
  suggestedResolutions: string[];
}

export interface ContinuityAnalyzer extends AdapterVersion {
  /** Compare a draft against a knowledge map; returns findings only. */
  analyze(input: {
    draftSegments: SourceSegment[];
    knowledgeSnapshot: unknown; // typed in Phase 5
  }): Promise<ContinuityFinding[]>;
}

// ---------- Registry helper ----------

/**
 * Simple typed registry so handlers can look up the active adapter by
 * capability without importing every adapter module at the call site.
 * Adapters register themselves inside handlers, never at module scope, to
 * keep provider secrets out of the client bundle.
 */
export type AdapterRegistry = {
  documentParsers: DocumentParser[];
  transcribers: Transcriber[];
  segmenters: Segmenter[];
  entityExtractors: EntityExtractor[];
  identityResolvers: IdentityResolver[];
  embeddingProviders: EmbeddingProvider[];
  continuityAnalyzers: ContinuityAnalyzer[];
};

export function pickParser(
  registry: AdapterRegistry,
  mediaType: SourceMediaType,
  sourceType: SourceType,
): DocumentParser | undefined {
  // Later phases can add MIME/source-type routing metadata to each adapter;
  // Phase 0 keeps this as a linear scan so callers stay decoupled.
  for (const p of registry.documentParsers) {
    if (typeof (p as unknown as { supports?: (m: SourceMediaType, s: SourceType) => boolean }).supports === "function") {
      const supports = (p as unknown as { supports: (m: SourceMediaType, s: SourceType) => boolean }).supports;
      if (supports(mediaType, sourceType)) return p;
    }
  }
  return registry.documentParsers[0];
}
