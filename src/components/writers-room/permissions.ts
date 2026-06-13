/**
 * Writers' Room — comment permission helpers.
 *
 * Centralised role-based checks for the comments / review-notes layer.
 * UI code MUST go through these helpers instead of inlining role lists,
 * so a single edit changes who can do what across the app.
 *
 * Server-side authoritative checks live in the SQL helpers
 * `can_comment_on_project` and `can_resolve_project_comments`; these
 * mirror them for UI gating only.
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
