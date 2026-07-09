import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { serverStripeEnv } from "@/lib/stripeEnv.server";

export type MeteredFeature = "ai_assists" | "storyboard_panels" | "tableread_minutes";

/**
 * Atomically check-and-increment a monthly usage counter for the signed-in user.
 * Throws `USAGE_LIMIT: …` when the tier cap is reached — client code can pattern
 * match on the prefix to render an upgrade CTA.
 *
 * Runs through the user-scoped supabase client (from `requireSupabaseAuth`) so
 * the SECURITY DEFINER function sees the correct `auth.uid()`.
 */
export async function consumeUsage(
  supabase: SupabaseClient,
  feature: MeteredFeature,
  amount = 1,
): Promise<number> {
  const environment = serverStripeEnv();
  const { data, error } = await supabase.rpc("consume_usage", {
    _feature: feature,
    _amount: amount,
    _environment: environment,
  });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

export const getUsageSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const environment = serverStripeEnv();
    const { data, error } = await context.supabase.rpc("get_usage_snapshot", {
      _environment: environment,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      feature: MeteredFeature;
      used: number;
      monthly_limit: number;
      tier: string;
    }>;
  });
