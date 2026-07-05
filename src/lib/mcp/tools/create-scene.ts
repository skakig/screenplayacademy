import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, unauth, userClient } from "./_shared";

const BLOCK_TYPES = [
  "scene_heading",
  "action",
  "character",
  "dialogue",
  "parenthetical",
  "transition",
  "shot",
  "note",
] as const;

export default defineTool({
  name: "create_scene",
  title: "Create a scene",
  description:
    "Create a new scene in a screenplay project. Order is appended to the end of the project unless order_index is provided. Respects project RLS — only the project owner can create scenes.",
  inputSchema: {
    project_id: z.string().uuid().describe("The project's UUID."),
    scene_heading: z
      .string()
      .max(500)
      .optional()
      .describe("Slugline, e.g. 'INT. WAREHOUSE - NIGHT'."),
    title: z.string().max(300).optional().describe("Optional short scene title."),
    location: z.string().max(200).optional(),
    time_of_day: z.string().max(60).optional().describe("e.g. DAY, NIGHT, MORNING."),
    emotional_purpose: z.string().max(2000).optional(),
    plot_purpose: z.string().max(2000).optional(),
    conflict: z.string().max(2000).optional(),
    order_index: z.number().int().min(0).optional(),
    initial_blocks: z
      .array(
        z.object({
          block_type: z.enum(BLOCK_TYPES),
          content: z.string().max(8000),
        }),
      )
      .max(200)
      .optional()
      .describe("Optional initial screenplay blocks written into the new scene."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const supabase = userClient(ctx);

    let orderIndex = input.order_index;
    if (orderIndex === undefined) {
      const { data: last } = await supabase
        .from("scenes")
        .select("order_index")
        .eq("project_id", input.project_id)
        .order("order_index", { ascending: false })
        .limit(1);
      orderIndex = (last?.[0]?.order_index ?? -1) + 1;
    }

    const { data: scene, error } = await supabase
      .from("scenes")
      .insert({
        project_id: input.project_id,
        scene_heading: input.scene_heading ?? null,
        title: input.title ?? null,
        location: input.location ?? null,
        time_of_day: input.time_of_day ?? null,
        emotional_purpose: input.emotional_purpose ?? null,
        plot_purpose: input.plot_purpose ?? null,
        conflict: input.conflict ?? null,
        order_index: orderIndex,
      })
      .select("*")
      .single();
    if (error || !scene) return fail(error?.message ?? "Failed to create scene");

    if (input.initial_blocks?.length) {
      const { data: lastBlock } = await supabase
        .from("script_blocks")
        .select("order_index")
        .eq("project_id", input.project_id)
        .order("order_index", { ascending: false })
        .limit(1);
      let nextOrder = (lastBlock?.[0]?.order_index ?? -1) + 1;
      const rows = input.initial_blocks.map((b) => ({
        project_id: input.project_id,
        scene_id: scene.id,
        block_type: b.block_type,
        content: b.content,
        order_index: nextOrder++,
        updated_by: ctx.getUserId(),
      }));
      const { error: blockErr } = await supabase.from("script_blocks").insert(rows);
      if (blockErr) return fail(`Scene created but blocks failed: ${blockErr.message}`);
    }

    return ok(scene, "scene");
  },
});
