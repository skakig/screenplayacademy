import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

/** Build a Supabase client that acts as the signed-in MCP user (RLS applies). */
export function userClient(ctx: ToolContext): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function unauth() {
  return { content: [{ type: "text" as const, text: "Not authenticated" }], isError: true };
}

export function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export function ok<T>(payload: T, structuredKey: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: { [structuredKey]: payload } as Record<string, unknown>,
  };
}

/**
 * Refuse writes when a scene has an active lock held by another user.
 * The owner/editor override is still available via the app UI — the MCP path
 * intentionally never overrides another writer's live lock.
 */
export async function assertSceneWritable(
  supabase: SupabaseClient,
  sceneId: string,
  currentUserId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("scene_locks")
    .select("locked_by, lock_type, expires_at, released_at")
    .eq("scene_id", sceneId)
    .is("released_at", null)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .limit(1);
  if (error) return { ok: false, message: `Lock check failed: ${error.message}` };
  const lock = data?.[0];
  if (lock && lock.locked_by !== currentUserId) {
    return {
      ok: false,
      message: `Scene is locked by another collaborator (${lock.lock_type}). Ask them to release it, or use the app to override.`,
    };
  }
  return { ok: true };
}
