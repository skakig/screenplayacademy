import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";

type PortalResult = { url: string } | { error: string };

/**
 * Create a Stripe Billing Portal session for the signed-in user.
 * The URL is short-lived — always generate a new one, do not cache.
 */
export const createCustomerPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { environment: StripeEnv; returnUrl?: string }) => d)
  .handler(async ({ data, context }): Promise<PortalResult> => {
    const { data: row, error } = await context.supabase
      .from("subscriptions")
      .select("stripe_customer_id, environment")
      .eq("user_id", context.userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!row || !row.stripe_customer_id) {
      return { error: "No subscription found. Upgrade a plan first to manage billing." };
    }

    try {
      const stripe = createStripeClient(data.environment);
      const session = await stripe.billingPortal.sessions.create({
        customer: row.stripe_customer_id,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      return { url: session.url };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });
