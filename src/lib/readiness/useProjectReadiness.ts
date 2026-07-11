import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ReadinessCounts } from "./menuGate";

/**
 * Fetch the minimal counts required to answer "does this project have
 * scenes / characters / a written script?". Cached under a stable key so the
 * StudioMenu and every RouteReadinessGate on the same project share one
 * round trip.
 */
export function useProjectReadiness(projectId: string | null) {
  return useQuery<ReadinessCounts>({
    queryKey: ["project-readiness", projectId],
    enabled: Boolean(projectId),
    staleTime: 30_000,
    queryFn: async () => {
      if (!projectId) return { scenes: 0, characters: 0, scriptBlocks: 0 };
      const [scenes, characters, blocks] = await Promise.all([
        supabase
          .from("scenes")
          .select("id", { count: "exact", head: true })
          .eq("project_id", projectId),
        supabase
          .from("characters")
          .select("id", { count: "exact", head: true })
          .eq("project_id", projectId),
        supabase
          .from("script_blocks")
          .select("id", { count: "exact", head: true })
          .eq("project_id", projectId),
      ]);
      return {
        scenes: scenes.count ?? 0,
        characters: characters.count ?? 0,
        scriptBlocks: blocks.count ?? 0,
      };
    },
  });
}
