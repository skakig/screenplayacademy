import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { verifyWebhook, EventName, type PaddleEnv } from "@/lib/paddle.server";

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

function resolveExternalIds(item: any): { productId: string | null; priceId: string | null } {
  return {
    priceId: item?.price?.importMeta?.externalId ?? null,
    productId: item?.product?.importMeta?.externalId ?? null,
  };
}

async function handleSubscriptionCreated(data: any, env: PaddleEnv) {
  const { id, customerId, items, status, currentBillingPeriod, customData } = data;

  const userId = customData?.userId;
  if (!userId) {
    // Do NOT swallow this — return a retryable error so Paddle re-sends the
    // event (up to 3 days). If we 200 here the subscription is permanently
    // orphaned; the user has been charged with no server-side record.
    throw new WebhookRetryable(
      `subscription.created event ${id} is missing customData.userId — refusing to persist an orphaned subscription`,
    );
  }

  const item = items?.[0];
  const { priceId, productId } = resolveExternalIds(item);
  if (!priceId || !productId) {
    console.warn("Skipping subscription: missing importMeta.externalId", {
      rawPriceId: item?.price?.id,
      rawProductId: item?.product?.id,
    });
    return;
  }

  await getSupabase()
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        paddle_subscription_id: id,
        paddle_customer_id: customerId,
        product_id: productId,
        price_id: priceId,
        status,
        current_period_start: currentBillingPeriod?.startsAt,
        current_period_end: currentBillingPeriod?.endsAt,
        environment: env,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "paddle_subscription_id" },
    );
}

async function handleSubscriptionUpdated(data: any, env: PaddleEnv) {
  const { id, customerId, items, status, currentBillingPeriod, scheduledChange } = data;

  // Plan changes (upgrade / downgrade) alter items[0] — persist the new
  // product/price so tier-gating reflects reality. Fall back to what's in
  // the DB if the payload is somehow missing importMeta.
  const item = items?.[0];
  const { priceId, productId } = resolveExternalIds(item);

  await getSupabase()
    .from("subscriptions")
    .update({
      status,
      current_period_start: currentBillingPeriod?.startsAt,
      current_period_end: currentBillingPeriod?.endsAt,
      cancel_at_period_end: scheduledChange?.action === "cancel",
      updated_at: new Date().toISOString(),
      ...(customerId ? { paddle_customer_id: customerId } : {}),
      ...(priceId ? { price_id: priceId } : {}),
      ...(productId ? { product_id: productId } : {}),
    })
    .eq("paddle_subscription_id", id)
    .eq("environment", env);
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  // IMPORTANT: preserve current_period_end so `has_active_subscription` keeps
  // returning true until the paid period actually ends (grace window).
  // Clear cancel_at_period_end because the cancel has already happened —
  // there is no future scheduled cancel to warn about anymore.
  const { id, currentBillingPeriod } = data;

  await getSupabase()
    .from("subscriptions")
    .update({
      status: "canceled",
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
      // Only overwrite current_period_end if Paddle actually re-sends it.
      ...(currentBillingPeriod?.endsAt
        ? {
            current_period_end: currentBillingPeriod.endsAt,
            current_period_start: currentBillingPeriod.startsAt,
          }
        : {}),
    })
    .eq("paddle_subscription_id", id)
    .eq("environment", env);
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.eventType) {
    case EventName.SubscriptionCreated:
      await handleSubscriptionCreated(event.data, env);
      break;
    case EventName.SubscriptionUpdated:
      await handleSubscriptionUpdated(event.data, env);
      break;
    case EventName.SubscriptionCanceled:
      await handleSubscriptionCanceled(event.data, env);
      break;
    case EventName.TransactionCompleted:
      // No one-time products in the catalog — log for audit and move on.
      // Subscription lifecycle events are what update entitlement.
      console.log("transaction.completed", { txId: (event.data as any)?.id });
      break;
    case EventName.TransactionPaymentFailed:
      // Paddle will retry and eventually flip the subscription to `past_due`
      // (handled by subscription.updated). We surface `past_due` as a dunning
      // banner, not a revocation.
      console.warn("transaction.payment_failed", { txId: (event.data as any)?.id });
      break;
    default:
      console.log("Unhandled event:", event.eventType);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get("env") || "sandbox") as PaddleEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          // 5xx tells Paddle to retry (missing userId, DB unavailable, etc).
          // 4xx would drop the event permanently.
          const status = e instanceof WebhookRetryable ? 500 : 400;
          return new Response("Webhook error", { status });
        }
      },
    },
  },
});
