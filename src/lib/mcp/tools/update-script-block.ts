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

export default defineTool({
  name: "update_script_block",
  title: "Update a screenplay block",
  description:
    "Update the content and/or block_type of an existing screenplay block. Refuses if another collaborator holds an active lock on the block's scene. Respects RLS.",
  inputSchema: {
    block_id: z.string().uuid(),
    content: blockContent.optional(),
    block_type: z.enum(BLOCK_TYPES).optional(),
    character_id: z.string().uuid().nullable().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ block_id, content, block_type, character_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const userId = ctx.getUserId();
    if (!userId) return unauth();

    if (content === undefined && block_type === undefined && character_id === undefined) {
      return fail("No fields to update. Provide content, block_type, or character_id.");
    }

    const supabase = userClient(ctx);

    const { data: current, error: readErr } = await supabase
      .from("script_blocks")
      .select("id, scene_id, project_id")
      .eq("id", block_id)
      .maybeSingle();
    if (readErr) return fail(readErr.message);
    if (!current) return fail("Block not found.");

    if (current.scene_id) {
      const gate = await assertSceneWritable(supabase, current.scene_id, userId);
      if (!gate.ok) return fail(gate.message);
    }

    const patch: Record<string, unknown> = { updated_by: userId };
    if (content !== undefined) patch.content = content;
    if (block_type !== undefined) patch.block_type = block_type;
    if (character_id !== undefined) patch.character_id = character_id;

    const { data, error } = await supabase
      .from("script_blocks")
      .update(patch)
      .eq("id", block_id)
      .select("id, block_type, content, order_index, scene_id, revision, updated_at")
      .single();
    if (error || !data) return fail(error?.message ?? "Failed to update block");
    return ok(data, "block");
  },
});
