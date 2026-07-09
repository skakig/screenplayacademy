import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FEATURE_LABEL,
  TIER_LABEL,
  hasFeature,
  tierFromPriceId,
  type Feature,
  type Tier,
} from "@/lib/entitlements";
import { serverStripeEnv } from "@/lib/stripeEnv.server";

/**
 * Server-side entitlement guard for `createServerFn` handlers.
 * Pass the user-scoped supabase client (context.supabase from requireSupabaseAuth)
 * and the userId. Throws if the user cannot access `feature`.
 *
 * The subscription lookup is scoped to the current Paddle environment
 * (sandbox in preview, live in production) so a sandbox subscription can
 * never grant access on the live site and vice-versa.
 *
 * Message format: `FEATURE_LOCKED: ...` — clients can `.startsWith("FEATURE_LOCKED")`
 * to render an upgrade CTA instead of a generic error.
 */
export async function requireFeature(
  supabase: SupabaseClient,
  userId: string,
  feature: Feature,
): Promise<Tier> {
  const environment = serverStripeEnv();
  const { data: row } = await supabase
    .from("subscriptions")
    .select("price_id, status, current_period_end")
    .eq("user_id", userId)
    .eq("environment", environment)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let tier: Tier = "free";
  if (row) {
    const periodOk =
      !row.current_period_end ||
      new Date(row.current_period_end as string).getTime() > Date.now();
    const isActive =
      (["active", "trialing", "past_due"].includes(row.status as string) && periodOk) ||
      (row.status === "canceled" && periodOk);
    if (isActive) tier = tierFromPriceId(row.price_id as string | null);
  }

  if (!hasFeature(tier, feature)) {
    throw new Error(
      `FEATURE_LOCKED: ${FEATURE_LABEL[feature]} requires the ${TIER_LABEL[
        (["creator", "pro", "studio"] as const).find((t) => hasFeature(t, feature)) ?? "creator"
      ]} plan or higher.`,
    );
  }

  return tier;
}
