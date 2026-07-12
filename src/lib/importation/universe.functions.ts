/**
 * Project → default story universe resolver.
 *
 * `resolveDefaultUniverse` is read-only. `ensureDefaultUniverse` is the ONLY
 * server fn allowed to create a universe for a project — it is idempotent
 * and safe to call repeatedly. Both rely on RLS to enforce ownership.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ProjectInput = z.object({ projectId: z.string().uuid() });

export const resolveDefaultUniverse = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ProjectInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: proj, error } = await supabase
      .from("projects")
      .select("id, title, default_universe_id")
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) throw error;
    if (!proj) throw new Error("Project not found");
    if (proj.default_universe_id) {
      const { data: uni } = await supabase
        .from("story_universes")
        .select("id, name")
        .eq("id", proj.default_universe_id)
        .maybeSingle();
      if (uni) {
        return {
          universeId: uni.id,
          name: uni.name,
          projectTitle: proj.title,
          canCreate: false as const,
        };
      }
    }
    return {
      universeId: null as string | null,
      name: null as string | null,
      projectTitle: proj.title,
      canCreate: true as const,
    };
  });

export const ensureDefaultUniverse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        name: z.string().min(1).max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: proj, error: pErr } = await supabase
      .from("projects")
      .select("id, title, default_universe_id, user_id")
      .eq("id", data.projectId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!proj) throw new Error("Project not found");

    // Idempotent short-circuit — if a default already exists, return it.
    if (proj.default_universe_id) {
      const { data: existing } = await supabase
        .from("story_universes")
        .select("id, name")
        .eq("id", proj.default_universe_id)
        .maybeSingle();
      if (existing) {
        return { universeId: existing.id, name: existing.name, created: false };
      }
    }

    const universeName = data.name?.trim() || proj.title || "Story Universe";

    const { data: created, error: cErr } = await supabase
      .from("story_universes")
      .insert({
        owner_id: userId,
        name: universeName,
      })
      .select("id, name")
      .single();
    if (cErr) throw cErr;

    const { error: linkErr } = await supabase
      .from("projects")
      .update({ default_universe_id: created.id })
      .eq("id", data.projectId)
      .is("default_universe_id", null); // only link if still empty (race-safe)
    if (linkErr) throw linkErr;

    return { universeId: created.id, name: created.name, created: true };
  });
