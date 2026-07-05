import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  SCENE_STATUS,
  assertSceneWritable,
  fail,
  longTextNullable,
  ok,
  shortTextNullable,
  unauth,
  userClient,
} from "./_shared";

export default defineTool({
  name: "update_scene",
  title: "Update a scene",
  description:
    "Update editable metadata on a scene (heading, title, location, time_of_day, purpose, conflict, status). Refuses if another collaborator holds an active lock on the scene. Respects RLS.",
  inputSchema: {
    scene_id: z.string().uuid(),
    scene_heading: shortTextNullable(300).optional(),
    title: shortTextNullable(200).optional(),
    location: shortTextNullable(200).optional(),
    time_of_day: shortTextNullable(60).optional(),
    emotional_purpose: longTextNullable(2000).optional(),
    plot_purpose: longTextNullable(2000).optional(),
    conflict: longTextNullable(2000).optional(),
    reversal: longTextNullable(2000).optional(),
    status: z.enum(SCENE_STATUS).optional(),
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
    if (Object.keys(clean).length === 0) {
      return fail("No fields to update. Provide at least one editable field.");
    }

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
