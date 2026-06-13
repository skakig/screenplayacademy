/**
 * Writers' Room — comment + production-board permission helpers.
 *
 * Centralised role-based checks for collaboration features. Server
 * authoritative checks live in SQL helpers (`can_comment_on_project`,
 * `can_resolve_project_comments`, `can_manage_scene_assignments`,
 * `can_claim_scene`, `can_override_scene_lock`); these mirror them for
 * UI gating only.
 */
import type { ProjectRole } from "./roles";

const COMMENTERS: ReadonlyArray<ProjectRole> = [
  "owner",
  "co_writer",
  "editor",
  "producer",
  "commenter",
  "assistant",
];

const RESOLVERS: ReadonlyArray<ProjectRole> = [
  "owner",
  "co_writer",
  "editor",
  "producer",
];

const ARCHIVERS: ReadonlyArray<ProjectRole> = ["owner"];

const ASSIGN_MANAGERS: ReadonlyArray<ProjectRole> = [
  "owner",
  "co_writer",
  "editor",
  "producer",
];

const CLAIMERS: ReadonlyArray<ProjectRole> = ["owner", "co_writer", "editor"];

const LOCK_OVERRIDERS: ReadonlyArray<ProjectRole> = ["owner", "editor"];

export const canViewComments = (role: ProjectRole | null | undefined): boolean =>
  role !== null && role !== undefined;

export const canCreateComment = (
  role: ProjectRole | null | undefined,
): boolean => !!role && COMMENTERS.includes(role);

export const canResolveComment = (
  role: ProjectRole | null | undefined,
): boolean => !!role && RESOLVERS.includes(role);

export const canArchiveComment = (
  role: ProjectRole | null | undefined,
): boolean => !!role && ARCHIVERS.includes(role);

// --- Scene assignments + locks (Pass 4) ---------------------------------

export const canViewSceneAssignments = (
  role: ProjectRole | null | undefined,
): boolean => role !== null && role !== undefined;

export const canManageSceneAssignments = (
  role: ProjectRole | null | undefined,
): boolean => !!role && ASSIGN_MANAGERS.includes(role);

export const canClaimScene = (
  role: ProjectRole | null | undefined,
): boolean => !!role && CLAIMERS.includes(role);

export const canReleaseOwnSceneLock = (
  role: ProjectRole | null | undefined,
): boolean => !!role && CLAIMERS.includes(role);

export const canOverrideSceneLock = (
  role: ProjectRole | null | undefined,
): boolean => !!role && LOCK_OVERRIDERS.includes(role);

/**
 * True when the user could safely edit the scene right now:
 *   - no active lock, or
 *   - the active lock belongs to them.
 * Anyone else viewing should see a "locked by X" badge, not an edit affordance.
 * (UI uses this for affordances only; the editor itself does not enforce
 * lock-aware contentEditable in this pass — deferred to a later editor pass.)
 */
export const canEditLockedScene = (
  role: ProjectRole | null | undefined,
  activeLock: { locked_by: string; released_at: string | null } | null,
  userId: string | null,
): boolean => {
  if (!canClaimScene(role)) return false;
  if (!activeLock || activeLock.released_at) return true;
  return !!userId && activeLock.locked_by === userId;
};

// --- Suggestions / Review Mode (Pass 5) ----------------------------------

const SUGGESTION_CREATORS: ReadonlyArray<ProjectRole> = [
  "owner",
  "co_writer",
  "editor",
  "producer",
  "commenter",
  "assistant",
];

const SUGGESTION_ACCEPTERS: ReadonlyArray<ProjectRole> = [
  "owner",
  "co_writer",
  "editor",
];

const SUGGESTION_REJECTERS: ReadonlyArray<ProjectRole> = [
  "owner",
  "co_writer",
  "editor",
  "producer",
];

const SUGGESTION_ARCHIVERS: ReadonlyArray<ProjectRole> = ["owner"];

export const canViewSuggestions = (
  role: ProjectRole | null | undefined,
): boolean => role !== null && role !== undefined;

export const canCreateSuggestion = (
  role: ProjectRole | null | undefined,
): boolean => !!role && SUGGESTION_CREATORS.includes(role);

export const canAcceptSuggestion = (
  role: ProjectRole | null | undefined,
): boolean => !!role && SUGGESTION_ACCEPTERS.includes(role);

/**
 * A user may reject a suggestion when their role allows it globally, or
 * when they authored the suggestion and it's still open.
 */
export const canRejectSuggestion = (
  role: ProjectRole | null | undefined,
  suggestion: { author_id: string | null; status: string },
  userId: string | null,
): boolean => {
  if (!!role && SUGGESTION_REJECTERS.includes(role)) return true;
  return (
    suggestion.status === "open" &&
    !!userId &&
    suggestion.author_id === userId
  );
};

export const canArchiveSuggestion = (
  role: ProjectRole | null | undefined,
): boolean => !!role && SUGGESTION_ARCHIVERS.includes(role);

export const canApplySuggestionToCanonicalContent = (
  role: ProjectRole | null | undefined,
): boolean => canAcceptSuggestion(role);

