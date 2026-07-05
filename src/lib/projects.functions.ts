import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { tierFromPriceId, hasFeature } from "@/lib/entitlements";

const CreateInput = z.object({
  title: z.string().trim().min(1).max(200),
  project_type: z.string().trim().min(1).max(60),
  genre: z.string().trim().max(120).optional().default(""),
  tone: z.string().trim().max(300).optional().default(""),
  target_length: z.string().trim().max(80).optional().default(""),
  logline: z.string().trim().max(2000).optional().default(""),
  ai_help_level: z.string().trim().max(40).optional().default("Balanced"),
});

/**
 * Create a project with server-side free-tier enforcement.
 * Free tier = 1 project. Any paid tier = unlimited.
 * Throws a 402-shaped error the UI can catch and turn into an upgrade CTA.
 */
export const createProjectGated = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    // Determine current tier from the user's most recent active subscription row.
    const { data: subRow } = await context.supabase
      .from("subscriptions")
      .select("price_id, status, current_period_end, environment")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let tier: ReturnType<typeof tierFromPriceId> = "free";
    if (subRow) {
      const periodOk =
        !subRow.current_period_end ||
        new Date(subRow.current_period_end as string).getTime() > Date.now();
      const isActive =
        (["active", "trialing", "past_due"].includes(subRow.status as string) && periodOk) ||
        (subRow.status === "canceled" && periodOk);
      if (isActive) tier = tierFromPriceId(subRow.price_id as string | null);
    }

    // Free tier: enforce 1-project cap.
    if (!hasFeature(tier, "extra_projects")) {
      const { count, error: cntErr } = await context.supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId);
      if (cntErr) throw new Error(cntErr.message);
      if ((count ?? 0) >= 1) {
        throw new Error(
          "FREE_TIER_LIMIT: Free plan is limited to 1 project. Upgrade to Creator or higher to add more.",
        );
      }
    }

    const { data: created, error } = await context.supabase
      .from("projects")
      .insert({ ...data, user_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return created;
  });
