/**
 * World Hub aggregator. Delegates all cross-table integration to the
 * unified `getProjectStoryIntelligence` read model (Phase 1) so the
 * Hub Overview cannot drift from the rest of the app. Returns the
 * intelligence snapshot plus the sample rows the tab bodies render.
 *
 * READ-ONLY. No writes here — CRUD lives in Phase 4.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assembleStoryIntelligence } from "@/lib/story-intelligence/projectStoryIntelligence.functions";

const Input = z.object({
  universeId: z.string().uuid(),
  projectId: z.string().uuid(),
});

async function sampleUniverseRows(
  supabase: any,
  table: string,
  universeId: string,
  columns: string,
) {
  const { data } = await supabase
    .from(table)
    .select(columns)
    .eq("universe_id", universeId)
    .order("created_at", { ascending: false })
    .limit(25);
  return (data as any[]) ?? [];
}

export const getWorldHubSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // ---- Load everything needed for the unified read model ----
    const [projectQ, universeQ] = await Promise.all([
      supabase
        .from("projects")
        .select("id, title, user_id, default_universe_id")
        .eq("id", data.projectId)
        .maybeSingle(),
      supabase
        .from("story_universes")
        .select("id, name")
        .eq("id", data.universeId)
        .maybeSingle(),
    ]);
    if (projectQ.error) throw projectQ.error;
    if (!projectQ.data) throw new Error("Project not found");
    const project = projectQ.data;
    const universe = universeQ.data
      ? { id: universeQ.data.id as string, name: universeQ.data.name as string }
      : null;

    const [chars, scenes, sources, bibles] = await Promise.all([
      supabase
        .from("characters")
        .select("id, name, importance, quarantined_at")
        .eq("project_id", data.projectId),
      supabase
        .from("scenes")
        .select("id, scene_heading, order_index")
        .eq("project_id", data.projectId)
        .order("order_index", { ascending: true }),
      supabase
        .from("source_documents")
        .select("id, title, status, updated_at")
        .eq("project_id", data.projectId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("character_bibles")
        .select("version, created_at, entries")
        .eq("project_id", data.projectId)
        .order("version", { ascending: false }),
    ]);
    for (const q of [chars, scenes, sources, bibles]) {
      if (q.error) throw q.error;
    }

    const characterIds = (chars.data ?? []).map((c: any) => c.id as string);
    const sceneIds = (scenes.data ?? []).map((s: any) => s.id as string);

    const [aliases, relationships, sceneStates, scriptBlocks] =
      await Promise.all([
        characterIds.length
          ? supabase
              .from("character_aliases")
              .select("character_id")
              .in("character_id", characterIds)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("character_relationships")
          .select("id, character_id, related_character_id, relationship_type")
          .eq("project_id", data.projectId),
        characterIds.length
          ? supabase
              .from("character_scene_states")
              .select("character_id, scene_id")
              .in("character_id", characterIds)
          : Promise.resolve({ data: [], error: null }),
        sceneIds.length
          ? supabase
              .from("script_blocks")
              .select("id, scene_id, block_type, character_id, content")
              .in("scene_id", sceneIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

    const uid = data.universeId;
    const [
      candidatesQ,
      worldLocationsQ,
      worldFactionsQ,
      worldEventsQ,
      worldRulesQ,
      worldArtifactsQ,
      worldThreadsQ,
      worldTimelineQ,
    ] = await Promise.all([
      supabase
        .from("import_candidates")
        .select(
          "id, candidate_type, normalized_key, status, document_id, promoted_ref, proposed_payload",
        )
        .eq("universe_id", uid),
      supabase
        .from("world_locations")
        .select("id, name, normalized_key, candidate_id, description, created_at")
        .eq("universe_id", uid)
        .order("created_at", { ascending: false }),
      supabase
        .from("world_factions")
        .select("id, name, description, candidate_id, created_at")
        .eq("universe_id", uid)
        .order("created_at", { ascending: false }),
      supabase
        .from("world_events")
        .select("id, name, candidate_id, created_at")
        .eq("universe_id", uid)
        .order("created_at", { ascending: false }),
      supabase
        .from("world_rules")
        .select("id, name, created_at")
        .eq("universe_id", uid)
        .order("created_at", { ascending: false }),
      supabase
        .from("world_artifacts")
        .select("id, name, description, created_at")
        .eq("universe_id", uid)
        .order("created_at", { ascending: false }),
      supabase
        .from("world_threads")
        .select("id, name, status, created_at, event_id:id")
        .eq("universe_id", uid)
        .order("created_at", { ascending: false }),
      supabase
        .from("world_timeline_entries")
        .select("id, event_id, label, sequence, created_at")
        .eq("universe_id", uid)
        .order("sequence", { ascending: true }),
    ]);

    const candidates = candidatesQ.data ?? [];
    let evidence: any[] = [];
    if (candidates.length) {
      const { data: ev } = await supabase
        .from("import_evidence")
        .select("candidate_id")
        .in(
          "candidate_id",
          candidates.map((c: any) => c.id),
        );
      evidence = ev ?? [];
    }

    const intelligence = assembleStoryIntelligence({
      project: project as any,
      universe,
      characters: (chars.data ?? []) as any,
      aliases: ((aliases as any).data ?? []) as any,
      relationships: ((relationships as any).data ?? []) as any,
      sceneStates: ((sceneStates as any).data ?? []) as any,
      scenes: (scenes.data ?? []) as any,
      scriptBlocks: ((scriptBlocks as any).data ?? []) as any,
      sources: (sources.data ?? []) as any,
      candidates: candidates as any,
      evidence: evidence as any,
      worldLocations: (worldLocationsQ.data ?? []) as any,
      worldFactions: (worldFactionsQ.data ?? []) as any,
      worldEvents: (worldEventsQ.data ?? []) as any,
      worldRules: (worldRulesQ.data ?? []) as any,
      worldArtifacts: (worldArtifactsQ.data ?? []) as any,
      worldThreads: (worldThreadsQ.data ?? []) as any,
      worldTimeline: (worldTimelineQ.data ?? []) as any,
      bibles: (bibles.data ?? []) as any,
    });

    return {
      intelligence,
      samples: {
        sources: (sources.data ?? []).slice(0, 25) as any[],
        bibles: (bibles.data ?? []).slice(0, 5) as any[],
        locations: (worldLocationsQ.data ?? []).slice(0, 25) as any[],
        factions: (worldFactionsQ.data ?? []).slice(0, 25) as any[],
        events: (worldEventsQ.data ?? []).slice(0, 25) as any[],
        rules: (worldRulesQ.data ?? []).slice(0, 25) as any[],
        artifacts: (worldArtifactsQ.data ?? []).slice(0, 25) as any[],
        threads: (worldThreadsQ.data ?? []).slice(0, 25) as any[],
        timeline: (worldTimelineQ.data ?? []).slice(0, 25) as any[],
      },
    };
  });
