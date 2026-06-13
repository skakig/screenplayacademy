import { supabase } from "@/integrations/supabase/client";
import type { ProjectRole } from "@/components/writers-room/roles";

export const wrKeys = {
  members: (projectId: string) => ["wr", "members", projectId] as const,
  invites: (projectId: string) => ["wr", "invites", projectId] as const,
  role: (projectId: string) => ["wr", "role", projectId] as const,
  canView: (projectId: string) => ["wr", "canView", projectId] as const,
};

export async function fetchMembers(projectId: string) {
  const { data, error } = await supabase
    .from("project_members")
    .select(
      "id, project_id, user_id, role, status, invited_by, joined_at, last_seen_at, created_at",
    )
    .eq("project_id", projectId)
    .neq("status", "removed")
    .neq("status", "left")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPendingInvites(projectId: string) {
  const { data, error } = await supabase
    .from("project_invites")
    .select(
      "id, project_id, email, role, status, expires_at, invited_by, created_at",
    )
    .eq("project_id", projectId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchProjectRole(
  projectId: string,
): Promise<ProjectRole | null> {
  const { data, error } = await supabase.rpc("project_role", {
    _project_id: projectId,
  });
  if (error) throw error;
  return (data as ProjectRole | null) ?? null;
}

// ---------------------------------------------------------------------------
// Invite token: 32 random bytes → URL-safe base64. Only the SHA-256 hex of
// the token is ever persisted (token_hash).
// ---------------------------------------------------------------------------
function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateInviteToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface CreateInviteInput {
  projectId: string;
  email: string;
  role: Exclude<ProjectRole, "owner">;
}

export async function createInvite(input: CreateInviteInput) {
  const { data: userResp, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userResp?.user) throw userErr ?? new Error("Not signed in");

  const token = generateInviteToken();
  const token_hash = await hashToken(token);
  const expires_at = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("project_invites")
    .insert({
      project_id: input.projectId,
      email: input.email.trim().toLowerCase(),
      role: input.role,
      token_hash,
      invited_by: userResp.user.id,
      status: "pending",
      expires_at,
    })
    .select()
    .single();
  if (error) throw error;
  return { invite: data, token };
}

export async function revokeInvite(inviteId: string) {
  const { error } = await supabase
    .from("project_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId);
  if (error) throw error;
}

export async function updateMemberRole(
  memberId: string,
  role: Exclude<ProjectRole, "owner">,
) {
  const { error } = await supabase
    .from("project_members")
    .update({ role })
    .eq("id", memberId);
  if (error) throw error;
}

export async function removeMember(memberId: string) {
  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("id", memberId);
  if (error) throw error;
}

export function buildInviteUrl(token: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/accept-invite?token=${encodeURIComponent(token)}`;
}
