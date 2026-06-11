import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const DiagnoseInput = z.object({
  sessionId: z.string().uuid(),
  projectId: z.string().uuid().nullable().optional(),
});

/**
 * Reads the import session + candidates, asks Lovable AI for a structured
 * diagnostic report, and persists it to import_reports + warnings +
 * recommendations.
 */
export const diagnoseImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DiagnoseInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: session, error: sErr } = await supabase
      .from("import_sessions")
      .select("id, project_id, raw_text, source_type, file_name")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (sErr || !session) throw new Error(sErr?.message ?? "Session not found");

    const { data: candidates, error: cErr } = await supabase
      .from("import_block_candidates")
      .select(
        "id, order_index, raw_text, proposed_block_type, confidence, needs_review, proposed_character_name, user_override_type, approved, removed",
      )
      .eq("import_session_id", data.sessionId)
      .order("order_index", { ascending: true });
    if (cErr) throw new Error(cErr.message);

    const live = (candidates ?? []).filter((c) => !c.removed);
    const counts = computeCounts(live);

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("AI diagnostics are unavailable: missing LOVABLE_API_KEY");
    }

    // Compact a sample of blocks to keep prompt + schema small.
    const sample = live.slice(0, 220).map((c) => ({
      i: c.order_index,
      t: c.user_override_type ?? c.proposed_block_type,
      c: c.confidence,
      r: c.needs_review ? 1 : 0,
      x: (c.raw_text ?? "").slice(0, 240),
    }));

    let ai: AiReport;
    try {
      ai = await runAiDiagnose(apiKey, {
        sourceType: session.source_type ?? "paste",
        fileName: session.file_name,
        counts,
        sample,
      });
    } catch (e: any) {
      console.error("diagnoseImport ai", e?.message ?? e);
      // Fall back to a deterministic skeleton so the UI still gets a report.
      ai = {
        summary:
          "AI diagnostics were unavailable for this import. Block detection still ran; review formatting flags below.",
        warnings: heuristicWarnings(live),
        recommendations: [],
      };
    }

    const projectId = data.projectId ?? session.project_id ?? null;

    const { data: report, error: rErr } = await supabase
      .from("import_reports")
      .insert({
        project_id: projectId,
        import_session_id: session.id,
        user_id: userId,
        summary: ai.summary?.slice(0, 4000) ?? "",
        counts,
      })
      .select("id")
      .single();
    if (rErr || !report) throw new Error(rErr?.message ?? "Couldn't save report");

    if (ai.warnings.length > 0) {
      const rows = ai.warnings.slice(0, 50).map((w) => ({
        report_id: report.id,
        severity: clampSeverity(w.severity),
        type: (w.type ?? "general").slice(0, 64),
        message: (w.message ?? "").slice(0, 2000),
        related_candidate_ids: [] as string[],
      }));
      await supabase.from("import_warnings").insert(rows);
    }

    if (ai.recommendations.length > 0) {
      const rows = ai.recommendations.slice(0, 30).map((r) => ({
        report_id: report.id,
        kind: (r.kind ?? "note").slice(0, 64),
        payload: { title: r.title, body: r.body } as any,
        accepted: null,
      }));
      await supabase.from("import_recommendations").insert(rows);
    }

    return { reportId: report.id };
  });

const GetReportInput = z.object({ reportId: z.string().uuid() });

export const getImportReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GetReportInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: report, error } = await supabase
      .from("import_reports")
      .select("id, project_id, import_session_id, summary, counts, created_at")
      .eq("id", data.reportId)
      .maybeSingle();
    if (error || !report) throw new Error(error?.message ?? "Report not found");

    const [{ data: warnings }, { data: recs }] = await Promise.all([
      supabase
        .from("import_warnings")
        .select("id, severity, type, message, related_candidate_ids, created_at")
        .eq("report_id", report.id)
        .order("severity", { ascending: false }),
      supabase
        .from("import_recommendations")
        .select("id, kind, payload, accepted, created_at")
        .eq("report_id", report.id)
        .order("created_at", { ascending: true }),
    ]);

    return { report, warnings: warnings ?? [], recommendations: recs ?? [] };
  });

const LatestInput = z.object({ projectId: z.string().uuid() });

export const getLatestImportReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => LatestInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("import_reports")
      .select("id, summary, counts, created_at")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return row ?? null;
  });

const RecPatch = z.object({
  recommendationId: z.string().uuid(),
  accepted: z.boolean().nullable(),
});

export const setRecommendationAccepted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RecPatch.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("import_recommendations")
      .update({ accepted: data.accepted })
      .eq("id", data.recommendationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------- helpers ---------- */

type AiWarning = { severity: "info" | "warning" | "error"; type: string; message: string };
type AiRec = { kind: string; title: string; body: string };
type AiReport = { summary: string; warnings: AiWarning[]; recommendations: AiRec[] };

async function runAiDiagnose(
  apiKey: string,
  input: {
    sourceType: string;
    fileName: string | null;
    counts: Record<string, number>;
    sample: Array<{ i: number; t: string; c: string; r: number; x: string }>;
  },
): Promise<AiReport> {
  const { generateText, Output } = await import("ai");
  const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
  const provider = createLovableAiGatewayProvider(apiKey);

  const schema = z.object({
    summary: z.string(),
    warnings: z
      .array(
        z.object({
          severity: z.enum(["info", "warning", "error"]),
          type: z.string(),
          message: z.string(),
        }),
      )
      .max(20),
    recommendations: z
      .array(
        z.object({
          kind: z.string(),
          title: z.string(),
          body: z.string(),
        }),
      )
      .max(10),
  });

  const system = [
    "You are SceneSmith, a senior screenplay editor reviewing the result of an automated screenplay import.",
    "Diagnose formatting, structural, character, and world issues from the parsed blocks.",
    "Be concrete and brief. Speak directly to the writer. Never invent facts not in the data.",
  ].join(" ");

  const prompt = [
    `Source: ${input.sourceType}${input.fileName ? ` (${input.fileName})` : ""}`,
    `Block counts: ${JSON.stringify(input.counts)}`,
    "Sample blocks (i=order, t=type, c=confidence, r=needs_review, x=text snippet):",
    JSON.stringify(input.sample),
    "",
    "Produce: a 2-4 sentence summary; up to 12 warnings (formatting, structure, character, world);",
    "and up to 6 actionable recommendations the writer can accept or dismiss.",
  ].join("\n");

  const { output } = await generateText({
    model: provider("google/gemini-3-flash-preview"),
    system,
    prompt,
    output: Output.object({ schema }),
  });

  return output as AiReport;
}

function computeCounts(rows: Array<{ proposed_block_type: string; user_override_type: string | null; needs_review: boolean; approved: boolean }>) {
  const out: Record<string, number> = { total: rows.length, approved: 0, needs_review: 0 };
  for (const r of rows) {
    const t = r.user_override_type ?? r.proposed_block_type;
    out[t] = (out[t] ?? 0) + 1;
    if (r.approved) out.approved++;
    if (r.needs_review) out.needs_review++;
  }
  return out;
}

function clampSeverity(s: string): "info" | "warning" | "error" {
  return s === "error" || s === "warning" ? s : "info";
}

function heuristicWarnings(
  rows: Array<{ proposed_block_type: string; user_override_type: string | null; needs_review: boolean }>,
): AiWarning[] {
  const out: AiWarning[] = [];
  const review = rows.filter((r) => r.needs_review).length;
  if (review > 0) {
    out.push({
      severity: "warning",
      type: "formatting",
      message: `${review} block${review === 1 ? "" : "s"} were flagged for review. Confirm their type before committing.`,
    });
  }
  const scenes = rows.filter(
    (r) => (r.user_override_type ?? r.proposed_block_type) === "scene_heading",
  ).length;
  if (scenes === 0) {
    out.push({
      severity: "warning",
      type: "structure",
      message: "No scene headings detected. The screenplay may be missing INT./EXT. slug lines.",
    });
  }
  return out;
}
