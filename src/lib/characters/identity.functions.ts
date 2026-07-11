// Pass 1 — Identity/merge server functions.
// Doctrine: docs/CHARACTERS_REBUILD.md, docs/CHARACTERS_PASS1_INVENTORY.md
// Merge/undo run through service_role after project-membership auth checks.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  normalizeName,
  proposeMerges,
  type IdentityInput,
  type MergeProposal,
} from "./identityEngine";

// ---------- Helpers ----------

async function assertProjectMember(supabase: any, projectId: string) {
  const { data, error } = await supabase.rpc("is_project_member", { _project_id: projectId });
  if (error) throw new Error("membership_check_failed");
  if (!data) throw new Error("forbidden");
}

// ---------- proposeCharacterMerges (shadow mode) ----------

export const proposeCharacterMerges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertProjectMember(supabase, data.projectId);

    const [{ data: chars, error: cErr }, { data: mems, error: mErr }] = await Promise.all([
      supabase
        .from("characters")
        .select("id, name")
        .eq("project_id", data.projectId)
        .is("merged_into", null)
        .is("archived_at", null),
      supabase
        .from("project_alias_memory")
        .select("normalized, decision, resolves_to_character_id")
        .eq("project_id", data.projectId)
        .eq("decision", "keep_separate"),
    ]);
    if (cErr) throw new Error(cErr.message);
    if (mErr) throw new Error(mErr.message);

    // Load scene co-occurrence from script_blocks in a single pass.
    const ids = (chars ?? []).map((c: any) => c.id);
    let sceneMap = new Map<string, string[]>();
    if (ids.length) {
      const { data: blocks } = await supabase
        .from("script_blocks")
        .select("character_id, scene_id")
        .in("character_id", ids)
        .not("scene_id", "is", null);
      for (const b of blocks ?? []) {
        if (!b.character_id || !b.scene_id) continue;
        const arr = sceneMap.get(b.character_id) ?? [];
        if (!arr.includes(b.scene_id)) arr.push(b.scene_id);
        sceneMap.set(b.character_id, arr);
      }
    }

    const identities: IdentityInput[] = (chars ?? []).map((c: any) => ({
      id: c.id,
      name: c.name ?? "",
      sceneIds: sceneMap.get(c.id) ?? [],
    }));

    // keep_separate memory is pair-keyed by resolves_to_character_id + a
    // sentinel char stored in normalized. We simplify Pass 1: memory rows
    // with decision=keep_separate scoped to a specific character mean
    // "don't propose THIS character against any other with matching
    // normalized name". Full pair memory ships with the Inbox.
    const keepSeparate = new Set<string>();
    for (const m of mems ?? []) {
      if (!m.resolves_to_character_id) continue;
      for (const other of identities) {
        if (other.id === m.resolves_to_character_id) continue;
        if (normalizeName(other.name).normalized === m.normalized) {
          const key = [m.resolves_to_character_id, other.id].sort().join("|");
          keepSeparate.add(key);
        }
      }
    }

    const proposals: MergeProposal[] = proposeMerges(identities, keepSeparate);
    return { proposals, count: proposals.length };
  });

// ---------- mergeCharacters ----------

const MergeInput = z.object({
  projectId: z.string().uuid(),
  primaryId: z.string().uuid(),
  mergedIds: z.array(z.string().uuid()).min(1).max(20),
  chosenValues: z.record(z.string(), z.any()).default({}),
  survivingName: z.string().min(1),
});

export const mergeCharacters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => MergeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertProjectMember(supabase, data.projectId);

    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;

    // Verify every id belongs to the project. Refuse cross-project merges.
    const allIds = [data.primaryId, ...data.mergedIds];
    const { data: rows, error: rErr } = await supabaseAdmin
      .from("characters")
      .select("*")
      .in("id", allIds);
    if (rErr) throw new Error(rErr.message);
    if (!rows || rows.length !== allIds.length) throw new Error("missing_character");
    for (const r of rows) {
      if (r.project_id !== data.projectId) throw new Error("cross_project_refused");
    }

    const primary = rows.find((r: any) => r.id === data.primaryId)!;
    if (primary.name.trim() !== data.survivingName.trim()) {
      throw new Error("name_confirmation_mismatch");
    }
    const mergedRows = rows.filter((r: any) => r.id !== data.primaryId);

    const results: any[] = [];

    for (const merged of mergedRows) {
      // ---- Snapshot everything we'll rewrite ----
      const snapshot: Record<string, any> = { character: merged };
      const fkTables = [
        "character_arcs",
        "character_evidence_events",
        "character_relationships",
        "character_repair_snapshots",
        "character_scene_arc_states",
        "character_scene_states",
        "character_snapshots",
        "script_blocks",
        "writing_events",
      ];
      for (const t of fkTables) {
        const { data: srcRows } = await supabaseAdmin
          .from(t)
          .select("*")
          .eq("character_id", merged.id);
        snapshot[t] = srcRows ?? [];
      }
      const { data: relBothSides } = await supabaseAdmin
        .from("character_relationships")
        .select("*")
        .eq("related_character_id", merged.id);
      snapshot["character_relationships_related_side"] = relBothSides ?? [];

      // ---- Redirect FK rows ----
      for (const t of fkTables) {
        const { error } = await supabaseAdmin
          .from(t)
          .update({ character_id: data.primaryId })
          .eq("character_id", merged.id);
        if (error) throw new Error(`redirect_${t}_failed: ${error.message}`);
      }
      await supabaseAdmin
        .from("character_relationships")
        .update({ related_character_id: data.primaryId })
        .eq("related_character_id", merged.id);

      // Remove self-relationships created by the redirect.
      await supabaseAdmin
        .from("character_relationships")
        .delete()
        .eq("character_id", data.primaryId)
        .eq("related_character_id", data.primaryId);

      // ---- Rewrite candidate pointers ----
      await supabaseAdmin
        .from("character_candidates")
        .update({ merged_into_character_id: data.primaryId })
        .eq("merged_into_character_id", merged.id);

      // ---- Record alias on primary + memory ----
      const norm = normalizeName(merged.name).normalized;
      if (norm) {
        await supabaseAdmin
          .from("character_aliases")
          .upsert(
            {
              project_id: data.projectId,
              character_id: data.primaryId,
              alias_text: merged.name,
              normalized: norm,
              alias_kind: "manual",
              source: "merge",
            },
            { onConflict: "project_id,character_id,normalized" },
          );
        await supabaseAdmin
          .from("project_alias_memory")
          .upsert(
            {
              project_id: data.projectId,
              normalized: norm,
              resolves_to_character_id: data.primaryId,
              decision: "alias",
              created_by: userId,
            },
            { onConflict: "project_id,normalized,resolves_to_character_id" },
          );
      }

      // ---- Apply chosen scalar values + union speaker_labels ----
      const updates: Record<string, any> = {};
      for (const [k, v] of Object.entries(data.chosenValues)) {
        if (k === "id" || k === "project_id" || k === "created_at") continue;
        updates[k] = v;
      }
      const primaryLabels: string[] = Array.isArray(primary.speaker_labels) ? primary.speaker_labels : [];
      const mergedLabels: string[] = Array.isArray(merged.speaker_labels) ? merged.speaker_labels : [];
      const unionLabels = Array.from(new Set([...primaryLabels, ...mergedLabels, merged.name].filter(Boolean)));
      updates.speaker_labels = unionLabels;
      if (Object.keys(updates).length) {
        await supabaseAdmin.from("characters").update(updates).eq("id", data.primaryId);
      }

      // ---- Archive merged record (soft delete) ----
      await supabaseAdmin
        .from("characters")
        .update({ merged_into: data.primaryId, archived_at: new Date().toISOString() })
        .eq("id", merged.id);

      // ---- Write audit row ----
      const { data: mergeRow, error: mErr } = await supabaseAdmin
        .from("character_merges")
        .insert({
          project_id: data.projectId,
          primary_character_id: data.primaryId,
          merged_character_id: merged.id,
          kind: "merge",
          snapshot,
          chosen_values: data.chosenValues,
          merged_by: userId,
        })
        .select("id")
        .single();
      if (mErr) throw new Error(mErr.message);
      results.push({ mergedId: merged.id, mergeRecordId: mergeRow!.id });
    }

    return { ok: true, results };
  });

// ---------- undoMerge (exact-undo when safe) ----------

export const undoMerge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ mergeId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;

    const { data: merge, error } = await supabaseAdmin
      .from("character_merges")
      .select("*")
      .eq("id", data.mergeId)
      .single();
    if (error || !merge) throw new Error("merge_not_found");
    await assertProjectMember(supabase, merge.project_id);
    if (merge.undone_at) throw new Error("already_undone");

    const snap = merge.snapshot ?? {};

    // Restore the archived character row.
    const charSnap = snap.character;
    if (charSnap) {
      await supabaseAdmin
        .from("characters")
        .update({ merged_into: null, archived_at: null })
        .eq("id", charSnap.id);
    }

    // Redirect FK rows back. Exact-undo only redirects rows that currently
    // point at the primary AND were in the snapshot; rows created after
    // the merge stay on primary (conflict-aware restore lives in Pass 5).
    const fkTables: string[] = [
      "character_arcs",
      "character_evidence_events",
      "character_relationships",
      "character_repair_snapshots",
      "character_scene_arc_states",
      "character_scene_states",
      "character_snapshots",
      "script_blocks",
      "writing_events",
    ];
    for (const t of fkTables) {
      const snapRows: any[] = snap[t] ?? [];
      const ids = snapRows.map((r) => r.id).filter(Boolean);
      if (!ids.length) continue;
      await supabaseAdmin
        .from(t)
        .update({ character_id: charSnap.id })
        .in("id", ids);
    }
    const relRelated: any[] = snap.character_relationships_related_side ?? [];
    if (relRelated.length) {
      await supabaseAdmin
        .from("character_relationships")
        .update({ related_character_id: charSnap.id })
        .in("id", relRelated.map((r) => r.id));
    }

    // Remove alias + memory rows the merge created.
    const mergedName = charSnap?.name;
    if (mergedName) {
      const norm = normalizeName(mergedName).normalized;
      await supabaseAdmin
        .from("character_aliases")
        .delete()
        .eq("project_id", merge.project_id)
        .eq("character_id", merge.primary_character_id)
        .eq("normalized", norm)
        .eq("source", "merge");
      await supabaseAdmin
        .from("project_alias_memory")
        .delete()
        .eq("project_id", merge.project_id)
        .eq("resolves_to_character_id", merge.primary_character_id)
        .eq("normalized", norm)
        .eq("decision", "alias");
    }

    await supabaseAdmin
      .from("character_merges")
      .update({ undone_at: new Date().toISOString() })
      .eq("id", merge.id);

    // Log undo as its own row (so undo-of-undo works).
    await supabaseAdmin.from("character_merges").insert({
      project_id: merge.project_id,
      primary_character_id: merge.primary_character_id,
      merged_character_id: merge.merged_character_id,
      kind: "undo",
      snapshot: {},
      chosen_values: {},
      merged_by: userId,
    });

    return { ok: true };
  });

// ---------- rememberAlias / rememberKeepSeparate / forgetAlias ----------

export const rememberAlias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        characterId: z.string().uuid(),
        aliasText: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertProjectMember(supabase, data.projectId);
    const norm = normalizeName(data.aliasText).normalized;
    if (!norm) throw new Error("empty_alias");
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;
    await supabaseAdmin.from("character_aliases").upsert(
      {
        project_id: data.projectId,
        character_id: data.characterId,
        alias_text: data.aliasText,
        normalized: norm,
        alias_kind: "manual",
        source: "manual",
      },
      { onConflict: "project_id,character_id,normalized" },
    );
    await supabaseAdmin.from("project_alias_memory").upsert(
      {
        project_id: data.projectId,
        normalized: norm,
        resolves_to_character_id: data.characterId,
        decision: "alias",
        created_by: userId,
      },
      { onConflict: "project_id,normalized,resolves_to_character_id" },
    );
    return { ok: true };
  });

export const rememberKeepSeparate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        characterIdA: z.string().uuid(),
        characterIdB: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertProjectMember(supabase, data.projectId);
    const { supabaseAdmin: _sa } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _sa as any;
    const { data: chars } = await supabaseAdmin
      .from("characters")
      .select("id, project_id, name")
      .in("id", [data.characterIdA, data.characterIdB]);
    if (!chars || chars.length !== 2) throw new Error("missing_character");
    for (const c of chars) {
      if (c.project_id !== data.projectId) throw new Error("cross_project_refused");
    }
    for (const c of chars) {
      const other = chars.find((o) => o.id !== c.id)!;
      await supabaseAdmin.from("project_alias_memory").upsert(
        {
          project_id: data.projectId,
          normalized: normalizeName(other.name).normalized,
          resolves_to_character_id: c.id,
          decision: "keep_separate",
          created_by: userId,
        },
        { onConflict: "project_id,normalized,resolves_to_character_id" },
      );
    }
    return { ok: true };
  });

export const forgetAlias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ aliasMemoryId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("project_alias_memory")
      .select("project_id")
      .eq("id", data.aliasMemoryId)
      .single();
    if (!row) throw new Error("not_found");
    await assertProjectMember(supabase, row.project_id);
    const { error } = await supabase
      .from("project_alias_memory")
      .delete()
      .eq("id", data.aliasMemoryId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
