/**
 * Per-scene-heading link index — resolves a project's default universe and
 * returns the set of world_locations available for scene-heading auto-linking.
 * The editor uses this to render a live "linked / unlinked / no universe"
 * badge next to each scene_heading block without a round-trip per line.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({ projectId: z.string().uuid() });

export type SceneHeadingLinkIndex = {
  universeId: string | null;
  locations: Array<{ id: string; name: string; normalized_key: string }>;
};

export const getSceneHeadingLinkIndex = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<SceneHeadingLinkIndex> => {
    const { data: project, error: projErr } = await context.supabase
      .from("projects")
      .select("id, default_universe_id")
      .eq("id", data.projectId)
      .maybeSingle();
    if (projErr) throw projErr;
    if (!project) throw new Error("Project not found");

    const universeId: string | null = project.default_universe_id ?? null;
    if (!universeId) return { universeId: null, locations: [] };

    const { data: locs, error: locErr } = await context.supabase
      .from("world_locations")
      .select("id, name, normalized_key")
      .eq("universe_id", universeId);
    if (locErr) throw locErr;

    return {
      universeId,
      locations: (locs ?? []).map((l: any) => ({
        id: l.id,
        name: l.name,
        normalized_key: l.normalized_key,
      })),
    };
  });
