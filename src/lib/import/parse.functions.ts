import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { parseScreenplayText } from "./parser";

const ParseInput = z.object({ sessionId: z.string().uuid() });

export const parseScreenplay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ParseInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Load session (RLS scopes to caller)
    const { data: session, error: sErr } = await supabase
      .from("import_sessions")
      .select("id, project_id, raw_text")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (sErr || !session) throw new Error(sErr?.message ?? "Import session not found");
    if (!session.raw_text || !session.raw_text.trim()) {
      throw new Error("This import is empty.");
    }

    // Pull existing character roster (for medium-confidence character matches)
    let knownNames: string[] = [];
    if (session.project_id) {
      const { data: chars } = await supabase
        .from("characters")
        .select("name")
        .eq("project_id", session.project_id);
      knownNames = (chars ?? []).map((c: any) => c.name).filter(Boolean);
    }

    const candidates = parseScreenplayText(session.raw_text, knownNames);

    // Wipe any existing candidates for this session (idempotent reparse)
    await supabase
      .from("import_block_candidates")
      .delete()
      .eq("import_session_id", data.sessionId);

    if (candidates.length > 0) {
      // Auto-approve high-confidence non-review items so commit is a one-click affair.
      const rows = candidates.map((c) => ({
        import_session_id: data.sessionId,
        order_index: c.order_index,
        raw_text: c.raw_text,
        proposed_block_type: c.proposed_block_type,
        confidence: c.confidence,
        reason: c.reason ?? null,
        needs_review: c.needs_review,
        proposed_scene_index: c.proposed_scene_index ?? null,
        proposed_character_name: c.proposed_character_name ?? null,
        approved: c.confidence === "high" && !c.needs_review,
      }));
      // Chunk in case of huge scripts (Postgres parameter limit ~65k).
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error: insErr } = await supabase
          .from("import_block_candidates")
          .insert(rows.slice(i, i + CHUNK));
        if (insErr) throw new Error(insErr.message);
      }
    }

    await supabase
      .from("import_sessions")
      .update({ status: "preview_ready" })
      .eq("id", data.sessionId);

    return { count: candidates.length };
  });

const UpdateInput = z.object({
  candidateId: z.string().uuid(),
  patch: z.object({
    raw_text: z.string().optional(),
    user_override_type: z.string().nullable().optional(),
    approved: z.boolean().optional(),
    removed: z.boolean().optional(),
    needs_review: z.boolean().optional(),
  }),
});

export const updateImportCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("import_block_candidates")
      .update(data.patch)
      .eq("id", data.candidateId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const BulkApproveInput = z.object({
  sessionId: z.string().uuid(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
});

export const bulkApproveCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BulkApproveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("import_block_candidates")
      .update({ approved: true })
      .eq("import_session_id", data.sessionId)
      .eq("removed", false);
    if (data.confidence) q = q.eq("confidence", data.confidence);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });
