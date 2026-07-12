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

/**
 * Shared helper — safe to call from any server-side handler that already has
 * an RLS-scoped supabase client. Callers control auth; this function performs
 * no additional access checks beyond what RLS enforces.
 */
export async function linkSceneLocationsForProject(
  supabase: any,
  projectId: string,
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
    return {
      universeId: null,
      locationsEnsured: 0,
      usageLinked: 0,
      usageUnlinked: 0,
      scenesConsidered: 0,
      skipped: 0,
    };
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
  let skipped = 0;

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

    // project_world_usage per scene
    for (const sceneId of sceneIds) {
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

  return {
    universeId,
    locationsEnsured,
    usageLinked,
    scenesConsidered: rows.length,
    skipped,
  };
}

export const autoLinkSceneLocations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<SceneWorldLinkResult> => {
    return linkSceneLocationsForProject(context.supabase, data.projectId);
  });
