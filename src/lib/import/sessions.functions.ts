import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SourceType = z.enum([
  "paste",
  "txt",
  "fountain",
  "fdx",
  "pdf",
  "docx",
  "rtf",
  "markdown",
  "scenesmith_json",
]);

const CreateInput = z.object({
  projectId: z.string().uuid().nullable().optional(),
  sourceType: SourceType,
  fileName: z.string().max(255).optional(),
  rawText: z.string().min(1).max(2_000_000),
});

export const createImportSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("import_sessions")
      .insert({
        project_id: data.projectId ?? null,
        user_id: userId,
        source_type: data.sourceType,
        file_name: data.fileName ?? null,
        raw_text: data.rawText,
        status: "parsing",
      })
      .select("id, project_id, source_type, file_name, status, created_at")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Couldn't create import session");
    return row;
  });

const GetInput = z.object({ sessionId: z.string().uuid() });

export const getImportSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GetInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: session, error: sErr } = await supabase
      .from("import_sessions")
      .select("id, project_id, source_type, file_name, status, raw_text, error, created_at")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (sErr || !session) throw new Error(sErr?.message ?? "Session not found");
    const { data: candidates, error: cErr } = await supabase
      .from("import_block_candidates")
      .select(
        "id, order_index, raw_text, proposed_block_type, confidence, reason, needs_review, proposed_scene_index, proposed_character_name, user_override_type, approved, removed",
      )
      .eq("import_session_id", data.sessionId)
      .order("order_index", { ascending: true });
    if (cErr) throw new Error(cErr.message);
    return { session, candidates: candidates ?? [] };
  });

const ListInput = z.object({ projectId: z.string().uuid() });

export const listProjectImports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("import_sessions")
      .select("id, source_type, file_name, status, created_at")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
