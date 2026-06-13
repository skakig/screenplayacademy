/**
 * Writers' Room — Pass 1 permission helpers.
 *
 * Thin wrappers around the SQL helpers defined alongside `project_members` /
 * `project_invites`. Not wired into any UI yet — provided as scaffolding for
 * later collaboration passes.
 */
import { supabase } from "@/integrations/supabase/client";

export type ProjectRole =
  | "owner"
  | "co_writer"
  | "editor"
  | "producer"
  | "commenter"
  | "viewer"
  | "actor_reader"
  | "assistant";

export async function getProjectRole(
  projectId: string,
): Promise<ProjectRole | null> {
  const { data, error } = await supabase.rpc("project_role", {
    _project_id: projectId,
  });
  if (error) throw error;
  return (data as ProjectRole | null) ?? null;
}

export async function canViewProject(projectId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_project_member", {
    _project_id: projectId,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function canEditProject(projectId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("can_edit_project", {
    _project_id: projectId,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function canManageProjectMembers(
  projectId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("owns_project", {
    _project_id: projectId,
  });
  if (error) throw error;
  return Boolean(data);
}
