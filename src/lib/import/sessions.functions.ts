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

const ResumableInput = z.object({ projectId: z.string().uuid() });

export const listResumableImports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ResumableInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("import_sessions")
      .select("id, source_type, file_name, status, created_at")
      .eq("project_id", data.projectId)
      .in("status", ["preview_ready", "parsing"])
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const CancelInput = z.object({ sessionId: z.string().uuid() });

export const cancelImportSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CancelInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("import_sessions")
      .update({ status: "cancelled" })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const RevertInput = z.object({ sessionId: z.string().uuid() });

export const revertImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RevertInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: session, error: sErr } = await supabase
      .from("import_sessions")
      .select("id, project_id, status")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (sErr || !session) throw new Error(sErr?.message ?? "Import session not found");
    if (!session.project_id) throw new Error("This import has no target project to revert.");
    if (session.status !== "imported") {
      throw new Error("Only committed imports can be reverted.");
    }

    const { data: takes, error: tErr } = await supabase
      .from("draft_takes")
      .select("id, payload, captured_at")
      .eq("project_id", session.project_id)
      .eq("user_id", userId)
      .order("captured_at", { ascending: false })
      .limit(50);
    if (tErr) throw new Error(tErr.message);

    const match = (takes ?? []).find((tk: any) => {
      const meta = tk?.payload?.metadata;
      return meta && meta.preImportSessionId === data.sessionId;
    });
    if (!match) {
      throw new Error(
        "No pre-import snapshot found. This import cannot be reverted automatically.",
      );
    }

    const payload = match.payload as any;
    const blocks: any[] = Array.isArray(payload?.blocks) ? payload.blocks : [];

    const projectId = session.project_id as string;
    await supabase.from("script_blocks").delete().eq("project_id", projectId);

    const inserted: any[] = [];
    if (blocks.length > 0) {
      const rows = blocks.map((b: any, i: number) => ({
        project_id: projectId,
        block_type: b.block_type,
        content: b.content ?? "",
        character_id: b.character_id ?? null,
        order_index: typeof b.order_index === "number" ? b.order_index : i * 1000,
        metadata: { ...(b.metadata ?? {}), reverted_from_import: data.sessionId },
      }));
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { data: ins, error: bErr } = await supabase
          .from("script_blocks")
          .insert(rows.slice(i, i + CHUNK))
          .select("id, block_type, content, order_index, metadata");
        if (bErr) throw new Error(bErr.message);
        inserted.push(...(ins ?? []));
      }
    }

    await supabase
      .from("import_sessions")
      .update({ status: "reverted" })
      .eq("id", session.id);

    return { projectId: session.project_id, blocks: inserted };
  });
