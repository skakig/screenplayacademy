/**
 * Read-only World Hub aggregator.
 *
 * Loads counts + sample rows for every currently implemented world entity
 * table so the Hub UI can render tabs without opening N connections. All
 * reads run under RLS as the signed-in user.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  universeId: z.string().uuid(),
  projectId: z.string().uuid(),
});

type Row = { id: string; name: string | null; description?: string | null; created_at: string };

async function fetchTable(
  supabase: any,
  table: string,
  universeId: string,
  columns = "id, name, description, created_at",
): Promise<{ count: number; rows: Row[] }> {
  const { data, count } = await supabase
    .from(table)
    .select(columns, { count: "exact" })
    .eq("universe_id", universeId)
    .order("created_at", { ascending: false })
    .limit(25);
  return { count: count ?? 0, rows: (data as Row[]) ?? [] };
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
        .select("id, version, created_at, character_count", { count: "exact" })
        .eq("universe_id", data.universeId)
        .eq("project_id", data.projectId)
        .order("created_at", { ascending: false })
        .limit(5),
      fetchTable(supabase, "world_locations", data.universeId),
      fetchTable(supabase, "world_factions", data.universeId),
      fetchTable(supabase, "world_events", data.universeId),
      fetchTable(supabase, "world_rules", data.universeId),
      fetchTable(supabase, "world_artifacts", data.universeId),
      fetchTable(supabase, "world_threads", data.universeId),
      fetchTable(supabase, "world_timeline_entries", data.universeId, "id, name, description, created_at"),
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
