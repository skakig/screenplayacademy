import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CommitInput = z.object({
  sessionId: z.string().uuid(),
  mode: z.enum(["replace", "append", "new_project"]),
  newProjectTitle: z.string().min(1).max(200).optional(),
});

const ORDER_GAP = 1000;

export const commitImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CommitInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: session, error: sErr } = await supabase
      .from("import_sessions")
      .select("id, project_id, file_name, source_type")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (sErr || !session) throw new Error(sErr?.message ?? "Import session not found");

    // Resolve target project
    let projectId = session.project_id as string | null;
    if (data.mode === "new_project") {
      const title = data.newProjectTitle?.trim() || session.file_name || "Imported screenplay";
      const { data: proj, error: pErr } = await supabase
        .from("projects")
        .insert({ title, user_id: userId })
        .select("id")
        .single();
      if (pErr || !proj) throw new Error(pErr?.message ?? "Couldn't create project");
      projectId = proj.id;
      await supabase
        .from("import_sessions")
        .update({ project_id: projectId })
        .eq("id", session.id);
    }
    if (!projectId) throw new Error("Import has no target project");

    // Load approved, non-removed candidates
    const { data: candidates, error: cErr } = await supabase
      .from("import_block_candidates")
      .select(
        "id, order_index, raw_text, proposed_block_type, user_override_type, proposed_character_name",
      )
      .eq("import_session_id", data.sessionId)
      .eq("approved", true)
      .eq("removed", false)
      .order("order_index", { ascending: true });
    if (cErr) throw new Error(cErr.message);
    const approved = candidates ?? [];
    if (approved.length === 0) {
      throw new Error("Nothing to import. Approve at least one block first.");
    }

    // Replace: delete existing blocks for this project (auto-slate handled client-side)
    let startOrder = 0;
    if (data.mode === "replace") {
      await supabase.from("script_blocks").delete().eq("project_id", projectId);
    } else {
      const { data: maxRow } = await supabase
        .from("script_blocks")
        .select("order_index")
        .eq("project_id", projectId)
        .order("order_index", { ascending: false })
        .limit(1)
        .maybeSingle();
      startOrder = ((maxRow?.order_index as number | undefined) ?? 0) + ORDER_GAP;
    }

    // Upsert character roster from candidates that became character blocks
    const characterNames = new Set<string>();
    for (const c of approved) {
      const t = (c.user_override_type ?? c.proposed_block_type) as string;
      if (t === "character") {
        const name = (c.proposed_character_name ?? c.raw_text)
          .toString()
          .replace(/\s*\(.*?\)\s*$/, "")
          .trim();
        if (name) characterNames.add(name);
      }
    }
    const nameToId = new Map<string, string>();
    if (characterNames.size > 0) {
      const { data: existing } = await supabase
        .from("characters")
        .select("id, name")
        .eq("project_id", projectId);
      for (const c of existing ?? []) {
        nameToId.set((c.name as string).toUpperCase(), c.id as string);
      }
      const newOnes = [...characterNames].filter((n) => !nameToId.has(n.toUpperCase()));
      if (newOnes.length > 0) {
        const { data: inserted, error: insErr } = await supabase
          .from("characters")
          .insert(newOnes.map((name) => ({ project_id: projectId, name })))
          .select("id, name");
        if (insErr) throw new Error(insErr.message);
        for (const c of inserted ?? []) {
          nameToId.set((c.name as string).toUpperCase(), c.id as string);
        }
      }
    }

    // Build script_blocks rows
    const blockRows = approved.map((c, i) => {
      const block_type = (c.user_override_type ?? c.proposed_block_type) as string;
      let character_id: string | null = null;
      if (block_type === "character") {
        const name = (c.proposed_character_name ?? c.raw_text)
          .toString()
          .replace(/\s*\(.*?\)\s*$/, "")
          .trim()
          .toUpperCase();
        character_id = nameToId.get(name) ?? null;
      }
      return {
        project_id: projectId,
        block_type,
        content: c.raw_text,
        character_id,
        order_index: startOrder + i * ORDER_GAP,
        metadata: { from_import: data.sessionId },
      };
    });

    const CHUNK = 500;
    const insertedRows: any[] = [];
    for (let i = 0; i < blockRows.length; i += CHUNK) {
      const { data: rows, error: bErr } = await supabase
        .from("script_blocks")
        .insert(blockRows.slice(i, i + CHUNK))
        .select("id, block_type, content, order_index, metadata");
      if (bErr) throw new Error(bErr.message);
      insertedRows.push(...(rows ?? []));
    }

    await supabase
      .from("import_sessions")
      .update({ status: "imported" })
      .eq("id", session.id);

    return {
      projectId,
      blockCount: insertedRows.length,
      blocks: insertedRows,
    };
  });
