import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fail, ok, unauth, userClient } from "./_shared";

/**
 * Small, safe subset of character fields. The characters table has ~90 columns;
 * we expose only the profile fields most useful for external assistants.
 */
const CharacterFields = z.object({
  name: z.string().min(1).max(200).optional(),
  alias: z.string().max(200).nullable().optional(),
  age: z.string().max(60).nullable().optional(),
  character_type: z.string().max(60).nullable().optional(),
  archetype: z.string().max(200).nullable().optional(),
  external_goal: z.string().max(2000).nullable().optional(),
  internal_need: z.string().max(2000).nullable().optional(),
  defining_wound: z.string().max(2000).nullable().optional(),
  fear: z.string().max(2000).nullable().optional(),
  contradiction: z.string().max(2000).nullable().optional(),
  character_arc: z.string().max(4000).nullable().optional(),
  color_palette: z.string().max(500).nullable().optional(),
  costume_notes: z.string().max(2000).nullable().optional(),
  favorite_phrases: z.string().max(2000).nullable().optional(),
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
    const supabase = userClient(ctx);

    const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));

    if (character_id) {
      if (Object.keys(patch).length === 0) return fail("No fields to update.");
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

    if (!patch.name) return fail("`fields.name` is required to create a character.");
    const { data, error } = await supabase
      .from("characters")
      .insert({ project_id, ...patch, name: patch.name as string })
      .select("*")
      .single();
    if (error || !data) return fail(error?.message ?? "Failed to create character");
    return ok(data, "character");
  },
});
