import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { serverStripeEnv } from "@/lib/stripeEnv.server";

export const consumeUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      feature: "ai_assists" | "storyboard_panels" | "tableread_minutes";
      amount?: number;
    }) => ({
      feature: d.feature,
      amount: Math.max(1, Math.floor(d.amount ?? 1)),
    }),
  )
  .handler(async ({ data, context }) => {
    const environment = serverStripeEnv();
    const { data: used, error } = await context.supabase.rpc("consume_usage", {
      _feature: data.feature,
      _amount: data.amount,
      _environment: environment,
    });
    if (error) throw new Error(error.message);
    return { used: used as number };
  });

export const getUsageSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as Record<string, never>)
  .handler(async ({ context }) => {
    const environment = serverStripeEnv();
    const { data, error } = await context.supabase.rpc("get_usage_snapshot", {
      _environment: environment,
    });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
