import { type ReactNode } from "react";
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

  // While loading we optimistically render children to avoid a flash for
  // entitled users. Server-side gates will still reject if they turn out
  // not to be entitled.
  if (loading || hasFeature(tier, feature)) return <>{children}</>;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-16">
        <FeatureGate feature={feature}>{null}</FeatureGate>
      </div>
    </AppShell>
  );
}
