import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";

/**
 * Create a Stripe Billing Portal session for the signed-in user.
 * The URL is short-lived — always generate a new one, do not cache.
 * The client opens `url` in a new tab.
 */
export const createCustomerPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("subscriptions")
      .select("stripe_customer_id, environment")
      .eq("user_id", context.userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.stripe_customer_id) {
      throw new Error("No subscription found. Upgrade a plan first to manage billing.");
    }

    try {
      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: row.stripe_customer_id,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      return { url: portal.url, environment: data.environment };
    } catch (err) {
      throw new Error(getStripeErrorMessage(err));
    }
  });
