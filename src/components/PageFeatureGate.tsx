import { type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { FeatureGate } from "@/components/FeatureGate";
import { useSubscription } from "@/hooks/useSubscription";
import { hasFeature, type Feature } from "@/lib/entitlements";

/**
 * Page-level entitlement wrapper. If the user has the feature, renders `children`.
 * Otherwise renders the shell + a FeatureGate upgrade card in the main area.
 * Purely UX — server-side is still the source of truth.
 */
export function PageFeatureGate({
  feature,
  children,
}: {
  feature: Feature;
  children: ReactNode;
}) {
  const { loading, tier } = useSubscription();

  // While loading show a small spinner instead of optimistically rendering
  // the paid page — otherwise un-entitled users see the premium UI flash
  // for a beat on hard refresh before it collapses into the upgrade card.
  if (loading) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto px-4 py-24 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm">Checking your plan…</span>
        </div>
      </AppShell>
    );
  }

  if (hasFeature(tier, feature)) return <>{children}</>;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-16">
        <FeatureGate feature={feature}>{null}</FeatureGate>
      </div>
    </AppShell>
  );
}

