import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { assertSceneWritable, fail, ok, unauth, userClient } from "./_shared";

export default defineTool({
  name: "update_scene",
  title: "Update a scene",
  description:
    "Update editable metadata on a scene (heading, title, location, time_of_day, purpose, conflict, status). Refuses if another collaborator holds an active lock on the scene. Respects RLS.",
  inputSchema: {
    scene_id: z.string().uuid(),
    scene_heading: z.string().max(500).nullable().optional(),
    title: z.string().max(300).nullable().optional(),
    location: z.string().max(200).nullable().optional(),
    time_of_day: z.string().max(60).nullable().optional(),
    emotional_purpose: z.string().max(2000).nullable().optional(),
    plot_purpose: z.string().max(2000).nullable().optional(),
    conflict: z.string().max(2000).nullable().optional(),
    reversal: z.string().max(2000).nullable().optional(),
    status: z.string().max(40).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const supabase = userClient(ctx);
    const userId = ctx.getUserId();
    if (!userId) return unauth();

    const gate = await assertSceneWritable(supabase, input.scene_id, userId);
    if (!gate.ok) return fail(gate.message);

    const { scene_id, ...patch } = input;
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (Object.keys(clean).length === 0) return fail("No fields to update.");

    const { data, error } = await supabase
      .from("scenes")
      .update(clean)
      .eq("id", scene_id)
      .select("*")
      .single();
    if (error || !data) return fail(error?.message ?? "Failed to update scene");
    return ok(data, "scene");
  },
});
