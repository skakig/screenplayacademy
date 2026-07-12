// Phase 1 — Source-preservation spine server functions.
//
// Preserves the original uploaded text as bytes in the `source-documents`
// storage bucket, records a durable `source_documents` row (checksum-keyed
// per universe for dedupe), and materializes deterministic `source_segments`
// via the provider-neutral screenplay heuristic adapter. Extraction runs are
// cached so re-parsing the same document is idempotent.
//
// Doctrine: docs/ITS_PfHU_Importation.md §4.2 (source preservation),
// §4.7 (provider neutrality), §6.2–6.4 (spine tables).

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  screenplayHeuristicParser,
  screenplayHeuristicSegmenter,
} from "./adapters/screenplay-heuristic";
import type { SourceMediaType, SourceType } from "./contracts";

// --- helpers ---

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const buf = await crypto.subtle.digest("SHA-256", copy.buffer);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bytesFromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// --- create/list universes ---

export const createStoryUniverse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        name: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        primary_language: z.string().min(2).max(10).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("story_universes")
      .insert({
        owner_id: userId,
        name: data.name.trim(),
        description: data.description ?? null,
        primary_language: data.primary_language ?? "en",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listStoryUniverses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("story_universes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// --- ingest a document (preserve original + parse + segment) ---

const SOURCE_TYPES: SourceType[] = [
  "screenplay",
  "teleplay",
  "shooting_script",
  "novel",
  "novella",
  "short_story",
  "manuscript",
  "series_bible",
  "character_bible",
  "lore_document",
  "production_note",
  "transcript",
  "audiobook",
  "audio_drama",
  "stage_play",
  "skit",
  "creator_script",
  "podcast_script",
  "interactive_export",
  "revision_note",
  "editorial_decision",
  "unknown",
];

const MEDIA_TYPES: SourceMediaType[] = [
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/x-fountain",
  "application/x-fdx",
  "application/x-final-draft",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "audio/mpeg",
  "audio/wav",
  "audio/mp4",
  "video/mp4",
  "image/png",
  "image/jpeg",
  "application/octet-stream",
];

export const ingestSourceDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        universe_id: z.string().uuid(),
        project_id: z.string().uuid().nullable().optional(),
        title: z.string().min(1).max(300),
        filename: z.string().max(300).optional(),
        // Either raw text or base64-encoded bytes. Text path is used by the
        // paste-in flow; bytes path supports future uploads (PDF/DOCX/audio)
        // parsed by adapters keyed on media_type.
        text: z.string().optional(),
        bytes_base64: z.string().optional(),
        source_type: z.enum(SOURCE_TYPES as [SourceType, ...SourceType[]]).default("screenplay"),
        media_type: z
          .enum(MEDIA_TYPES as [SourceMediaType, ...SourceMediaType[]])
          .default("text/plain"),
        language: z.string().max(10).optional(),
        authority: z
          .enum(["reference", "canon", "draft", "external"])
          .default("reference"),
        rights_note: z.string().max(2000).optional(),
      })
      .refine((v) => Boolean(v.text) || Boolean(v.bytes_base64), {
        message: "Provide either `text` or `bytes_base64`.",
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Owner check (RLS also enforces).
    const { data: universe, error: uErr } = await supabase
      .from("story_universes")
      .select("id, owner_id")
      .eq("id", data.universe_id)
      .single();
    if (uErr || !universe) throw new Error("Universe not found");

    // Materialize bytes; text becomes UTF-8 bytes so the storage copy is
    // always an exact byte-for-byte record of what was imported.
    const bytes: Uint8Array = data.bytes_base64
      ? bytesFromBase64(data.bytes_base64)
      : new TextEncoder().encode(data.text ?? "");
    const checksum = await sha256Hex(bytes);

    // Dedupe: if this exact document already exists in the universe, return
    // it (idempotent re-ingest).
    const { data: existing } = await supabase
      .from("source_documents")
      .select("*")
      .eq("universe_id", data.universe_id)
      .eq("checksum", checksum)
      .maybeSingle();

    let documentId: string;
    let alreadyExisted = false;
    if (existing) {
      documentId = existing.id;
      alreadyExisted = true;
    } else {
      const safeName = (data.filename ?? "source.txt").replace(/[^\w.\-]+/g, "_");
      const storagePath = `${userId}/${data.universe_id}/${checksum}/${safeName}`;

      // Store original bytes. Bucket policies scope by first path segment
      // (auth.uid()); we use the authenticated user's Supabase client so RLS
      // on `storage.objects` is honoured.
      const { error: upErr } = await supabase.storage
        .from("source-documents")
        .upload(storagePath, bytes, {
          contentType: data.media_type,
          upsert: true,
        });
      if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

      const { data: inserted, error: insErr } = await supabase
        .from("source_documents")
        .insert({
          universe_id: data.universe_id,
          project_id: data.project_id ?? null,
          uploaded_by: userId,
          title: data.title,
          source_type: data.source_type,
          media_type: data.media_type,
          language: data.language ?? null,
          filename: data.filename ?? null,
          byte_size: bytes.byteLength,
          checksum,
          storage_path: storagePath,
          authority: data.authority,
          rights_note: data.rights_note ?? null,
          status: "ingested",
        })
        .select("*")
        .single();
      if (insErr || !inserted) throw new Error(insErr?.message ?? "Insert failed");
      documentId = inserted.id;
    }

    // Parse + segment via the screenplay heuristic adapter. Later phases
    // will route to other adapters based on media_type/source_type.
    const parsed = await screenplayHeuristicParser.parse({
      bytes,
      mediaType: data.media_type,
      sourceType: data.source_type,
      filename: data.filename,
    });

    const segments = await screenplayHeuristicSegmenter.segment({
      documentId,
      sourceType: data.source_type,
      parsed,
    });

    // Persist parser output on the document row.
    const { error: patchErr } = await supabase
      .from("source_documents")
      .update({
        normalized_text: parsed.normalizedText,
        parser_adapter: screenplayHeuristicParser.adapter,
        parser_version: screenplayHeuristicParser.version,
        structural_hints: (parsed.structuralHints ?? {}) as never,
        diagnostics: (parsed.diagnostics ?? {}) as never,
        status: "segmented",
      })
      .eq("id", documentId);
    if (patchErr) throw new Error(patchErr.message);

    // Idempotent segment write: unique (document_id, segmenter_adapter,
    // segmenter_version, sequence) means re-runs upsert cleanly.
    const rows = segments.map((s) => ({
      document_id: documentId,
      universe_id: data.universe_id,
      segment_type: s.segmentType,
      sequence: s.sequence,
      heading: s.heading ?? null,
      raw_text: s.rawText,
      normalized_text: s.normalizedText,
      location: s.location ?? {},
      speakers: s.speakers ?? [],
      language: s.language ?? data.language ?? null,
      checksum: s.checksum,
      segmenter_adapter: screenplayHeuristicSegmenter.adapter,
      segmenter_version: screenplayHeuristicSegmenter.version,
      stable_key: s.id,
    }));

    if (rows.length > 0) {
      const { error: segErr } = await supabase
        .from("source_segments")
        .upsert(rows, {
          onConflict: "document_id,segmenter_adapter,segmenter_version,sequence",
        });
      if (segErr) throw new Error(`Segment write failed: ${segErr.message}`);
    }

    // Record the extraction runs so re-runs are traceable + cached.
    await supabase.from("import_extraction_runs").upsert(
      [
        {
          document_id: documentId,
          universe_id: data.universe_id,
          stage: "parse",
          adapter: screenplayHeuristicParser.adapter,
          adapter_version: screenplayHeuristicParser.version,
          input_checksum: checksum,
          status: "succeeded",
          output_summary: {
            normalized_length: parsed.normalizedText.length,
            language: parsed.language ?? null,
          },
        },
        {
          document_id: documentId,
          universe_id: data.universe_id,
          stage: "segment",
          adapter: screenplayHeuristicSegmenter.adapter,
          adapter_version: screenplayHeuristicSegmenter.version,
          input_checksum: checksum,
          status: "succeeded",
          output_summary: { segments: rows.length },
        },
      ],
      { onConflict: "document_id,stage,adapter,adapter_version,input_checksum" },
    );

    return {
      document_id: documentId,
      universe_id: data.universe_id,
      checksum,
      byte_size: bytes.byteLength,
      segments_written: rows.length,
      already_existed: alreadyExisted,
    };
  });

// --- read helpers ---

export const listSourceDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ universe_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("source_documents")
      .select("*")
      .eq("universe_id", data.universe_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getSourceDocumentWithSegments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ document_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: doc, error: dErr } = await supabase
      .from("source_documents")
      .select("*")
      .eq("id", data.document_id)
      .single();
    if (dErr || !doc) throw new Error(dErr?.message ?? "Document not found");
    const { data: segments, error: sErr } = await supabase
      .from("source_segments")
      .select("*")
      .eq("document_id", data.document_id)
      .order("sequence", { ascending: true });
    if (sErr) throw new Error(sErr.message);
    return { document: doc, segments: segments ?? [] };
  });

export const getSourceDocumentDownloadUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ document_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: doc, error } = await supabase
      .from("source_documents")
      .select("storage_path, filename")
      .eq("id", data.document_id)
      .single();
    if (error || !doc?.storage_path) {
      throw new Error("Original file not available");
    }
    const { data: signed, error: sErr } = await supabase.storage
      .from("source-documents")
      .createSignedUrl(doc.storage_path, 60 * 10);
    if (sErr || !signed) throw new Error(sErr?.message ?? "Signed URL failed");
    return { url: signed.signedUrl, filename: doc.filename };
  });
