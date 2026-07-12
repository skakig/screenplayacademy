// Fetch the latest Character Bible for a project to embed in a pitch export.
// Pro+ subscribers only. Throws PLAN_LIMIT so the UI can surface an upgrade CTA.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasFeature, tierFromPriceId } from "@/lib/entitlements";
import { serverStripeEnv } from "@/lib/stripeEnv.server";

export type PitchBibleEntry = {
  character_id: string;
  name: string;
  importance: string | null;
  aliases: string[];
  first_appearance: {
    document_id: string;
    segment_id: string;
    sequence: number;
    heading: string | null;
  } | null;
  speaking_segments: number;
  mention_segments: number;
  top_evidence: {
    segment_id: string;
    excerpt: string;
    confidence: number;
    document_id: string | null;
  }[];
};

export type PitchCharacterBible = {
  id: string;
  version: number;
  summary: string | null;
  created_at: string;
  entries: PitchBibleEntry[];
};

export const getPitchCharacterBible = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ project_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<PitchCharacterBible | null> => {
    const { supabase, userId } = context;

    // Resolve caller tier from the most recent subscription row in the
    // current Stripe environment. Mirrors createProjectGated.
    const environment = serverStripeEnv();
    const { data: subRow } = await supabase
      .from("subscriptions")
      .select("price_id, status, current_period_end")
      .eq("user_id", userId)
      .eq("environment", environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let tier: ReturnType<typeof tierFromPriceId> = "free";
    if (subRow) {
      const periodOk =
        !subRow.current_period_end ||
        new Date(subRow.current_period_end as string).getTime() > Date.now();
      const isActive =
        (["active", "trialing", "past_due"].includes(subRow.status as string) &&
          periodOk) ||
        (subRow.status === "canceled" && periodOk);
      if (isActive) tier = tierFromPriceId(subRow.price_id as string | null);
    }

    if (!hasFeature(tier, "pitch_character_bible")) {
      throw new Error(
        "PLAN_LIMIT: Including the Character Bible in pitch exports requires the Pro plan or higher.",
      );
    }

    // RLS on character_bibles scopes to the project owner/member.
    const { data: row, error } = await supabase
      .from("character_bibles")
      .select("id, version, summary, entries, created_at")
      .eq("project_id", data.project_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;

    return {
      id: row.id as string,
      version: row.version as number,
      summary: (row.summary as string | null) ?? null,
      created_at: row.created_at as string,
      entries: ((row.entries as unknown) as PitchBibleEntry[]) ?? [],
    };
  });
