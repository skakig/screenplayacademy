/**
 * Phase 4.2 — World Graph server functions.
 *
 * Typed read + CRUD over `world_entities`, `world_entity_links`,
 * `world_entity_relationships`, and `project_world_usage`. All access is
 * gated by RLS (universe owner for graph tables; project member for usage).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  WORLD_ENTITY_KINDS,
  WORLD_ENTITY_SOURCES,
  WORLD_LINK_TABLES,
  WORLD_RELATIONSHIP_TYPES,
  PROJECT_WORLD_USAGE_KINDS,
  normalizeWorldKey,
  type WorldEntity,
  type WorldEntityDetail,
  type WorldEntityLink,
  type WorldEntityRelationship,
  type ProjectWorldUsage,
} from "./worldGraph";

const kindEnum = z.enum(WORLD_ENTITY_KINDS);
const sourceEnum = z.enum(WORLD_ENTITY_SOURCES);
const linkTableEnum = z.enum(WORLD_LINK_TABLES);
const relTypeEnum = z.enum(WORLD_RELATIONSHIP_TYPES);
const usageKindEnum = z.enum(PROJECT_WORLD_USAGE_KINDS);

// ---------- Read: list entities ----------
const ListEntitiesInput = z.object({
  universeId: z.string().uuid(),
  kind: kindEnum.optional(),
  source: sourceEnum.optional(),
  search: z.string().trim().max(120).optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export const listWorldEntities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ListEntitiesInput.parse(input))
  .handler(async ({ data, context }): Promise<WorldEntity[]> => {
    let q = context.supabase
      .from("world_entities")
      .select("*")
      .eq("universe_id", data.universeId)
      .order("name", { ascending: true })
      .limit(data.limit ?? 200);
    if (data.kind) q = q.eq("entity_kind", data.kind);
    if (data.source) q = q.eq("source", data.source);
    if (data.search) q = q.ilike("name", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw error;
    return (rows ?? []) as unknown as WorldEntity[];
  });

// ---------- Read: entity detail with neighbors ----------
const GetEntityInput = z.object({ id: z.string().uuid() });

export const getWorldEntity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => GetEntityInput.parse(input))
  .handler(async ({ data, context }): Promise<WorldEntityDetail | null> => {
    const { supabase } = context;
    const [entityQ, linkQ, outQ, inQ] = await Promise.all([
      supabase.from("world_entities").select("*").eq("id", data.id).maybeSingle(),
      supabase.from("world_entity_links").select("*").eq("entity_id", data.id).maybeSingle(),
      supabase
        .from("world_entity_relationships")
        .select("*")
        .eq("from_entity_id", data.id),
      supabase
        .from("world_entity_relationships")
        .select("*")
        .eq("to_entity_id", data.id),
    ]);
    if (entityQ.error) throw entityQ.error;
    if (!entityQ.data) return null;
    if (linkQ.error) throw linkQ.error;
    if (outQ.error) throw outQ.error;
    if (inQ.error) throw inQ.error;

    const outRows = (outQ.data ?? []) as WorldEntityRelationship[];
    const inRows = (inQ.data ?? []) as WorldEntityRelationship[];
    const otherIds = Array.from(
      new Set([
        ...outRows.map((r) => r.to_entity_id),
        ...inRows.map((r) => r.from_entity_id),
      ]),
    );
    let others: Array<Pick<WorldEntity, "id" | "name" | "entity_kind">> = [];
    if (otherIds.length) {
      const { data: o, error: oe } = await supabase
        .from("world_entities")
        .select("id, name, entity_kind")
        .in("id", otherIds);
      if (oe) throw oe;
      others = (o ?? []) as any;
    }
    const otherById = new Map(others.map((o) => [o.id, o]));
    return {
      entity: entityQ.data as unknown as WorldEntity,
      link: (linkQ.data ?? null) as unknown as WorldEntityLink | null,
      outgoing: outRows.map((r) => ({ ...r, other: otherById.get(r.to_entity_id) ?? null })),
      incoming: inRows.map((r) => ({ ...r, other: otherById.get(r.from_entity_id) ?? null })),
    };
  });

// ---------- Write: entity CRUD ----------
const CreateEntityInput = z.object({
  universeId: z.string().uuid(),
  entityKind: kindEnum,
  name: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(4000).optional(),
  normalizedKey: z.string().trim().min(1).max(120).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const createWorldEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateEntityInput.parse(input))
  .handler(async ({ data, context }): Promise<WorldEntity> => {
    const normalized_key = data.normalizedKey ?? normalizeWorldKey(data.name);
    const { data: row, error } = await context.supabase
      .from("world_entities")
      .insert({
        universe_id: data.universeId,
        entity_kind: data.entityKind,
        name: data.name,
        normalized_key,
        summary: data.summary ?? null,
        source: "manual",
        metadata: data.metadata ?? {},
      })
      .select("*")
      .single();
    if (error) throw error;
    return row as unknown as WorldEntity;
  });

const UpdateEntityInput = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  summary: z.string().trim().max(4000).nullable().optional(),
  normalizedKey: z.string().trim().min(1).max(120).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const updateWorldEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpdateEntityInput.parse(input))
  .handler(async ({ data, context }): Promise<WorldEntity> => {
    const patch: Record<string, any> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.summary !== undefined) patch.summary = data.summary;
    if (data.normalizedKey !== undefined) patch.normalized_key = data.normalizedKey;
    if (data.metadata !== undefined) patch.metadata = data.metadata;
    const { data: row, error } = await context.supabase
      .from("world_entities")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return row as unknown as WorldEntity;
  });

const DeleteEntityInput = z.object({ id: z.string().uuid() });

export const deleteWorldEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DeleteEntityInput.parse(input))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { error } = await context.supabase
      .from("world_entities")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { id: data.id };
  });

// ---------- Read: relationships ----------
const ListRelInput = z.object({
  universeId: z.string().uuid(),
  entityId: z.string().uuid().optional(),
  type: relTypeEnum.optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export const listWorldRelationships = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ListRelInput.parse(input))
  .handler(async ({ data, context }): Promise<WorldEntityRelationship[]> => {
    let q = context.supabase
      .from("world_entity_relationships")
      .select("*")
      .eq("universe_id", data.universeId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.type) q = q.eq("relationship_type", data.type);
    if (data.entityId) {
      q = q.or(`from_entity_id.eq.${data.entityId},to_entity_id.eq.${data.entityId}`);
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    return (rows ?? []) as unknown as WorldEntityRelationship[];
  });

// ---------- Write: relationship CRUD ----------
const CreateRelInput = z.object({
  universeId: z.string().uuid(),
  fromEntityId: z.string().uuid(),
  toEntityId: z.string().uuid(),
  relationshipType: relTypeEnum,
  notes: z.string().trim().max(2000).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const createWorldRelationship = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateRelInput.parse(input))
  .handler(async ({ data, context }): Promise<WorldEntityRelationship> => {
    if (data.fromEntityId === data.toEntityId) {
      throw new Error("Relationship endpoints must differ");
    }
    const { data: row, error } = await context.supabase
      .from("world_entity_relationships")
      .insert({
        universe_id: data.universeId,
        from_entity_id: data.fromEntityId,
        to_entity_id: data.toEntityId,
        relationship_type: data.relationshipType,
        notes: data.notes ?? null,
        metadata: data.metadata ?? {},
      })
      .select("*")
      .single();
    if (error) throw error;
    return row as unknown as WorldEntityRelationship;
  });

const UpdateRelInput = z.object({
  id: z.string().uuid(),
  notes: z.string().trim().max(2000).nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  relationshipType: relTypeEnum.optional(),
});

export const updateWorldRelationship = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpdateRelInput.parse(input))
  .handler(async ({ data, context }): Promise<WorldEntityRelationship> => {
    const patch: Record<string, any> = {};
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.metadata !== undefined) patch.metadata = data.metadata;
    if (data.relationshipType !== undefined)
      patch.relationship_type = data.relationshipType;
    const { data: row, error } = await context.supabase
      .from("world_entity_relationships")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return row as unknown as WorldEntityRelationship;
  });

const DeleteRelInput = z.object({ id: z.string().uuid() });

export const deleteWorldRelationship = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DeleteRelInput.parse(input))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { error } = await context.supabase
      .from("world_entity_relationships")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { id: data.id };
  });

// ---------- Project world usage ----------
const ListUsageInput = z.object({
  projectId: z.string().uuid(),
  entityId: z.string().uuid().optional(),
  sceneId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export const listProjectWorldUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ListUsageInput.parse(input))
  .handler(async ({ data, context }): Promise<ProjectWorldUsage[]> => {
    let q = context.supabase
      .from("project_world_usage")
      .select("*")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.entityId) q = q.eq("entity_id", data.entityId);
    if (data.sceneId) q = q.eq("scene_id", data.sceneId);
    const { data: rows, error } = await q;
    if (error) throw error;
    return (rows ?? []) as unknown as ProjectWorldUsage[];
  });

const LinkUsageInput = z.object({
  projectId: z.string().uuid(),
  entityId: z.string().uuid(),
  sceneId: z.string().uuid().nullable().optional(),
  scriptBlockId: z.string().uuid().nullable().optional(),
  usageKind: usageKindEnum.optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const linkProjectWorldUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => LinkUsageInput.parse(input))
  .handler(async ({ data, context }): Promise<ProjectWorldUsage> => {
    const payload = {
      project_id: data.projectId,
      entity_id: data.entityId,
      scene_id: data.sceneId ?? null,
      script_block_id: data.scriptBlockId ?? null,
      usage_kind: data.usageKind ?? "reference",
      metadata: data.metadata ?? {},
    };
    // Idempotent — the composite unique index dedupes concurrent links.
    const { data: row, error } = await context.supabase
      .from("project_world_usage")
      .upsert(payload, {
        onConflict: "project_id,entity_id,scene_id,script_block_id,usage_kind",
        ignoreDuplicates: false,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row as unknown as ProjectWorldUsage;
  });

const UnlinkUsageInput = z.object({ id: z.string().uuid() });

export const unlinkProjectWorldUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UnlinkUsageInput.parse(input))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { error } = await context.supabase
      .from("project_world_usage")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { id: data.id };
  });

// ---------- Entity ↔ specialized-row link CRUD ----------
const SetLinkInput = z.object({
  entityId: z.string().uuid(),
  targetTable: linkTableEnum,
  targetId: z.string().uuid(),
});

export const setWorldEntityLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SetLinkInput.parse(input))
  .handler(async ({ data, context }): Promise<WorldEntityLink> => {
    const { data: row, error } = await context.supabase
      .from("world_entity_links")
      .upsert(
        {
          entity_id: data.entityId,
          target_table: data.targetTable,
          target_id: data.targetId,
        },
        { onConflict: "entity_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return row as unknown as WorldEntityLink;
  });

const ClearLinkInput = z.object({ entityId: z.string().uuid() });

export const clearWorldEntityLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ClearLinkInput.parse(input))
  .handler(async ({ data, context }): Promise<{ entityId: string }> => {
    const { error } = await context.supabase
      .from("world_entity_links")
      .delete()
      .eq("entity_id", data.entityId);
    if (error) throw error;
    return { entityId: data.entityId };
  });
