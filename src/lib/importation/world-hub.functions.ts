/**
 * Read-only World Hub aggregator. Loads counts + sample rows for every
 * currently implemented world entity table so the Hub UI can render tabs
 * from a single request. All reads run under RLS as the signed-in user.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  universeId: z.string().uuid(),
  projectId: z.string().uuid(),
});

async function loadTable(
  supabase: any,
  table: string,
  universeId: string,
  columns: string,
) {
  const { data, count } = await supabase
    .from(table)
    .select(columns, { count: "exact" })
    .eq("universe_id", universeId)
    .order("created_at", { ascending: false })
    .limit(25);
  return { count: count ?? 0, rows: (data as any[]) ?? [] };
}

export const getWorldHubSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const [
      sources,
      bibles,
      locations,
      factions,
      events,
      rules,
      artifacts,
      threads,
      timeline,
    ] = await Promise.all([
      supabase
        .from("source_documents")
        .select("id, title, status, created_at, updated_at", { count: "exact" })
        .eq("universe_id", data.universeId)
        .eq("project_id", data.projectId)
        .order("updated_at", { ascending: false })
        .limit(25),
      supabase
        .from("character_bibles")
        .select("id, version, created_at", { count: "exact" })
        .eq("universe_id", data.universeId)
        .eq("project_id", data.projectId)
        .order("created_at", { ascending: false })
        .limit(5),
      loadTable(supabase, "world_locations", data.universeId, "id, name, description, created_at"),
      loadTable(supabase, "world_factions", data.universeId, "id, name, description, created_at"),
      loadTable(supabase, "world_events", data.universeId, "id, name, created_at"),
      loadTable(supabase, "world_rules", data.universeId, "id, name, created_at"),
      loadTable(supabase, "world_artifacts", data.universeId, "id, name, description, created_at"),
      loadTable(supabase, "world_threads", data.universeId, "id, name, status, created_at"),
      loadTable(supabase, "world_timeline_entries", data.universeId, "id, created_at"),
    ]);

    return {
      sources: { count: sources.count ?? 0, rows: (sources.data ?? []) as any[] },
      bibles: { count: bibles.count ?? 0, rows: (bibles.data ?? []) as any[] },
      locations,
      factions,
      events,
      rules,
      artifacts,
      threads,
      timeline,
    };
  });
