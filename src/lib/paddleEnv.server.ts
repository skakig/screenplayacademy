import type { PaddleEnv } from "@/lib/paddle.server";

/**
 * Server-side mirror of `getPaddleEnvironment()` in `src/lib/paddle.ts`.
 * Derives the Paddle environment from the same client token prefix so that
 * server-side entitlement/metering reads select the same rows the client sees.
 *
 * On preview builds the token starts with `test_` → sandbox.
 * On the live build the token is swapped to `live_…` → live.
 */
export function serverPaddleEnv(): PaddleEnv {
  const token = process.env.VITE_PAYMENTS_CLIENT_TOKEN ?? "";
  return token.startsWith("test_") ? "sandbox" : "live";
}
