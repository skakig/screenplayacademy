// Character Bible PDF export payload — bundles a bible version with resolved
// character portraits and the full universe tier (locations, factions, events,
// artifacts, rules, threads, timeline) so the client PDF renderer can produce
// a single self-contained document.
//
// Pro+ gated (mirrors pitch_character_bible). Throws PLAN_LIMIT for the UI.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasFeature, tierFromPriceId } from "@/lib/entitlements";
import { serverStripeEnv } from "@/lib/stripeEnv.server";

export type BibleExportEntry = {
  character_id: string;
  name: string;
  importance: string | null;
  aliases: string[];
  first_appearance: {
    document_id: string;
    segment_id: string;
    sequence: number;
    heading: string | null;
  } | null;
  speaking_segments: number;
  mention_segments: number;
  top_evidence: {
    segment_id: string;
    excerpt: string;
    confidence: number;
    document_id: string | null;
  }[];
};

export type BibleExportPortrait = {
  character_id: string;
  portrait_url: string | null;
};

export type BibleExportWorldEntity = {
  id: string;
  name: string;
  description?: string | null;
  extra?: string | null;
};

export type BibleExportWorld = {
  locations: BibleExportWorldEntity[];
  factions: BibleExportWorldEntity[];
  events: BibleExportWorldEntity[];
  artifacts: BibleExportWorldEntity[];
  rules: BibleExportWorldEntity[];
  threads: BibleExportWorldEntity[];
  timeline: BibleExportWorldEntity[];
};

export type BibleExportPayload = {
  project: { id: string; title: string | null };
  universe: { id: string; name: string | null };
  bible: {
    id: string;
    version: number;
    summary: string | null;
    created_at: string;
    entries: BibleExportEntry[];
  };
  portraits: BibleExportPortrait[];
  world: BibleExportWorld;
};

export const getCharacterBibleExport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        project_id: z.string().uuid(),
        universe_id: z.string().uuid(),
        bible_id: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<BibleExportPayload> => {
    const { supabase, userId } = context;

    // ---- Tier gate ----
    const environment = serverStripeEnv();
    const { data: subRow } = await supabase
      .from("subscriptions")
      .select("price_id, status, current_period_end")
      .eq("user_id", userId)
      .eq("environment", environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let tier: ReturnType<typeof tierFromPriceId> = "free";
    if (subRow) {
      const periodOk =
        !subRow.current_period_end ||
        new Date(subRow.current_period_end as string).getTime() > Date.now();
      const isActive =
        (["active", "trialing", "past_due"].includes(subRow.status as string) &&
          periodOk) ||
        (subRow.status === "canceled" && periodOk);
      if (isActive) tier = tierFromPriceId(subRow.price_id as string | null);
    }
    if (!hasFeature(tier, "character_bible_pdf")) {
      throw new Error(
        "PLAN_LIMIT: Downloading the Character Bible as PDF requires the Pro plan or higher.",
      );
    }

    // ---- Project + universe ----
    const [{ data: proj }, { data: uni }] = await Promise.all([
      supabase
        .from("projects")
        .select("id, title")
        .eq("id", data.project_id)
        .single(),
      supabase
        .from("story_universes")
        .select("id, name")
        .eq("id", data.universe_id)
        .single(),
    ]);
    if (!proj) throw new Error("Project not found");
    if (!uni) throw new Error("Universe not found");

    // ---- Bible (specific version or latest) ----
    const bibleQuery = supabase
      .from("character_bibles")
      .select("id, version, summary, entries, created_at")
      .eq("project_id", data.project_id)
      .eq("universe_id", data.universe_id);

    const { data: bibleRow, error: bErr } = data.bible_id
      ? await bibleQuery.eq("id", data.bible_id).maybeSingle()
      : await bibleQuery
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();
    if (bErr) throw new Error(bErr.message);
    if (!bibleRow) throw new Error("No Character Bible found for this project.");

    const entries =
      ((bibleRow.entries as unknown) as BibleExportEntry[]) ?? [];

    // ---- Portraits for characters cited in this bible version ----
    const characterIds = Array.from(
      new Set(entries.map((e) => e.character_id).filter(Boolean)),
    );
    let portraits: BibleExportPortrait[] = [];
    if (characterIds.length > 0) {
      const { data: chars, error: cErr } = await supabase
        .from("characters")
        .select("id, portrait_url, portrait_path")
        .in("id", characterIds)
        .eq("project_id", data.project_id);
      if (cErr) throw new Error(cErr.message);

      // Refresh signed URLs for any storage-backed portraits so the PDF
      // renderer can actually fetch the bytes.
      portraits = await Promise.all(
        (chars ?? []).map(async (c) => {
          const path = (c as { portrait_path?: string | null }).portrait_path;
          if (path) {
            const { data: signed } = await supabase.storage
              .from("character-portraits")
              .createSignedUrl(path, 60 * 60);
            if (signed?.signedUrl) {
              return {
                character_id: c.id as string,
                portrait_url: signed.signedUrl,
              };
            }
          }
          return {
            character_id: c.id as string,
            portrait_url:
              (c as { portrait_url?: string | null }).portrait_url ?? null,
          };
        }),
      );
    }

    // ---- World tiers ----
    const uid = data.universe_id;
    const [
      { data: locs },
      { data: facs },
      { data: evts },
      { data: arts },
      { data: rules },
      { data: threads },
      { data: timeline },
    ] = await Promise.all([
      supabase
        .from("world_locations")
        .select("id, name, description, int_ext")
        .eq("universe_id", uid)
        .order("name"),
      supabase
        .from("world_factions")
        .select("id, name, description, kind")
        .eq("universe_id", uid)
        .order("name"),
      supabase
        .from("world_events")
        .select("id, name, summary, sequence")
        .eq("universe_id", uid)
        .order("sequence", { ascending: true, nullsFirst: false }),
      supabase
        .from("world_artifacts")
        .select("id, name, description")
        .eq("universe_id", uid)
        .order("name"),
      supabase
        .from("world_rules")
        .select("id, name, statement, scope")
        .eq("universe_id", uid)
        .order("name"),
      supabase
        .from("world_threads")
        .select("id, name, question, status")
        .eq("universe_id", uid)
        .order("name"),
      supabase
        .from("world_timeline_entries")
        .select("id, label, when_hint, sequence")
        .eq("universe_id", uid)
        .order("sequence"),
    ]);

    const world: BibleExportWorld = {
      locations: (locs ?? []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        description: (r.description as string | null) ?? null,
        extra: (r.int_ext as string | null) ?? null,
      })),
      factions: (facs ?? []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        description: (r.description as string | null) ?? null,
        extra: (r.kind as string | null) ?? null,
      })),
      events: (evts ?? []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        description: (r.summary as string | null) ?? null,
        extra: r.sequence != null ? `seq ${r.sequence}` : null,
      })),
      artifacts: (arts ?? []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        description: (r.description as string | null) ?? null,
        extra: null,
      })),
      rules: (rules ?? []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        description: (r.statement as string | null) ?? null,
        extra: (r.scope as string | null) ?? null,
      })),
      threads: (threads ?? []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        description: (r.question as string | null) ?? null,
        extra: (r.status as string | null) ?? null,
      })),
      timeline: (timeline ?? []).map((r) => ({
        id: r.id as string,
        name: r.label as string,
        description: (r.when_hint as string | null) ?? null,
        extra: r.sequence != null ? `#${r.sequence}` : null,
      })),
    };

    return {
      project: { id: proj.id as string, title: (proj.title as string) ?? null },
      universe: { id: uni.id as string, name: (uni.name as string) ?? null },
      bible: {
        id: bibleRow.id as string,
        version: bibleRow.version as number,
        summary: (bibleRow.summary as string | null) ?? null,
        created_at: bibleRow.created_at as string,
        entries,
      },
      portraits,
      world,
    };
  });
