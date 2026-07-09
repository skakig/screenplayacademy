import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { VaultSceneInput, VaultSceneUpdate, type VaultSceneRow } from "./schemas";

const ProjectId = z.object({ projectId: z.string().uuid() });
const Id = z.object({ id: z.string().uuid() });

export const listVaultScenes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProjectId.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("vault_scenes")
      .select("*")
      .eq("project_id", data.projectId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as VaultSceneRow[];
  });

export const getVaultScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("vault_scenes")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row as VaultSceneRow | null;
  });

export const createVaultScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => VaultSceneInput.parse(d))
  .handler(async ({ data, context }) => {
    const row = {
      project_id: data.projectId,
      kind: data.kind,
      title: data.title,
      content: data.content,
      notes: data.notes,
      location: data.location ?? null,
      emotional_tone: data.emotionalTone ?? null,
      estimated_position: data.estimatedPosition,
      tags: data.tags,
      status: data.status,
      linked_character_ids: data.linkedCharacterIds,
      alternate_of: data.alternateOf ?? null,
      created_by: context.userId,
    };
    const { data: inserted, error } = await context.supabase
      .from("vault_scenes")
      .insert(row)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return inserted as VaultSceneRow;
  });

export const updateVaultScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => VaultSceneUpdate.parse(d))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.kind !== undefined) patch.kind = data.kind;
    if (data.title !== undefined) patch.title = data.title;
    if (data.content !== undefined) patch.content = data.content;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.location !== undefined) patch.location = data.location;
    if (data.emotionalTone !== undefined) patch.emotional_tone = data.emotionalTone;
    if (data.estimatedPosition !== undefined) patch.estimated_position = data.estimatedPosition;
    if (data.tags !== undefined) patch.tags = data.tags;
    if (data.status !== undefined) patch.status = data.status;
    if (data.linkedCharacterIds !== undefined) patch.linked_character_ids = data.linkedCharacterIds;
    if (data.alternateOf !== undefined) patch.alternate_of = data.alternateOf;

    const { data: updated, error } = await context.supabase
      .from("vault_scenes")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return updated as VaultSceneRow;
  });

export const archiveVaultScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("vault_scenes")
      .update({ archived_at: new Date().toISOString(), status: "deleted" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteVaultScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("vault_scenes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateAsAlternate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const { data: src, error: e1 } = await context.supabase
      .from("vault_scenes")
      .select("*")
      .eq("id", data.id)
      .single();
    if (e1 || !src) throw new Error(e1?.message ?? "Not found");
    const s = src as VaultSceneRow;
    const { data: inserted, error } = await context.supabase
      .from("vault_scenes")
      .insert({
        project_id: s.project_id,
        kind: "alternate_take",
        title: `${s.title} — Alt Take`,
        content: s.content,
        notes: s.notes,
        location: s.location,
        emotional_tone: s.emotional_tone,
        estimated_position: s.estimated_position,
        tags: s.tags,
        status: "alternate",
        linked_character_ids: s.linked_character_ids,
        alternate_of: s.id,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return inserted as VaultSceneRow;
  });
