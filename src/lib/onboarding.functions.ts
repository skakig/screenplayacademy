import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getOnboarding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_onboarding")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

const UpsertInput = z.object({
  writer_experience_level: z.string().max(64).optional(),
  preferred_mode: z.enum(["guided", "studio"]).optional(),
  coaching_level: z.enum(["off", "gentle", "active", "teaching"]).optional(),
  app_walkthrough_completed: z.boolean().optional(),
  first_project_created: z.boolean().optional(),
});

export const upsertOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("user_onboarding")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (existing) {
      const { data: updated, error } = await context.supabase
        .from("user_onboarding")
        .update(data)
        .eq("user_id", context.userId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return updated;
    }
    const { data: created, error } = await context.supabase
      .from("user_onboarding")
      .insert({ ...data, user_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const markWalkthroughComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("user_onboarding")
      .update({ app_walkthrough_completed: true })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
