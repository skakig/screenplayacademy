import type { StripeEnv } from "@/lib/stripe.server";

/**
 * Server-side mirror of `getStripeEnvironment()` in `src/lib/stripe.ts`.
 * Derives the Stripe environment from the publishable-token prefix so
 * server-side entitlement/metering reads select the same rows the client sees.
 */
export function serverStripeEnv(): StripeEnv {
  const token = process.env.VITE_PAYMENTS_CLIENT_TOKEN ?? "";
  if (token.startsWith("pk_test_")) return "sandbox";
  if (token.startsWith("pk_live_")) return "live";
  // Default to sandbox on preview builds where the token may not be injected
  // into the server env; live must be explicit via a pk_live_ token.
  return "sandbox";
}
