import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  assertSceneWritable,
  blockContent,
  fail,
  ok,
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

// Batch cap — external assistants should stream in chunks, not dump manuscripts.
const MAX_BLOCKS_PER_CALL = 50;

export default defineTool({
  name: "append_script_blocks",
  title: "Append screenplay blocks to a scene",
  description:
    `Append up to ${MAX_BLOCKS_PER_CALL} screenplay blocks (action, character, dialogue, parenthetical, transition, shot, note, scene_heading) to the end of a scene. Refuses if another collaborator holds an active lock on the scene. Respects RLS.`,
  inputSchema: {
    project_id: z.string().uuid(),
    scene_id: z.string().uuid(),
    blocks: z
      .array(
        z.object({
          block_type: z.enum(BLOCK_TYPES),
          content: blockContent,
          character_id: z.string().uuid().nullable().optional(),
        }),
      )
      .min(1)
      .max(MAX_BLOCKS_PER_CALL),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ project_id, scene_id, blocks }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const userId = ctx.getUserId();
    if (!userId) return unauth();
    const supabase = userClient(ctx);

    // Verify scene belongs to project — prevents cross-project injection even
    // under permissive RLS.
    const { data: scene, error: sceneErr } = await supabase
      .from("scenes")
      .select("id, project_id")
      .eq("id", scene_id)
      .maybeSingle();
    if (sceneErr) return fail(sceneErr.message);
    if (!scene) return fail("Scene not found.");
    if (scene.project_id !== project_id) {
      return fail("scene_id does not belong to the given project_id.");
    }

    const gate = await assertSceneWritable(supabase, scene_id, userId);
    if (!gate.ok) return fail(gate.message);

    const { data: last } = await supabase
      .from("script_blocks")
      .select("order_index")
      .eq("project_id", project_id)
      .order("order_index", { ascending: false })
      .limit(1);
    let nextOrder = (last?.[0]?.order_index ?? -1) + 1;

    const rows = blocks.map((b) => ({
      project_id,
      scene_id,
      block_type: b.block_type,
      content: b.content,
      character_id: b.character_id ?? null,
      order_index: nextOrder++,
      updated_by: userId,
    }));

    const { data, error } = await supabase
      .from("script_blocks")
      .insert(rows)
      .select("id, block_type, content, order_index, scene_id");
    if (error) return fail(error.message);
    return ok(data ?? [], "blocks");
  },
});
