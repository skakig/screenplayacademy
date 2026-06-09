import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ProjectIdInput = z.object({ projectId: z.string().uuid() });

const AddTermInput = z.object({
  projectId: z.string().uuid(),
  term: z.string().min(1).max(120),
  category: z
    .enum([
      "character",
      "location",
      "organization",
      "object",
      "fictional_term",
      "foreign_word",
      "historical_term",
      "slang",
      "dialect",
      "custom",
    ])
    .default("custom"),
  createdFrom: z
    .enum(["manual", "character_bible", "script_detection", "import", "ai_suggestion"])
    .default("manual"),
  notes: z.string().max(500).optional(),
});

const RemoveTermInput = z.object({ id: z.string().uuid() });

export type DictionaryEntry = {
  id: string;
  project_id: string;
  term: string;
  normalized_term: string;
  category: string;
  language: string | null;
  notes: string | null;
  created_from: string;
  approved: boolean;
  created_at: string;
};

export const listProjectDictionary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProjectIdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("project_dictionary")
      .select("*")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { entries: (rows ?? []) as DictionaryEntry[] };
  });

export const addDictionaryTerm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AddTermInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("project_dictionary")
      .upsert(
        {
          project_id: data.projectId,
          term: data.term.trim(),
          category: data.category,
          created_from: data.createdFrom,
          notes: data.notes ?? null,
          created_by: userId,
          approved: true,
        },
        { onConflict: "project_id,normalized_term", ignoreDuplicates: false },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { entry: row as DictionaryEntry };
  });

export const removeDictionaryTerm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RemoveTermInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("project_dictionary")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const seedDictionaryFromCharacters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProjectIdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: chars, error } = await supabase
      .from("characters")
      .select("name")
      .eq("project_id", data.projectId);
    if (error) throw new Error(error.message);
    const rows = (chars ?? [])
      .map((c: { name: string | null }) => (c.name ?? "").trim())
      .filter((n) => n.length > 0)
      .map((name) => ({
        project_id: data.projectId,
        term: name,
        category: "character" as const,
        created_from: "character_bible" as const,
        approved: true,
        created_by: userId,
      }));
    if (rows.length === 0) return { inserted: 0 };
    const { error: insErr } = await supabase
      .from("project_dictionary")
      .upsert(rows, { onConflict: "project_id,normalized_term", ignoreDuplicates: true });
    if (insErr) throw new Error(insErr.message);
    return { inserted: rows.length };
  });
