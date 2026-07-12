/**
 * World Graph — shared types, enums, and safe helpers.
 *
 * Pure module (no server-only imports) so both client UI and server
 * functions can import the constants and type contracts.
 */

export const WORLD_ENTITY_KINDS = [
  "location",
  "faction",
  "artifact",
  "rule",
  "event",
  "thread",
  "timeline_entry",
  "character",
  "custom",
] as const;
export type WorldEntityKind = (typeof WORLD_ENTITY_KINDS)[number];

export const WORLD_ENTITY_SOURCES = ["manual", "imported"] as const;
export type WorldEntitySource = (typeof WORLD_ENTITY_SOURCES)[number];

export const WORLD_LINK_TABLES = [
  "world_locations",
  "world_factions",
  "world_artifacts",
  "world_rules",
  "world_events",
  "world_threads",
  "world_timeline_entries",
  "characters",
] as const;
export type WorldLinkTable = (typeof WORLD_LINK_TABLES)[number];

export const WORLD_RELATIONSHIP_TYPES = [
  "located_in",
  "member_of",
  "ally_of",
  "enemy_of",
  "owns",
  "occurred_at",
  "references",
  "related_to",
  "parent_of",
  "child_of",
  "custom",
] as const;
export type WorldRelationshipType = (typeof WORLD_RELATIONSHIP_TYPES)[number];

export const PROJECT_WORLD_USAGE_KINDS = [
  "setting",
  "mention",
  "appearance",
  "reference",
] as const;
export type ProjectWorldUsageKind = (typeof PROJECT_WORLD_USAGE_KINDS)[number];

export interface WorldEntity {
  id: string;
  universe_id: string;
  entity_kind: WorldEntityKind;
  name: string;
  normalized_key: string;
  summary: string | null;
  source: WorldEntitySource;
  candidate_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface WorldEntityLink {
  id: string;
  entity_id: string;
  target_table: WorldLinkTable;
  target_id: string;
  created_at: string;
}

export interface WorldEntityRelationship {
  id: string;
  universe_id: string;
  from_entity_id: string;
  to_entity_id: string;
  relationship_type: WorldRelationshipType;
  notes: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ProjectWorldUsage {
  id: string;
  project_id: string;
  entity_id: string;
  scene_id: string | null;
  script_block_id: string | null;
  usage_kind: ProjectWorldUsageKind;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface WorldEntityDetail {
  entity: WorldEntity;
  link: WorldEntityLink | null;
  outgoing: Array<
    WorldEntityRelationship & {
      other: Pick<WorldEntity, "id" | "name" | "entity_kind"> | null;
    }
  >;
  incoming: Array<
    WorldEntityRelationship & {
      other: Pick<WorldEntity, "id" | "name" | "entity_kind"> | null;
    }
  >;
}

/**
 * Canonical, deterministic normalization for entity keys.
 * Lowercase, strip diacritics, collapse punctuation/whitespace.
 */
export interface SceneWorldEntityContext {
  usage: ProjectWorldUsage;
  entity: WorldEntity;
  link: WorldEntityLink | null;
  outgoing: Array<
    WorldEntityRelationship & {
      other: Pick<WorldEntity, "id" | "name" | "entity_kind"> | null;
    }
  >;
  incoming: Array<
    WorldEntityRelationship & {
      other: Pick<WorldEntity, "id" | "name" | "entity_kind"> | null;
    }
  >;
}

export interface SceneWorldContext {
  sceneId: string;
  projectId: string;
  entities: SceneWorldEntityContext[];
}

export function normalizeWorldKey(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
