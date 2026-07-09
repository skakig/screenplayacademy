import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { serverStripeEnv } from "@/lib/stripeEnv.server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Increment a metered feature counter for the current user. Called from
 * other server functions (which already have a request-scoped supabase
 * client) — NOT exposed to the client directly.
 *
 * Throws `USAGE_LIMIT: …` when the monthly cap is reached.
 */
export async function consumeUsage(
  supabase: SupabaseClient,
  feature: "ai_assists" | "storyboard_panels" | "tableread_minutes",
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
