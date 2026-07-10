import { createServerFn } from "@tanstack/react-start";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";

type CheckoutSessionResult = { clientSecret: string } | { error: string };

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      priceId: string;
      quantity?: number;
      customerEmail?: string;
      userId?: string;
      returnUrl: string;
      environment: StripeEnv;
      promotionCode?: string;
    }) => {
      if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
      if (data.promotionCode !== undefined && !/^[a-zA-Z0-9_-]{2,64}$/.test(data.promotionCode)) {
        throw new Error("Invalid promotionCode");
      }
      return data;
    },
  )
  .handler(async ({ data }): Promise<CheckoutSessionResult> => {
    try {
      const stripe = createStripeClient(data.environment);

      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error("Price not found");
      const stripePrice = prices.data[0];
      const isRecurring = stripePrice.type === "recurring";

      const customerId =
        data.customerEmail || data.userId
          ? await resolveOrCreateCustomer(stripe, {
              email: data.customerEmail,
              userId: data.userId,
            })
          : undefined;

      let productDescription: string | undefined;
      if (!isRecurring) {
        const productId =
          typeof stripePrice.product === "string"
            ? stripePrice.product
            : (stripePrice.product as { id: string }).id;
        const product = await stripe.products.retrieve(productId);
        productDescription = product.name;
      }

      // Resolve a pre-applied promotion code (e.g. from /pricing?promo=LAUNCH50)
      // to a Stripe promotion_code id so the discount attaches automatically.
      let promotionCodeId: string | undefined;
      if (data.promotionCode) {
        const found = await stripe.promotionCodes.list({
          code: data.promotionCode,
          active: true,
          limit: 1,
        });
        if (found.data.length) promotionCodeId = found.data[0].id;
      }

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: data.quantity || 1 }],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        // Stripe calculates and collects tax; SceneSmith Studio handles
        // filing and remittance. +0.5% per transaction. Switch to
        // `managed_payments: { enabled: true }` once the seller opts
        // into end-to-end compliance handling.
        automatic_tax: { enabled: true },
        // Let users type any active Stripe promotion code on the checkout
        // form. Mutually exclusive with an explicit `discounts:` list.
        ...(promotionCodeId
          ? { discounts: [{ promotion_code: promotionCodeId }] }
          : { allow_promotion_codes: true }),
        ...(customerId && { customer: customerId }),
        ...(!isRecurring && {
          payment_intent_data: { description: productDescription },
        }),
        ...(data.userId && {
          // packPriceId lets the webhook resolve one-time credit-pack
          // purchases against the server-side CREDIT_PACKS catalog
          // without a follow-up Stripe API call.
          metadata: { userId: data.userId, packPriceId: data.priceId },
          ...(isRecurring && {
            subscription_data: { metadata: { userId: data.userId } },
          }),
        }),
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
