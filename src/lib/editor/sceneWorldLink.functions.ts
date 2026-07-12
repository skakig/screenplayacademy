/**
 * Phase 4.3 — Scene → world_locations auto-linking.
 *
 * For every scene in a project that has a `location` string, ensure:
 *   1. A `world_locations` row exists in the project's default universe.
 *   2. A `world_entities` row (kind='location') mirrors it.
 *   3. A `world_entity_links` row bridges entity → world_locations.
 *   4. A `project_world_usage` row exists (scene_id, entity_id, usage_kind='setting').
 *
 * Idempotent: safe to run after every manuscript sync.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { normalizeWorldKey } from "@/lib/world/worldGraph";

const Input = z.object({ projectId: z.string().uuid() });

export type SceneWorldLinkResult = {
  universeId: string | null;
  locationsEnsured: number;
  usageLinked: number;
  usageUnlinked: number;
  scenesConsidered: number;
  skipped: number;
};

export type AutoLinkTrigger =
  | "manual"
  | "manuscript_sync"
  | "scene_edit"
  | "unknown";

export type AutoLinkAudit = {
  trigger?: AutoLinkTrigger;
  userId?: string | null;
  actorLabel?: string | null;
};

/**
 * Shared helper — safe to call from any server-side handler that already has
 * an RLS-scoped supabase client. Callers control auth; this function performs
 * no additional access checks beyond what RLS enforces.
 */
export async function linkSceneLocationsForProject(
  supabase: any,
  projectId: string,
  audit: AutoLinkAudit = {},
): Promise<SceneWorldLinkResult> {
  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select("id, default_universe_id")
    .eq("id", projectId)
    .maybeSingle();
  if (projErr) throw projErr;
  if (!project) throw new Error("Project not found");

  const universeId: string | null = project.default_universe_id ?? null;
  if (!universeId) {
    const empty: SceneWorldLinkResult = {
      universeId: null,
      locationsEnsured: 0,
      usageLinked: 0,
      usageUnlinked: 0,
      scenesConsidered: 0,
      skipped: 0,
    };
    await recordAutoLinkRun(supabase, projectId, empty, audit);
    return empty;
  }


  const { data: scenes, error: sceneErr } = await supabase
    .from("scenes")
    .select("id, location")
    .eq("project_id", projectId);
  if (sceneErr) throw sceneErr;

  const rows = (scenes ?? []).filter(
    (s: any) => typeof s.location === "string" && s.location.trim().length > 0,
  );

  const buckets = new Map<string, { name: string; sceneIds: string[] }>();
  for (const s of rows as any[]) {
    const name = String(s.location).trim();
    const key = normalizeWorldKey(name);
    if (!key) continue;
    const bucket = buckets.get(key) ?? { name, sceneIds: [] };
    bucket.sceneIds.push(s.id);
    buckets.set(key, bucket);
  }

  let locationsEnsured = 0;
  let usageLinked = 0;
  let usageUnlinked = 0;
  let skipped = 0;

  // Desired state: which entityIds each scene should currently be linked to.
  const desiredBySceneId = new Map<string, Set<string>>();
  for (const s of (scenes ?? []) as any[]) {
    desiredBySceneId.set(s.id, new Set());
  }

  for (const [key, { name, sceneIds }] of buckets.entries()) {
    // world_locations row
    let locationId: string | null = null;
    {
      const { data: existing } = await supabase
        .from("world_locations")
        .select("id")
        .eq("universe_id", universeId)
        .eq("normalized_key", key)
        .maybeSingle();
      if (existing?.id) {
        locationId = existing.id;
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from("world_locations")
          .insert({
            universe_id: universeId,
            name,
            normalized_key: key,
            metadata: { source: "scene_heading_autolink" },
          })
          .select("id")
          .single();
        if (insErr || !inserted) {
          skipped += sceneIds.length;
          continue;
        }
        locationId = inserted.id;
        locationsEnsured += 1;
      }
    }

    // world_entities row + link
    let entityId: string | null = null;
    {
      const { data: link } = await supabase
        .from("world_entity_links")
        .select("entity_id")
        .eq("target_table", "world_locations")
        .eq("target_id", locationId)
        .maybeSingle();
      if (link?.entity_id) {
        entityId = link.entity_id;
      } else {
        const { data: existingEntity } = await supabase
          .from("world_entities")
          .select("id")
          .eq("universe_id", universeId)
          .eq("entity_kind", "location")
          .eq("normalized_key", key)
          .maybeSingle();
        if (existingEntity?.id) {
          entityId = existingEntity.id;
        } else {
          const { data: newEntity, error: entErr } = await supabase
            .from("world_entities")
            .insert({
              universe_id: universeId,
              entity_kind: "location",
              name,
              normalized_key: key,
              source: "manual",
              metadata: { source: "scene_heading_autolink" },
            })
            .select("id")
            .single();
          if (entErr || !newEntity) {
            skipped += sceneIds.length;
            continue;
          }
          entityId = newEntity.id;
        }
        await supabase.from("world_entity_links").upsert(
          {
            entity_id: entityId,
            target_table: "world_locations",
            target_id: locationId,
          },
          { onConflict: "entity_id" },
        );
      }
    }

    // project_world_usage per scene — idempotent upsert.
    for (const sceneId of sceneIds) {
      desiredBySceneId.get(sceneId)?.add(entityId!);
      const { error: usageErr } = await supabase
        .from("project_world_usage")
        .upsert(
          {
            project_id: projectId,
            entity_id: entityId,
            scene_id: sceneId,
            script_block_id: null,
            usage_kind: "setting",
            metadata: { source: "scene_heading_autolink" },
          },
          {
            onConflict:
              "project_id,entity_id,scene_id,script_block_id,usage_kind",
            ignoreDuplicates: false,
          },
        );
      if (usageErr) skipped += 1;
      else usageLinked += 1;
    }
  }

  // Prune stale auto-links: any autolinked "setting" usage on a scene whose
  // current heading no longer resolves to that entity. Only touches rows we
  // created ourselves (metadata.source='scene_heading_autolink'), so manual
  // links added via the UI are preserved.
  const sceneIdsAll = Array.from(desiredBySceneId.keys());
  if (sceneIdsAll.length > 0) {
    const { data: existingUsage, error: exErr } = await supabase
      .from("project_world_usage")
      .select("id, scene_id, entity_id, metadata, usage_kind, script_block_id")
      .eq("project_id", projectId)
      .eq("usage_kind", "setting")
      .is("script_block_id", null)
      .in("scene_id", sceneIdsAll);
    if (!exErr && existingUsage) {
      const staleIds: string[] = [];
      for (const row of existingUsage as any[]) {
        const source = row?.metadata?.source;
        if (source !== "scene_heading_autolink") continue;
        const desired = desiredBySceneId.get(row.scene_id);
        if (!desired || !desired.has(row.entity_id)) {
          staleIds.push(row.id);
        }
      }
      if (staleIds.length > 0) {
        const { error: delErr, count } = await supabase
          .from("project_world_usage")
          .delete({ count: "exact" })
          .in("id", staleIds);
        if (!delErr) usageUnlinked += count ?? staleIds.length;
      }
    }
  }

  const result: SceneWorldLinkResult = {
    universeId,
    locationsEnsured,
    usageLinked,
    usageUnlinked,
    scenesConsidered: rows.length,
    skipped,
  };
  await recordAutoLinkRun(supabase, projectId, result, audit);
  return result;
}

async function recordAutoLinkRun(
  supabase: any,
  projectId: string,
  result: SceneWorldLinkResult,
  audit: AutoLinkAudit,
): Promise<void> {
  try {
    await supabase.from("scene_autolink_runs").insert({
      project_id: projectId,
      universe_id: result.universeId,
      user_id: audit.userId ?? null,
      actor_label: audit.actorLabel ?? null,
      trigger: audit.trigger ?? "unknown",
      locations_ensured: result.locationsEnsured,
      usage_linked: result.usageLinked,
      usage_unlinked: result.usageUnlinked,
      scenes_considered: result.scenesConsidered,
      skipped: result.skipped,
    });
  } catch (err) {
    console.error("[sceneWorldLink] failed to record run", err);
  }
}

export const autoLinkSceneLocations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        trigger: z
          .enum(["manual", "manuscript_sync", "scene_edit", "unknown"])
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<SceneWorldLinkResult> => {
    return linkSceneLocationsForProject(context.supabase, data.projectId, {
      trigger: data.trigger ?? "manual",
      userId: context.userId,
      actorLabel:
        (context.claims as any)?.email ?? (context.claims as any)?.sub ?? null,
    });
  });

export type AutoLinkRunRow = {
  id: string;
  project_id: string;
  universe_id: string | null;
  user_id: string | null;
  actor_label: string | null;
  trigger: string;
  locations_ensured: number;
  usage_linked: number;
  usage_unlinked: number;
  scenes_considered: number;
  skipped: number;
  created_at: string;
};

export const listSceneAutolinkRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<AutoLinkRunRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("scene_autolink_runs")
      .select(
        "id, project_id, universe_id, user_id, actor_label, trigger, locations_ensured, usage_linked, usage_unlinked, scenes_considered, skipped, created_at",
      )
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 25);
    if (error) throw error;
    return (rows ?? []) as AutoLinkRunRow[];
  });

