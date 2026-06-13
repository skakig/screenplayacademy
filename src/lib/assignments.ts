/**
 * Scene assignments + scene locks — data access (Writers' Room Pass 4).
 *
 * All access goes through Supabase RLS — see scene_assignments / scene_locks
 * policies. Editor-side lock enforcement is intentionally deferred to a
 * later pass (see plan); these helpers and the Production Board only.
 *
 * TODO (later pass): when `change_events` exists, log
 *   scene_assignment.{created,updated,cleared}
 *   scene_lock.{created,released,overridden,expired_detected}
 * from the matching call sites below.
 */
import { supabase } from "@/integrations/supabase/client";

export type AssignmentStatus =
  | "assigned"
  | "in_progress"
  | "ready_for_review"
  | "approved"
  | "blocked"
  | "unassigned";

export type LockType = "soft" | "hard" | "session" | "review";

export interface SceneAssignmentRow {
  id: string;
  project_id: string;
  scene_id: string;
  assignee_id: string;
  assigned_by: string | null;
  status: AssignmentStatus;
  due_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface SceneLockRow {
  id: string;
  project_id: string;
  scene_id: string;
  locked_by: string;
  lock_type: LockType;
  reason: string | null;
  expires_at: string | null;
  released_at: string | null;
  created_at: string;
}

export const boardKeys = {
  scenes: (projectId: string) => ["wr", "boardScenes", projectId] as const,
  assignments: (projectId: string) =>
    ["wr", "assignments", projectId] as const,
  locks: (projectId: string) => ["wr", "locks", projectId] as const,
  activeMembers: (projectId: string) =>
    ["wr", "activeMembers", projectId] as const,
};

const ASSIGNMENT_COLUMNS =
  "id, project_id, scene_id, assignee_id, assigned_by, status, due_at, note, created_at, updated_at";
const LOCK_COLUMNS =
  "id, project_id, scene_id, locked_by, lock_type, reason, expires_at, released_at, created_at";

export async function fetchBoardScenes(projectId: string) {
  const { data, error } = await supabase
    .from("scenes")
    .select("id, title, scene_heading, order_index, status, created_at")
    .eq("project_id", projectId)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchSceneAssignments(
  projectId: string,
): Promise<SceneAssignmentRow[]> {
  const { data, error } = await supabase
    .from("scene_assignments")
    .select(ASSIGNMENT_COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SceneAssignmentRow[];
}

export async function fetchActiveLocks(
  projectId: string,
): Promise<SceneLockRow[]> {
  const { data, error } = await supabase
    .from("scene_locks")
    .select(LOCK_COLUMNS)
    .eq("project_id", projectId)
    .is("released_at", null);
  if (error) throw error;
  return (data ?? []) as SceneLockRow[];
}

export async function fetchActiveProjectMembers(projectId: string) {
  const { data, error } = await supabase
    .from("project_members")
    .select("id, user_id, role, status")
    .eq("project_id", projectId)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// ---- Assignment mutations ------------------------------------------------

export interface AssignSceneInput {
  projectId: string;
  sceneId: string;
  assigneeId: string;
  status?: AssignmentStatus;
  dueAt?: string | null;
  note?: string | null;
}

export async function assignScene(input: AssignSceneInput) {
  const { data: userResp, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userResp?.user) throw userErr ?? new Error("Not signed in");

  const { data, error } = await supabase
    .from("scene_assignments")
    .upsert(
      {
        project_id: input.projectId,
        scene_id: input.sceneId,
        assignee_id: input.assigneeId,
        assigned_by: userResp.user.id,
        status: input.status ?? "assigned",
        due_at: input.dueAt ?? null,
        note: input.note?.trim() ? input.note.trim() : null,
      },
      { onConflict: "scene_id,assignee_id" },
    )
    .select(ASSIGNMENT_COLUMNS)
    .single();
  if (error) throw error;
  return data as SceneAssignmentRow;
}

export async function updateAssignmentStatus(
  id: string,
  status: AssignmentStatus,
) {
  const { error } = await supabase
    .from("scene_assignments")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

export async function clearAssignment(id: string) {
  const { error } = await supabase
    .from("scene_assignments")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ---- Lock mutations ------------------------------------------------------

export interface ClaimSceneInput {
  projectId: string;
  sceneId: string;
  expiresInMinutes?: number;
  lockType?: LockType;
}

export async function claimScene(input: ClaimSceneInput) {
  const { data: userResp, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userResp?.user) throw userErr ?? new Error("Not signed in");

  const minutes = input.expiresInMinutes ?? 30;
  const expires_at = new Date(Date.now() + minutes * 60_000).toISOString();

  const { data, error } = await supabase
    .from("scene_locks")
    .insert({
      project_id: input.projectId,
      scene_id: input.sceneId,
      locked_by: userResp.user.id,
      lock_type: input.lockType ?? "session",
      expires_at,
    })
    .select(LOCK_COLUMNS)
    .single();
  if (error) {
    // 23505 = unique_violation (scene_locks_one_active_per_scene)
    const code = (error as { code?: string }).code;
    if (code === "23505") {
      throw new Error("ALREADY_LOCKED");
    }
    throw error;
  }
  return data as SceneLockRow;
}

export async function releaseLock(lockId: string) {
  const { error } = await supabase
    .from("scene_locks")
    .update({ released_at: new Date().toISOString() })
    .eq("id", lockId);
  if (error) throw error;
}

export async function overrideLock(lockId: string, reason: string) {
  const { error } = await supabase
    .from("scene_locks")
    .update({
      released_at: new Date().toISOString(),
      reason,
    })
    .eq("id", lockId);
  if (error) throw error;
}

export function isLockStale(lock: SceneLockRow | null | undefined): boolean {
  if (!lock || lock.released_at) return false;
  if (!lock.expires_at) return false;
  return new Date(lock.expires_at).getTime() < Date.now();
}
