/**
 * Live scene collaboration types (Pass 7 — experimental).
 *
 * Realtime payloads are intentionally small: a single block delta per event.
 * No full screenplay content, no project metadata, no AI prompt data.
 */

export type LiveOperation =
  | "update_text"
  // Reserved for later phases — NOT applied in Pass 7A:
  | "update_type"
  | "insert_block_after"
  | "delete_block"
  | "move_block";

export interface LiveBlockUpdateEvent {
  event_id: string;
  project_id: string;
  scene_id: string;
  script_block_id?: string;
  local_block_id?: string;
  actor_id: string;
  actor_name?: string | null;
  operation: LiveOperation;
  base_revision?: number;
  next_revision?: number;
  block_type?: string;
  text?: string;
  after_block_id?: string;
  client_timestamp: string;
  origin: "local" | "remote";
}

export type ConflictReason =
  | "local_dirty"
  | "revision_mismatch"
  | "missing_block"
  | "locked_scene"
  | "unsupported_operation";

export interface HeldRemoteChange {
  id: string;
  projectId: string;
  sceneId: string;
  scriptBlockId?: string;
  localBlockId?: string;
  actorId: string;
  actorName?: string | null;
  operation: LiveOperation;
  incomingText?: string;
  localText?: string;
  reason: ConflictReason;
  receivedAt: string;
}

export type LiveConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "paused";

export interface LiveParticipant {
  user_id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  is_self?: boolean;
}
