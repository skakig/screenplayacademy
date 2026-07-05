import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  blockContent,
  fail,
  longTextNullable,
  ok,
  shortTextNullable,
  unauth,
  userClient,
} from "./_shared";

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

// Cap initial payload aggressively — a fresh scene doesn't need 200 blocks.
const MAX_INITIAL_BLOCKS = 50;
const MAX_ORDER_INDEX = 100_000;

export default defineTool({
  name: "create_scene",
  title: "Create a scene",
  description:
    "Create a new scene in a screenplay project. Order is appended to the end of the project unless order_index is provided. Respects project RLS — only the project owner can create scenes.",
  inputSchema: {
    project_id: z.string().uuid().describe("The project's UUID."),
    scene_heading: shortTextNullable(300).optional().describe(
      "Slugline, e.g. 'INT. WAREHOUSE - NIGHT'.",
    ),
    title: shortTextNullable(200).optional(),
    location: shortTextNullable(200).optional(),
    time_of_day: shortTextNullable(60).optional(),
    emotional_purpose: longTextNullable(2000).optional(),
    plot_purpose: longTextNullable(2000).optional(),
    conflict: longTextNullable(2000).optional(),
    order_index: z.number().int().min(0).max(MAX_ORDER_INDEX).optional(),
    initial_blocks: z
      .array(
        z.object({
          block_type: z.enum(BLOCK_TYPES),
          content: blockContent,
        }),
      )
      .max(MAX_INITIAL_BLOCKS)
      .optional()
      .describe(
        `Optional initial screenplay blocks written into the new scene (max ${MAX_INITIAL_BLOCKS}).`,
      ),
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
