/**
 * Live-collab permission helpers — UI gates only. Server still enforces via
 * RLS (live_scene_sessions policies + scene_locks policies).
 */
import type { ProjectRole } from "@/components/writers-room/roles";
import type { SceneLockRow } from "@/lib/assignments";

const LIVE_PARTICIPANTS: ReadonlyArray<ProjectRole> = [
  "owner",
  "co_writer",
  "editor",
];

export function canStartLiveSession(
  role: ProjectRole | null | undefined,
): boolean {
  return !!role && LIVE_PARTICIPANTS.includes(role);
}

export function canJoinLiveSession(
  role: ProjectRole | null | undefined,
): boolean {
  return !!role && LIVE_PARTICIPANTS.includes(role);
}

/**
 * True when the scene is either free or already locked by the current user.
 * A hard lock held by someone else blocks entry unless overridden.
 */
export function isSceneEntryAllowed(
  activeLock: SceneLockRow | null,
  userId: string | null,
  role: ProjectRole | null | undefined,
): { allowed: boolean; reason?: "locked_by_other" } {
  if (!activeLock || activeLock.released_at) return { allowed: true };
  if (userId && activeLock.locked_by === userId) return { allowed: true };
  // Owner / editor may override hard locks per Pass 4.
  if (role === "owner" || role === "editor") return { allowed: true };
  return { allowed: false, reason: "locked_by_other" };
}
