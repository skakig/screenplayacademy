import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  fail,
  longTextNullable,
  ok,
  requireMcpWrites,
  shortText,
  shortTextNullable,
  unauth,
  userClient,
} from "./_shared";

/**
 * Small, safe subset of character fields. The characters table has ~90 columns;
 * we expose only the profile fields most useful for external assistants.
 */
const CharacterFields = z.object({
  name: shortText(120).optional(),
  alias: shortTextNullable(120).optional(),
  age: shortTextNullable(40).optional(),
  character_type: shortTextNullable(40).optional(),
  archetype: shortTextNullable(120).optional(),
  external_goal: longTextNullable(2000).optional(),
  internal_need: longTextNullable(2000).optional(),
  defining_wound: longTextNullable(2000).optional(),
  fear: longTextNullable(2000).optional(),
  contradiction: longTextNullable(2000).optional(),
  character_arc: longTextNullable(4000).optional(),
  color_palette: shortTextNullable(300).optional(),
  costume_notes: longTextNullable(2000).optional(),
  favorite_phrases: longTextNullable(2000).optional(),
});

export default defineTool({
  name: "upsert_character",
  title: "Create or update a character",
  description:
    "Create a new character in a project, or update an existing one when character_id is provided. Only a small safe subset of profile fields is writable. Respects project RLS.",
  inputSchema: {
    project_id: z.string().uuid(),
    character_id: z
      .string()
      .uuid()
      .optional()
      .describe("If provided, update this character. Otherwise create a new one."),
    fields: CharacterFields,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ project_id, character_id, fields }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const userId = ctx.getUserId();
    if (!userId) return unauth();
    const supabase = userClient(ctx);

    const gate = await requireMcpWrites(supabase, userId);
    if (!gate.ok) return fail(gate.message);



    const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));

    if (character_id) {
      if (Object.keys(patch).length === 0) {
        return fail("No fields to update. Provide at least one editable field.");
      }
      // Verify character belongs to project before update.
      const { data: existing, error: readErr } = await supabase
        .from("characters")
        .select("id, project_id")
        .eq("id", character_id)
        .maybeSingle();
      if (readErr) return fail(readErr.message);
      if (!existing) return fail("Character not found.");
      if (existing.project_id !== project_id) {
        return fail("character_id does not belong to the given project_id.");
      }

      const { data, error } = await supabase
        .from("characters")
        .update(patch)
        .eq("id", character_id)
        .eq("project_id", project_id)
        .select("*")
        .single();
      if (error || !data) return fail(error?.message ?? "Failed to update character");
      return ok(data, "character");
    }

    if (!patch.name || typeof patch.name !== "string") {
      return fail("`fields.name` is required to create a character.");
    }
    const { data, error } = await supabase
      .from("characters")
      .insert({ project_id, ...patch, name: patch.name as string })
      .select("*")
      .single();
    if (error || !data) return fail(error?.message ?? "Failed to create character");
    return ok(data, "character");
  },
});
