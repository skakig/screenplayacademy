import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  linkSceneLocationsForProject,
  type SceneWorldLinkResult,
} from "@/lib/editor/sceneWorldLink.functions";

const SceneIn = z.object({
  heading: z.string().min(1).max(500),
  location: z.string().max(500).optional(),
  time_of_day: z.string().max(60).optional(),
  order_index: z.number().int().min(0).max(10_000),
});

const Input = z.object({
  projectId: z.string().uuid(),
  scenes: z.array(SceneIn).min(0).max(500),
});

/**
 * Sync the auto-detected scenes from the manuscript into the `scenes` table.
 * Strategy: upsert by (project_id, order_index). We don't delete existing
 * scenes here — manual scene records made on the Scenes page survive.
 */
export const syncManuscriptScenes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { data: project } = await context.supabase
      .from("projects")
      .select("id")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project) throw new Error("Project not found");

    const { data: existing = [] } = await context.supabase
      .from("scenes")
      .select("id, order_index, scene_heading")
      .eq("project_id", data.projectId);

    const byOrder = new Map((existing ?? []).map((s: any) => [s.order_index, s]));
    let created = 0;
    let updated = 0;

    for (const s of data.scenes) {
      const match = byOrder.get(s.order_index);
      const row = {
        project_id: data.projectId,
        scene_heading: s.heading,
        title: deriveTitle(s.heading),
        location: s.location ?? null,
        time_of_day: s.time_of_day ?? null,
        order_index: s.order_index,
      };
      if (match) {
        // Only update if heading actually changed (avoid noisy updates).
        if (match.scene_heading !== s.heading) {
          await context.supabase.from("scenes").update(row).eq("id", match.id);
          updated += 1;
        }
      } else {
        await context.supabase.from("scenes").insert({ ...row, status: "draft" });
        created += 1;
      }
    }

    let worldLink: SceneWorldLinkResult | null = null;
    try {
      worldLink = await linkSceneLocationsForProject(
        context.supabase,
        data.projectId,
      );
    } catch (err) {
      // Auto-linking is best-effort — never fail the scene sync because of it.
      console.error("[sceneSync] auto-link failed", err);
    }

    return { created, updated, worldLink };
  });

function deriveTitle(heading: string): string {
  // "INT. AFRICAN DESERT - DAY" -> "African Desert"
  const stripped = heading
    .replace(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s*/i, "")
    .replace(/\s*[-—–]\s*(DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|CONTINUOUS|LATER|MOMENTS LATER).*$/i, "")
    .trim();
  return stripped
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}
