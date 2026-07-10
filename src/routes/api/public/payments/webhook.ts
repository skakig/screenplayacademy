import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import { packByPriceId } from "@/lib/creditPacks";

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

function resolvePriceLookup(item: any): { priceId: string | null; productId: string | null } {
  return {
    priceId:
      item?.price?.lookup_key ??
      item?.price?.metadata?.lovable_external_id ??
      item?.price?.id ??
      null,
    productId:
      typeof item?.price?.product === "string"
        ? item.price.product
        : (item?.price?.product?.id ?? null),
  };
}

function toIso(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

async function handleSubscriptionCreated(sub: any, env: StripeEnv) {
  const userId = sub.metadata?.userId;
  if (!userId) {
    throw new WebhookRetryable(
      `subscription.created ${sub.id} missing metadata.userId — refusing to orphan subscription`,
    );
  }
  const item = sub.items?.data?.[0];
  const { priceId, productId } = resolvePriceLookup(item);
  if (!priceId || !productId) {
    console.warn("Skipping subscription: missing price/product", { subId: sub.id });
    return;
  }
  const periodStart = item?.current_period_start ?? sub.current_period_start;
  const periodEnd = item?.current_period_end ?? sub.current_period_end;

  const { error } = await getSupabase()
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        stripe_subscription_id: sub.id,
        stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
        product_id: productId,
        price_id: priceId,
        status: sub.status,
        current_period_start: toIso(periodStart),
        current_period_end: toIso(periodEnd),
        cancel_at_period_end: sub.cancel_at_period_end ?? false,
        environment: env,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_id" },
    );
  if (error) throw new WebhookRetryable(error.message);
}

async function handleSubscriptionUpdated(sub: any, env: StripeEnv) {
  const item = sub.items?.data?.[0];
  const { priceId, productId } = resolvePriceLookup(item);
  const periodStart = item?.current_period_start ?? sub.current_period_start;
  const periodEnd = item?.current_period_end ?? sub.current_period_end;

  const { error } = await getSupabase()
    .from("subscriptions")
    .update({
      status: sub.status,
      ...(productId && { product_id: productId }),
      ...(priceId && { price_id: priceId }),
      current_period_start: toIso(periodStart),
      current_period_end: toIso(periodEnd),
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", sub.id)
    .eq("environment", env);
  if (error) throw new WebhookRetryable(error.message);
}

async function handleSubscriptionDeleted(sub: any, env: StripeEnv) {
  const { error } = await getSupabase()
    .from("subscriptions")
    .update({
      status: "canceled",
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", sub.id)
    .eq("environment", env);
  if (error) throw new WebhookRetryable(error.message);
}

async function handleInvoicePaymentFailed(invoice: any, env: StripeEnv) {
  const subId = typeof invoice.subscription === "string"
    ? invoice.subscription
    : invoice.subscription?.id;
  if (!subId) return;
  const { error } = await getSupabase()
    .from("subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subId)
    .eq("environment", env);
  if (error) throw new WebhookRetryable(error.message);
}

async function handleInvoicePaid(invoice: any, env: StripeEnv) {
  // Belt-and-suspenders renewal refresh: if `customer.subscription.updated`
  // is delayed, this keeps `current_period_end` fresh so entitlement checks
  // don't flap during the retry window.
  const subId = typeof invoice.subscription === "string"
    ? invoice.subscription
    : invoice.subscription?.id;
  if (!subId) return;
  const line = invoice.lines?.data?.[0];
  const periodEnd = line?.period?.end;
  const periodStart = line?.period?.start;
  const { error } = await getSupabase()
    .from("subscriptions")
    .update({
      status: "active",
      ...(periodStart && { current_period_start: new Date(periodStart * 1000).toISOString() }),
      ...(periodEnd && { current_period_end: new Date(periodEnd * 1000).toISOString() }),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subId)
    .eq("environment", env);
  if (error) throw new WebhookRetryable(error.message);
}

async function handleChargeRefunded(charge: any, env: StripeEnv) {
  // Product decision: preserve access until `current_period_end` so a
  // refund doesn't yank features mid-session. Just flag past_due so the
  // UI shows a warning and the customer can resubscribe/cancel cleanly.
  const subId =
    charge.invoice && typeof charge.invoice === "object"
      ? charge.invoice.subscription
      : null;
  if (!subId || typeof subId !== "string") {
    console.log("charge.refunded without subscription context:", charge.id);
    return;
  }
  const { error } = await getSupabase()
    .from("subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subId)
    .eq("environment", env);
  if (error) throw new WebhookRetryable(error.message);
}

async function handleChargeDispute(dispute: any, env: StripeEnv) {
  // Chargebacks are rare and manual — log with enough context for
  // support to investigate. Don't auto-revoke; Stripe handles the funds
  // side and support decides on access.
  console.warn("charge.dispute.created", {
    disputeId: dispute.id,
    charge: dispute.charge,
    amount: dispute.amount,
    reason: dispute.reason,
    env,
  });
}

async function handleCheckoutSessionCompleted(session: any, env: StripeEnv) {
  // Only one-time payments create credit grants. Subscription checkouts
  // are handled by customer.subscription.created / .updated events.
  if (session.mode !== "payment") return;
  if (session.payment_status !== "paid") {
    console.log("checkout.session.completed unpaid, skipping:", session.id);
    return;
  }
  const userId: string | undefined = session.metadata?.userId;
  const packPriceId: string | undefined = session.metadata?.packPriceId;
  if (!userId || !packPriceId) {
    console.log("Non-pack one-time payment (no userId/packPriceId), skipping:", session.id);
    return;
  }
  // Server-authoritative pack resolution — never trust client-supplied amounts.
  const pack = packByPriceId(packPriceId);
  if (!pack) {
    console.warn("Unknown pack priceId on completed session:", packPriceId, session.id);
    return;
  }
  const { error } = await getSupabase()
    .from("usage_credit_grants")
    .insert({
      user_id: userId,
      environment: env,
      feature: pack.feature,
      amount_granted: pack.amount,
      stripe_session_id: session.id,
      price_id: pack.priceId,
    });
  if (error) {
    // Unique-violation on stripe_session_id means we've already granted
    // credits for this session — safe to ignore for idempotency.
    if ((error as { code?: string }).code === "23505") {
      console.log("Credit grant already exists for session:", session.id);
      return;
    }
    throw new WebhookRetryable(error.message);
  }
  console.log(`Granted ${pack.amount} ${pack.feature} to user ${userId} (session ${session.id})`);
}

async function handleWebhookEvent(event: { type: string; data: { object: any } }, env: StripeEnv) {
  switch (event.type) {
    case "customer.subscription.created":
      await handleSubscriptionCreated(event.data.object, env);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object, env);
      break;
    case "invoice.paid":
      await handleInvoicePaid(event.data.object, env);
      break;
    case "charge.refunded":
      await handleChargeRefunded(event.data.object, env);
      break;
    case "charge.dispute.created":
      await handleChargeDispute(event.data.object, env);
      break;
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(event.data.object, env);
      break;
    case "customer.subscription.trial_will_end":
      console.log("Ack event:", event.type);
      break;
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook missing/invalid ?env query param:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;

        let event: { type: string; data: { object: any }; id: string };
        try {
          event = await verifyWebhook(request, env);
        } catch (e) {
          console.error("Webhook verification failed:", e);
          return new Response("Webhook verification failed", { status: 400 });
        }

        // Idempotency: reserve the event id before running the handler.
        const supabase = getSupabase();
        const { error: insertErr } = await supabase
          .from("processed_webhook_events")
          .insert({
            event_id: event.id,
            event_type: event.type,
            environment: env,
          });
        if (insertErr) {
          // Duplicate primary key -> already processed. Ack.
          if ((insertErr as { code?: string }).code === "23505") {
            return Response.json({ received: true, duplicate: true });
          }
          console.error("processed_webhook_events insert failed:", insertErr);
          return new Response("DB error", { status: 500 });
        }

        try {
          await handleWebhookEvent(event, env);
          return Response.json({ received: true });
        } catch (e) {
          // Roll back the idempotency row so Stripe can retry.
          await supabase.from("processed_webhook_events").delete().eq("event_id", event.id);
          const retryable = e instanceof WebhookRetryable;
          console.error("Webhook handler error:", e);
          return new Response(retryable ? "Retry" : "Handler error", {
            status: retryable ? 500 : 400,
          });
        }
      },
    },
  },
});
