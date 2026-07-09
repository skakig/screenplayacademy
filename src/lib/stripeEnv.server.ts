import type { StripeEnv } from "@/lib/stripe.server";

/**
 * Server-side mirror of `getStripeEnvironment()` in `src/lib/stripe.ts`.
 * Derived from the client token prefix so server reads select the same
 * environment rows the client sees. Preview → sandbox, live build → live.
 */
export function serverStripeEnv(): StripeEnv {
  const token = process.env.VITE_PAYMENTS_CLIENT_TOKEN ?? "";
  if (token.startsWith("pk_live_")) return "live";
  return "sandbox";
}
