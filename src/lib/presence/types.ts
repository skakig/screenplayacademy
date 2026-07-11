/**
 * Writers' Room — Pass 6 Presence types.
 *
 * Ephemeral payload broadcast over the project-scoped Supabase Realtime
 * presence channel. NEVER contains script text, selection ranges, prompt
 * data, or any canonical content — presence is awareness, not editing.
 */

export type PresenceArea =
  | "script"
  | "writers_room"
  | "comments"
  | "assignments"
  | "suggestions"
  | "pitch"
  | "settings"
  | "unknown";

export interface ProjectPresenceState {
  user_id: string;
  display_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  project_id: string;
  active_area: PresenceArea;
  /** Scene UUID. Never rendered raw — pair with active_scene_label. */
  active_scene_id?: string | null;
  /** Human label e.g. "Scene 12". Safe to render. */
  active_scene_label?: string | null;
  is_typing_scene_id?: string | null;
  /** Server ID (or local id) of the block the caret is currently in. */
  active_block_id?: string | null;
  last_active_at: string;
}

export type PresencePeer = ProjectPresenceState & { is_self: boolean };
