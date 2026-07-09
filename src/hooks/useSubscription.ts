import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment, isStripeConfigured } from "@/lib/stripe";
import { tierFromPriceId, type Tier } from "@/lib/entitlements";

type Row = {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string | null;
  product_id: string | null;
  price_id: string | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  environment: string;
  created_at: string;
};

async function fetchSubscription(userId: string, env: string): Promise<Row | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("environment", env)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as Row | null) ?? null;
}

export type SubscriptionState = {
  loading: boolean;
  subscription: Row | null;
  tier: Tier;
  isActive: boolean;
  isPastDue: boolean;
  isCanceledInGrace: boolean;
  userId: string | null;
  environment: "sandbox" | "live";
  refetch: () => void;
};

export function useSubscription(): SubscriptionState {
  // If Stripe isn't configured (missing token), fall back to sandbox for
  // reads so free-tier UI still works without throwing at module load.
  const environment: "sandbox" | "live" = isStripeConfigured()
    ? getStripeEnvironment()
    : "sandbox";
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const query = useQuery({
    queryKey: ["subscription", userId, environment],
    queryFn: () => fetchSubscription(userId!, environment),
    enabled: !!userId,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`sub-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscriptions",
          filter: `user_id=eq.${userId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["subscription", userId, environment] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, environment, qc]);

  const row = query.data ?? null;

  const derived = useMemo(() => {
    if (!row) {
      return {
        tier: "free" as Tier,
        isActive: false,
        isPastDue: false,
        isCanceledInGrace: false,
      };
    }
    const periodOk =
      !row.current_period_end || new Date(row.current_period_end).getTime() > Date.now();
    const isActive =
      (["active", "trialing", "past_due"].includes(row.status) && periodOk) ||
      (row.status === "canceled" && periodOk);
    const isPastDue = row.status === "past_due" && periodOk;
    const isCanceledInGrace = row.status === "canceled" && periodOk;
    return {
      tier: isActive ? tierFromPriceId(row.price_id) : ("free" as Tier),
      isActive,
      isPastDue,
      isCanceledInGrace,
    };
  }, [row]);

  return {
    loading: query.isLoading,
    subscription: row,
    ...derived,
    userId,
    environment,
    refetch: () => qc.invalidateQueries({ queryKey: ["subscription", userId, environment] }),
  };
}
