/**
 * Comments data-access layer (Writers' Room — Pass 3).
 *
 * All access goes through Supabase RLS — see the `comments` table policies.
 * Block-level (`script_block_id`) anchors are intentionally not surfaced in
 * the UI yet; the schema and these helpers already accept the field so a
 * later pass can wire the editor up without re-touching this file.
 *
 * TODO (later pass): when `change_events` exists, insert a corresponding
 * row from `createComment` / `createReply` / `setCommentStatus` so the
 * notifications surface can pick them up. Suggested event names:
 *   comment.created · comment.reply_created · comment.resolved
 *   comment.reopened · comment.archived
 */
import { supabase } from "@/integrations/supabase/client";

export type CommentStatus = "open" | "resolved" | "archived";

export interface CommentRow {
  id: string;
  project_id: string;
  scene_id: string | null;
  script_block_id: string | null;
  parent_comment_id: string | null;
  author_id: string;
  body: string;
  status: CommentStatus;
  anchor_text: string | null;
  anchor_offset_start: number | null;
  anchor_offset_end: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  resolved_by: string | null;
  resolved_at: string | null;
}

export const commentKeys = {
  all: (projectId: string) => ["comments", "project", projectId] as const,
  status: (projectId: string, status: CommentStatus) =>
    ["comments", "project", projectId, status] as const,
  scenes: (projectId: string) => ["comments", "scenes", projectId] as const,
};

const COMMENT_COLUMNS =
  "id, project_id, scene_id, script_block_id, parent_comment_id, author_id, body, status, anchor_text, anchor_offset_start, anchor_offset_end, metadata, created_at, updated_at, resolved_by, resolved_at";

export async function fetchComments(
  projectId: string,
  status: CommentStatus,
): Promise<CommentRow[]> {
  const { data, error } = await supabase
    .from("comments")
    .select(COMMENT_COLUMNS)
    .eq("project_id", projectId)
    .eq("status", status)
    .order("created_at", { ascending: status === "resolved" ? false : true });
  if (error) throw error;
  return (data ?? []) as CommentRow[];
}

export interface SceneOption {
  id: string;
  title: string | null;
  scene_heading: string | null;
}

export async function fetchProjectScenes(
  projectId: string,
): Promise<SceneOption[]> {
  const { data, error } = await supabase
    .from("scenes")
    .select("id, title, scene_heading, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SceneOption[];
}

export interface CreateCommentInput {
  projectId: string;
  body: string;
  sceneId?: string | null;
  scriptBlockId?: string | null;
  parentCommentId?: string | null;
}

export async function createComment(input: CreateCommentInput) {
  const { data: userResp, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userResp?.user) throw userErr ?? new Error("Not signed in");

  const body = input.body.trim();
  if (!body) throw new Error("Comment cannot be empty");
  if (body.length > 5000) throw new Error("Comment is too long (max 5000)");

  const { data, error } = await supabase
    .from("comments")
    .insert({
      project_id: input.projectId,
      author_id: userResp.user.id,
      body,
      scene_id: input.sceneId ?? null,
      script_block_id: input.scriptBlockId ?? null,
      parent_comment_id: input.parentCommentId ?? null,
      status: "open",
      metadata: { source: "human" },
    })
    .select(COMMENT_COLUMNS)
    .single();
  if (error) throw error;
  return data as CommentRow;
}

export async function setCommentStatus(
  commentId: string,
  status: CommentStatus,
) {
  const { data: userResp } = await supabase.auth.getUser();
  const patch: {
    status: CommentStatus;
    resolved_by?: string | null;
    resolved_at?: string | null;
  } = { status };
  if (status === "resolved") {
    patch.resolved_by = userResp?.user?.id ?? null;
    patch.resolved_at = new Date().toISOString();
  } else if (status === "open") {
    patch.resolved_by = null;
    patch.resolved_at = null;
  }
  const { error } = await supabase
    .from("comments")
    .update(patch)
    .eq("id", commentId);
  if (error) throw error;
}

export async function updateCommentBody(commentId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Comment cannot be empty");
  if (trimmed.length > 5000) throw new Error("Comment is too long (max 5000)");
  const { error } = await supabase
    .from("comments")
    .update({ body: trimmed })
    .eq("id", commentId);
  if (error) throw error;
}
