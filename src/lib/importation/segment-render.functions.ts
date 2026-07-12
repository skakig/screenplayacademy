// Phase 4b — screenplay rendering / export that uses resolved character
// identities.
//
// Reads persisted `source_segments` for a document and joins them with the
// promoted `characters` rows behind each accepted `import_candidate`. Segment
// speakers and in-line entity mentions are rewritten to the canonical
// character name instead of the raw candidate text, so both the on-screen
// preview and the plaintext export stay consistent with the reviewer's
// identity decisions and survive re-imports.
//
// Doctrine: docs/ITS_PfHU_Importation.md §4.4 (non-destructive identity),
// §5.4 (resolved entity map), §6.7 (canon-consistent presentation).

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { promoteApprovedCharactersForDocument } from "./candidates.functions";

type ResolvedEntity = {
  character_id: string;
  name: string;
  raw_names: string[];
};

type RenderedLine = {
  segment_id: string;
  sequence: number;
  segment_type: string;
  block_type: "scene_heading" | "character" | "dialogue" | "action";
  text: string;
  resolved_character_id: string | null;
  resolved_from_raw: string | null;
};

function upper(s: string): string {
  return s.trim().toUpperCase();
}

// Escape a string for use in a RegExp literal.
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole-word, case-insensitive replacement of every alias with the canonical
// name. Longest alias first so "MARY JANE" is replaced before "MARY".
function rewriteMentions(text: string, entities: ResolvedEntity[]): string {
  if (!text) return text;
  const pairs: { pattern: RegExp; name: string }[] = [];
  const seen = new Set<string>();
  const aliases: { alias: string; name: string }[] = [];
  for (const e of entities) {
    for (const raw of e.raw_names) {
      const a = raw.trim();
      if (!a) continue;
      const key = `${a.toUpperCase()}→${e.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      aliases.push({ alias: a, name: e.name });
    }
  }
  aliases.sort((a, b) => b.alias.length - a.alias.length);
  for (const { alias, name } of aliases) {
    // \b works for ASCII names; for names starting/ending with punctuation
    // (e.g. "J.T.") fall back to a lookaround on non-letters.
    pairs.push({
      pattern: new RegExp(
        `(^|[^\\p{L}\\p{N}_])(${escapeRegExp(alias)})(?=$|[^\\p{L}\\p{N}_])`,
        "giu",
      ),
      name,
    });
  }
  let out = text;
  for (const { pattern, name } of pairs) {
    out = out.replace(pattern, (_m, pre) => `${pre}${name}`);
  }
  return out;
}

function formatFountain(line: RenderedLine): string {
  switch (line.block_type) {
    case "scene_heading":
      return upper(line.text);
    case "character":
      return `\t\t\t${upper(line.text)}`;
    case "dialogue":
      return `\t\t${line.text}`;
    default:
      return line.text;
  }
}

export const renderResolvedScreenplay = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        document_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: doc, error: dErr } = await supabase
      .from("source_documents")
      .select("id, universe_id, project_id, title")
      .eq("id", data.document_id)
      .single();
    if (dErr || !doc) throw new Error("Document not found");

    // Auto-promote any approved character candidates for this document before
    // rendering, so the segment view always reflects the reviewer's latest
    // identity decisions without a manual promotion step. Idempotent: existing
    // promoted_ref rows short-circuit inside the helper.
    const projectId = (doc as { project_id?: string | null }).project_id;
    if (projectId) {
      try {
        await promoteApprovedCharactersForDocument({
          data: { document_id: data.document_id, project_id: projectId },
        });
      } catch (err) {
        console.warn("[render] auto-promotion failed", err);
      }
    }

    // 1. Resolved character identities for this universe.
    const { data: cands, error: cErr } = await supabase
      .from("import_candidates")
      .select("id, normalized_key, proposed_payload, promoted_ref, status")
      .eq("universe_id", doc.universe_id)
      .eq("candidate_type", "character")
      .in("status", ["accepted", "approved"]);
    if (cErr) throw new Error(cErr.message);

    // Group by canonical character_id.
    const byCharacter = new Map<string, ResolvedEntity>();
    const candidateToCharacter = new Map<string, string>();
    const characterIds: string[] = [];
    for (const c of cands ?? []) {
      const ref = c.promoted_ref as { table?: string; id?: string } | null;
      if (ref?.table !== "characters" || !ref.id) continue;
      candidateToCharacter.set(c.id, ref.id);
      const payload = (c.proposed_payload ?? {}) as { name?: string };
      const rawName = (payload.name?.trim() || c.normalized_key || "").trim();
      const existing = byCharacter.get(ref.id);
      if (existing) {
        if (rawName && !existing.raw_names.includes(rawName)) {
          existing.raw_names.push(rawName);
        }
      } else {
        byCharacter.set(ref.id, {
          character_id: ref.id,
          name: rawName || "UNKNOWN",
          raw_names: rawName ? [rawName] : [],
        });
        characterIds.push(ref.id);
      }
    }

    // 2. Canonical character names + aliases from the `characters` table win
    //    over the raw candidate payload when available.
    if (characterIds.length > 0) {
      const { data: charRows } = await supabase
        .from("characters")
        .select("id, name")
        .in("id", characterIds);
      for (const r of charRows ?? []) {
        const e = byCharacter.get(r.id);
        if (e && r.name) {
          if (!e.raw_names.includes(e.name)) e.raw_names.push(e.name);
          e.name = r.name;
          if (!e.raw_names.includes(r.name)) e.raw_names.push(r.name);
        }
      }
      const { data: aliasRows } = await supabase
        .from("character_aliases")
        .select("character_id, alias_text")
        .in("character_id", characterIds);
      for (const a of aliasRows ?? []) {
        const e = byCharacter.get(a.character_id);
        if (e && a.alias_text && !e.raw_names.includes(a.alias_text)) {
          e.raw_names.push(a.alias_text);
        }
      }
    }

    const entitiesList = Array.from(byCharacter.values());

    // 3. Segments in order.
    const { data: segRows, error: sErr } = await supabase
      .from("source_segments")
      .select("id, sequence, segment_type, heading, raw_text, speakers")
      .eq("document_id", data.document_id)
      .order("sequence", { ascending: true });
    if (sErr) throw new Error(sErr.message);

    // 4. Evidence rows for mention resolution per segment.
    const promotedCandIds = Array.from(candidateToCharacter.keys());
    const mentionsBySegment = new Map<string, Set<string>>();
    if (promotedCandIds.length > 0) {
      const { data: evRows } = await supabase
        .from("import_evidence")
        .select("candidate_id, segment_id")
        .in("candidate_id", promotedCandIds);
      for (const ev of evRows ?? []) {
        const charId = candidateToCharacter.get(ev.candidate_id);
        if (!charId) continue;
        const set = mentionsBySegment.get(ev.segment_id) ?? new Set<string>();
        set.add(charId);
        mentionsBySegment.set(ev.segment_id, set);
      }
    }

    // Fast lookup: uppercase speaker text → canonical entity.
    const speakerKeyToEntity = new Map<string, ResolvedEntity>();
    for (const e of entitiesList) {
      for (const raw of e.raw_names) {
        speakerKeyToEntity.set(upper(raw), e);
      }
    }

    // 5. Build rendered lines.
    const lines: RenderedLine[] = (segRows ?? []).map((seg) => {
      const speakers = (seg.speakers ?? []) as string[];
      const primarySpeaker = speakers[0]?.trim() ?? "";
      const isScene = seg.segment_type === "screenplay_scene";
      const isCharacter = !isScene && primarySpeaker.length > 0;

      // Only rewrite mentions in narrative text — not inside a slug or a
      // speaker tag, where the "name" IS the speaker.
      const segEntities = isScene || isCharacter
        ? []
        : entitiesList.filter((e) =>
            mentionsBySegment.get(seg.id)?.has(e.character_id),
          );

      let resolvedCharacterId: string | null = null;
      let resolvedFromRaw: string | null = null;
      let text = seg.raw_text ?? "";

      if (isScene) {
        text = (seg.heading ?? text).trim();
      } else if (isCharacter) {
        const hit = speakerKeyToEntity.get(upper(primarySpeaker));
        if (hit) {
          resolvedCharacterId = hit.character_id;
          resolvedFromRaw = primarySpeaker;
          // Preserve trailing modifier like "(V.O.)" / "(CONT'D)".
          const tag = primarySpeaker.match(/\((?:V\.?O\.?|O\.?S\.?|CONT'D|CONTINUED|PRE-LAP|FILTERED)\)$/i)?.[0];
          text = tag ? `${hit.name} ${tag}` : hit.name;
        } else {
          text = primarySpeaker;
        }
      } else if (segEntities.length > 0) {
        text = rewriteMentions(text, segEntities);
      }

      const block_type: RenderedLine["block_type"] = isScene
        ? "scene_heading"
        : isCharacter
        ? "character"
        : speakers.length === 0 && (seg.raw_text ?? "").length > 0
        ? "action"
        : "dialogue";

      return {
        segment_id: seg.id,
        sequence: seg.sequence,
        segment_type: seg.segment_type,
        block_type,
        text,
        resolved_character_id: resolvedCharacterId,
        resolved_from_raw: resolvedFromRaw,
      };
    });

    // 6. Plain-text (Fountain-flavored) export.
    const fountain = lines.map(formatFountain).join("\n");

    return {
      document_id: data.document_id,
      title: (doc as { title?: string }).title ?? "Untitled",
      entities: entitiesList,
      lines,
      fountain,
      totals: {
        segments: lines.length,
        resolved_speakers: lines.filter((l) => l.resolved_character_id).length,
        segments_with_mentions: Array.from(mentionsBySegment.values()).filter(
          (s) => s.size > 0,
        ).length,
      },
    };
  });
