/**
 * World Usage Report — aggregates per-entity scene usage + relationship edges
 * for the current project. Powers the "World Usage" pitch-kit page and any
 * in-app right-panel summary. All access is RLS-gated (project membership on
 * usage, universe ownership on entities/relationships).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type {
  WorldEntity,
  WorldEntityRelationship,
  ProjectWorldUsageKind,
} from "./worldGraph";

const Input = z.object({ projectId: z.string().uuid() });

export interface WorldUsageSceneRef {
  sceneId: string;
  title: string | null;
  sceneHeading: string | null;
  sequence: number | null;
  usageKind: ProjectWorldUsageKind;
  scriptBlockId: string | null;
  source: string | null;
}

export interface WorldUsageEdge {
  id: string;
  relationshipType: WorldEntityRelationship["relationship_type"];
  notes: string | null;
  other: Pick<WorldEntity, "id" | "name" | "entity_kind"> | null;
  direction: "outgoing" | "incoming";
}

export interface WorldUsageEntityReport {
  entity: Pick<
    WorldEntity,
    "id" | "name" | "entity_kind" | "summary" | "universe_id"
  >;
  scenes: WorldUsageSceneRef[];
  edges: WorldUsageEdge[];
}

export interface WorldUsageReport {
  projectId: string;
  universeId: string | null;
  generatedAt: string;
  totals: {
    entities: number;
    scenes: number;
    edges: number;
  };
  entities: WorldUsageEntityReport[];
}

export const getWorldUsageReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<WorldUsageReport> => {
    const { supabase } = context;

    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("id, default_universe_id")
      .eq("id", data.projectId)
      .maybeSingle();
    if (projErr) throw projErr;
    if (!project) throw new Error("Project not found");
    const universeId: string | null =
      (project as any).default_universe_id ?? null;

    const { data: usageRows, error: usageErr } = await supabase
      .from("project_world_usage")
      .select(
        "id, entity_id, scene_id, script_block_id, usage_kind, metadata, created_at",
      )
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: true });
    if (usageErr) throw usageErr;

    const usage = (usageRows ?? []) as any[];
    const entityIds = Array.from(new Set(usage.map((u) => u.entity_id)));
    if (entityIds.length === 0) {
      return {
        projectId: data.projectId,
        universeId,
        generatedAt: new Date().toISOString(),
        totals: { entities: 0, scenes: 0, edges: 0 },
        entities: [],
      };
    }

    const sceneIds = Array.from(
      new Set(usage.map((u) => u.scene_id).filter((v): v is string => !!v)),
    );

    const [entitiesQ, scenesQ, outQ, inQ] = await Promise.all([
      supabase
        .from("world_entities")
        .select("id, name, entity_kind, summary, universe_id")
        .in("id", entityIds),
      sceneIds.length > 0
        ? supabase
            .from("scenes")
            .select("id, title, scene_heading, sequence, location")
            .in("id", sceneIds)
        : Promise.resolve({ data: [], error: null } as any),
      supabase
        .from("world_entity_relationships")
        .select("*")
        .in("from_entity_id", entityIds),
      supabase
        .from("world_entity_relationships")
        .select("*")
        .in("to_entity_id", entityIds),
    ]);
    if ((entitiesQ as any).error) throw (entitiesQ as any).error;
    if ((scenesQ as any).error) throw (scenesQ as any).error;
    if ((outQ as any).error) throw (outQ as any).error;
    if ((inQ as any).error) throw (inQ as any).error;

    const entities = ((entitiesQ as any).data ?? []) as Array<
      Pick<WorldEntity, "id" | "name" | "entity_kind" | "summary" | "universe_id">
    >;
    const scenesById = new Map(
      (((scenesQ as any).data ?? []) as any[]).map((s) => [s.id, s]),
    );
    const outRows = (((outQ as any).data ?? []) as WorldEntityRelationship[]);
    const inRows = (((inQ as any).data ?? []) as WorldEntityRelationship[]);

    // Resolve neighbor entities not already in our set.
    const neighborIds = Array.from(
      new Set(
        [
          ...outRows.map((r) => r.to_entity_id),
          ...inRows.map((r) => r.from_entity_id),
        ].filter((id) => !entityIds.includes(id)),
      ),
    );
    let neighbors: Array<Pick<WorldEntity, "id" | "name" | "entity_kind">> =
      entities.map((e) => ({ id: e.id, name: e.name, entity_kind: e.entity_kind }));
    if (neighborIds.length > 0) {
      const { data: n, error: nErr } = await supabase
        .from("world_entities")
        .select("id, name, entity_kind")
        .in("id", neighborIds);
      if (nErr) throw nErr;
      neighbors = [...neighbors, ...((n ?? []) as any)];
    }
    const neighborById = new Map(neighbors.map((n) => [n.id, n]));

    const perEntity: WorldUsageEntityReport[] = entities
      .map((entity) => {
        const scenes: WorldUsageSceneRef[] = usage
          .filter((u) => u.entity_id === entity.id && u.scene_id)
          .map((u) => {
            const s = scenesById.get(u.scene_id!);
            return {
              sceneId: u.scene_id as string,
              title: s?.title ?? null,
              sceneHeading: s?.scene_heading ?? null,
              sequence: (s?.sequence ?? null) as number | null,
              usageKind: u.usage_kind as ProjectWorldUsageKind,
              scriptBlockId: u.script_block_id ?? null,
              source: (u.metadata as any)?.source ?? null,
            };
          })
          .sort(
            (a, b) =>
              (a.sequence ?? Number.MAX_SAFE_INTEGER) -
              (b.sequence ?? Number.MAX_SAFE_INTEGER),
          );

        const outgoing: WorldUsageEdge[] = outRows
          .filter((r) => r.from_entity_id === entity.id)
          .map((r) => ({
            id: r.id,
            relationshipType: r.relationship_type,
            notes: r.notes,
            other: neighborById.get(r.to_entity_id) ?? null,
            direction: "outgoing" as const,
          }));
        const incoming: WorldUsageEdge[] = inRows
          .filter((r) => r.to_entity_id === entity.id)
          .map((r) => ({
            id: r.id,
            relationshipType: r.relationship_type,
            notes: r.notes,
            other: neighborById.get(r.from_entity_id) ?? null,
            direction: "incoming" as const,
          }));

        return { entity, scenes, edges: [...outgoing, ...incoming] };
      })
      .sort((a, b) => {
        // Entities with more scenes first, then alphabetical.
        if (b.scenes.length !== a.scenes.length)
          return b.scenes.length - a.scenes.length;
        return a.entity.name.localeCompare(b.entity.name);
      });

    return {
      projectId: data.projectId,
      universeId,
      generatedAt: new Date().toISOString(),
      totals: {
        entities: perEntity.length,
        scenes: new Set(
          perEntity.flatMap((e) => e.scenes.map((s) => s.sceneId)),
        ).size,
        edges: perEntity.reduce((acc, e) => acc + e.edges.length, 0),
      },
      entities: perEntity,
    };
  });
