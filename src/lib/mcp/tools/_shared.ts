import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

// ---------- Shared validation primitives ----------
// Payload caps are intentionally conservative. MCP callers are external
// assistants; keeping bounds tight prevents accidental large writes,
// denial-of-service via oversized inserts, and DB row-size surprises.

/** Trim, normalize newlines, strip control chars except \n and \t. */
export function sanitizeText(input: string): string {
  return input
    // Normalize CRLF and lone CR to LF FIRST — before stripping control chars,
    // otherwise \r (0x0D) is dropped and adjacent lines get glued together.
    .replace(/\r\n?/g, "\n")
    // Strip C0 control chars other than \t (\x09) and \n (\x0A), and DEL.
    .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, "")
    .trim();
}

/** Short, single-line field (headings, titles, locations). No newlines. */
export const shortText = (max: number) =>
  z
    .string()
    .transform(sanitizeText)
    .refine((v) => !v.includes("\n"), { message: "Must be a single line." })
    .refine((v) => v.length <= max, { message: `Must be ≤ ${max} chars.` });

/** Optional short text; empty string becomes null. */
export const shortTextNullable = (max: number) =>
  z
    .string()
    .transform(sanitizeText)
    .transform((v) => (v.length === 0 ? null : v))
    .refine((v) => v === null || !v.includes("\n"), { message: "Must be a single line." })
    .refine((v) => v === null || v.length <= max, { message: `Must be ≤ ${max} chars.` })
    .nullable();

/** Multi-line prose (purpose, arc, notes). */
export const longText = (max: number) =>
  z
    .string()
    .transform(sanitizeText)
    .refine((v) => v.length <= max, { message: `Must be ≤ ${max} chars.` });

export const longTextNullable = (max: number) =>
  z
    .string()
    .transform(sanitizeText)
    .transform((v) => (v.length === 0 ? null : v))
    .refine((v) => v === null || v.length <= max, { message: `Must be ≤ ${max} chars.` })
    .nullable();

/** Screenplay block content: multi-line allowed, tighter cap than free prose. */
export const blockContent = longText(4000);

/** Allowed scene status values — anything else is rejected. */
export const SCENE_STATUS = [
  "draft",
  "in_progress",
  "needs_review",
  "locked",
  "final",
  "archived",
] as const;

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

// ---------- Entitlement gate for MCP write tools ----------
// MCP writes are a Pro-tier feature. This check runs server-side, using the
// user-scoped Supabase client (RLS respects the caller). Callers should:
//     const gate = await requireMcpWrites(supabase, ctx.getUserId());
//     if (!gate.ok) return fail(gate.message);
export async function requireMcpWrites(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: row } = await supabase
    .from("subscriptions")
    .select("price_id, status, current_period_end")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let tier: "free" | "creator" | "pro" | "studio" = "free";
  if (row) {
    const periodOk =
      !row.current_period_end ||
      new Date(row.current_period_end as string).getTime() > Date.now();
    const isActive =
      (["active", "trialing", "past_due"].includes(row.status as string) && periodOk) ||
      (row.status === "canceled" && periodOk);
    if (isActive) {
      switch (row.price_id) {
        case "studio_monthly": tier = "studio"; break;
        case "pro_monthly": tier = "pro"; break;
        case "creator_monthly": tier = "creator"; break;
      }
    }
  }

  const RANK = { free: 0, creator: 1, pro: 2, studio: 3 } as const;
  if (RANK[tier] < RANK.pro) {
    return {
      ok: false,
      message:
        "MCP write tools require the Pro plan or higher. Upgrade at " +
        "https://www.scenesmithstudio.com/pricing to unlock write access.",
    };
  }
  return { ok: true };
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
  const { data, error } = await supabase
    .from("scene_locks")
    .select("locked_by, lock_type, expires_at, released_at")
    .eq("scene_id", sceneId)
    .is("released_at", null);
  if (error) return { ok: false, message: `Lock check failed: ${error.message}` };
  const now = Date.now();
  const active = (data ?? []).find(
    (l) => !l.expires_at || new Date(l.expires_at).getTime() > now,
  );
  if (active && active.locked_by !== currentUserId) {
    return {
      ok: false,
      message: `Scene is locked by another collaborator (${active.lock_type}). Ask them to release it, or use the app to override.`,
    };
  }
  return { ok: true };
}
