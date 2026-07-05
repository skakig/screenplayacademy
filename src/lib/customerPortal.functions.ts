import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getPaddleClient, type PaddleEnv } from "@/lib/paddle.server";

/**
 * Create a Paddle customer portal session for the signed-in user.
 * The URL is short-lived — always generate a new one, do not cache.
 *
 * Returns { url, environment } — the client opens `url` in a new tab.
 */
export const createCustomerPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as Record<string, never>)
  .handler(async ({ context }) => {
    // Look up the user's most recent subscription (any status) to find their
    // Paddle customer id + which environment they subscribed in.
    const { data: row, error } = await context.supabase
      .from("subscriptions")
      .select("paddle_customer_id, paddle_subscription_id, environment")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || !row.paddle_customer_id) {
      throw new Error("No subscription found. Upgrade a plan first to manage billing.");
    }

    const env = (row.environment as PaddleEnv) ?? "sandbox";
    const paddle = getPaddleClient(env);
    const session = await paddle.customerPortalSessions.create(
      row.paddle_customer_id,
      row.paddle_subscription_id ? [row.paddle_subscription_id] : [],
    );

    // Prefer the per-subscription overview URL when available, else the general overview.
    const perSub =
      session.urls?.subscriptions?.[0]?.updateSubscriptionPaymentMethod
      ?? session.urls?.subscriptions?.[0]?.cancelSubscription;
    const url = session.urls?.general?.overview ?? perSub;
    if (!url) throw new Error("Paddle did not return a portal URL");

    return { url, environment: env };
  });
