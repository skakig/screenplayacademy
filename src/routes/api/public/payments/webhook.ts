import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { verifyWebhook, type StripeEnv } from "@/lib/stripe.server";

let _supabase: ReturnType<typeof createClient<Database>> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

class WebhookRetryable extends Error {}

/**
 * Prefer `price.lookup_key` (set by `create_price`) so tier gating survives
 * the sandbox → live transition. Fall back to legacy metadata, then the raw
 * Stripe price id as a last resort.
 */
function humanPriceId(price: any): string | null {
  return (
    price?.lookup_key ??
    price?.metadata?.lovable_external_id ??
    price?.id ??
    null
  );
}

async function handleSubscriptionCreatedOrUpdated(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  const item = subscription.items?.data?.[0];
  const priceId = humanPriceId(item?.price);
  const productId =
    typeof item?.price?.product === "string" ? item.price.product : item?.price?.product?.id ?? null;
  // Basil API version puts period fields on the item; older payloads had them on the subscription.
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  const base = {
    status: subscription.status,
    product_id: productId,
    price_id: priceId,
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    environment: env,
    updated_at: new Date().toISOString(),
  };

  if (!userId) {
    const { error } = await getSupabase()
      .from("subscriptions")
      .update(base as any)
      .eq("stripe_subscription_id", subscription.id);
    if (error) throw new WebhookRetryable(error.message);
    return;
  }
  if (!priceId || !productId) {
    throw new WebhookRetryable(
      `subscription ${subscription.id} is missing price/product; cannot create row`,
    );
  }

  const { error } = await getSupabase()
    .from("subscriptions")
    .upsert(
      {
        ...base,
        user_id: userId,
        stripe_subscription_id: subscription.id,
        stripe_customer_id:
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id,
      } as any,
      { onConflict: "stripe_subscription_id" },
    );
  if (error) throw new WebhookRetryable(error.message);
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({
      status: "canceled",
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);

  // Idempotency / replay protection using Stripe's stable event id.
  const eventId = (event as any).id;
  if (eventId) {
    const { error: dupErr } = await getSupabase()
      .from("processed_webhook_events" as any)
      .insert({ event_id: eventId, event_type: event.type, environment: env } as any);
    if (dupErr) {
      if ((dupErr as any).code === "23505") {
        console.log("Skipping duplicate webhook event", { eventId, type: event.type });
        return;
      }
      throw new WebhookRetryable(
        `Failed to record webhook event ${eventId}: ${dupErr.message}`,
      );
    }
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionCreatedOrUpdated(event.data.object, env);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object, env);
        break;
      case "checkout.session.completed":
      case "invoice.paid":
      case "invoice.payment_failed":
        console.log(event.type, { id: (event.data.object as any)?.id });
        break;
      default:
        console.log("Unhandled event:", event.type);
    }
  } catch (err) {
    if (eventId) {
      await getSupabase()
        .from("processed_webhook_events" as any)
        .delete()
        .eq("event_id", eventId);
    }
    throw err;
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook received with invalid env query parameter:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          const status = e instanceof WebhookRetryable ? 500 : 400;
          return new Response("Webhook error", { status });
        }
      },
    },
  },
});
