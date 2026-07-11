import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { serverStripeEnv } from "@/lib/stripeEnv.server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MeteredFeature =
  | "ai_assists"
  | "storyboard_panels"
  | "tableread_minutes"
  | "ai_tokens"
  | "tts_characters"
  | "character_portraits";

/**
 * Increment a metered feature counter for the current user. Called from
 * other server functions (which already have a request-scoped supabase
 * client) — NOT exposed to the client directly.
 *
 * Throws `USAGE_LIMIT: …` when the monthly cap is reached.
 */
export async function consumeUsage(
  supabase: SupabaseClient,
  feature: MeteredFeature,
  amount = 1,
): Promise<number> {
  const environment = serverStripeEnv();
  const { data, error } = await supabase.rpc("consume_usage", {
    _feature: feature,
    _amount: Math.max(1, Math.floor(amount)),
    _environment: environment,
  });
  if (error) throw new Error(error.message);
  return data as number;
}

/**
 * Best-effort post-hoc metering. Use when a call has already succeeded
 * and we want to record actual usage (like token totals returned by the
 * AI SDK) without throwing on cap — the pre-flight `consumeUsage` guard
 * has already gated the call.
 */
export async function recordUsage(
  supabase: SupabaseClient,
  feature: MeteredFeature,
  amount: number,
): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) return;
  try {
    await consumeUsage(supabase, feature, Math.ceil(amount));
  } catch {
    // Ignore cap errors on post-hoc recording — the counter still increments
    // up to the cap inside `consume_usage`, and we don't want to fail the
    // request after the AI call already completed.
  }
}

export const getUsageSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as Record<string, never>)
  .handler(async ({ context }) => {
    const environment = serverStripeEnv();
    const { data, error } = await context.supabase.rpc("get_usage_snapshot", {
      _environment: environment,
    });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
