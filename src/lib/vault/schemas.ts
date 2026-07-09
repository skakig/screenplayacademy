import { z } from "zod";

export const VAULT_KINDS = ["vault_scene", "dialogue_fragment", "set_piece", "alternate_take"] as const;
export const VAULT_STATUSES = [
  "vaulted",
  "candidate",
  "integrated",
  "alternate",
  "needs_rewrite",
  "locked",
  "deleted",
] as const;
export const VAULT_POSITIONS = ["act_1", "act_2a", "midpoint", "act_2b", "act_3", "unsure"] as const;

export type VaultKind = (typeof VAULT_KINDS)[number];
export type VaultStatus = (typeof VAULT_STATUSES)[number];
export type VaultPosition = (typeof VAULT_POSITIONS)[number];

export const VaultSceneInput = z.object({
  projectId: z.string().uuid(),
  kind: z.enum(VAULT_KINDS).default("vault_scene"),
  title: z.string().min(1).max(200).default("Untitled"),
  content: z.string().max(50_000).default(""),
  notes: z.string().max(10_000).default(""),
  location: z.string().max(200).optional().nullable(),
  emotionalTone: z.string().max(120).optional().nullable(),
  estimatedPosition: z.enum(VAULT_POSITIONS).default("unsure"),
  tags: z.array(z.string().max(40)).max(30).default([]),
  status: z.enum(VAULT_STATUSES).default("vaulted"),
  linkedCharacterIds: z.array(z.string().uuid()).max(50).default([]),
  alternateOf: z.string().uuid().optional().nullable(),
});
export type VaultSceneInputT = z.infer<typeof VaultSceneInput>;

export const VaultSceneUpdate = VaultSceneInput.partial().extend({
  id: z.string().uuid(),
});

export type VaultSceneRow = {
  id: string;
  project_id: string;
  kind: VaultKind;
  title: string;
  content: string;
  notes: string;
  location: string | null;
  emotional_tone: string | null;
  estimated_position: VaultPosition;
  tags: string[];
  status: VaultStatus;
  linked_scene_id: string | null;
  linked_character_ids: string[];
  alternate_of: string | null;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const KIND_LABEL: Record<VaultKind, string> = {
  vault_scene: "Vault Scene",
  dialogue_fragment: "Dialogue Fragment",
  set_piece: "Set Piece",
  alternate_take: "Alternate Take",
};

export const STATUS_LABEL: Record<VaultStatus, string> = {
  vaulted: "Vaulted",
  candidate: "Candidate",
  integrated: "Integrated",
  alternate: "Alternate",
  needs_rewrite: "Needs Rewrite",
  locked: "Locked",
  deleted: "Deleted",
};

export const POSITION_LABEL: Record<VaultPosition, string> = {
  act_1: "Act I",
  act_2a: "Act II-A",
  midpoint: "Midpoint",
  act_2b: "Act II-B",
  act_3: "Act III",
  unsure: "Not sure yet",
};
