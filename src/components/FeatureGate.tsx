import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSubscription } from "@/hooks/useSubscription";
import {
  FEATURE_LABEL,
  TIER_LABEL,
  hasFeature,
  minTierFor,
  type Feature,
} from "@/lib/entitlements";

type Props = {
  feature: Feature;
  children: ReactNode;
  /** Render nothing while loading (default: renders children optimistically). */
  fallbackWhileLoading?: ReactNode;
  /** Fully replace the upgrade prompt with custom content. */
  renderLocked?: (info: { requiredTier: string; feature: Feature }) => ReactNode;
};

/**
 * Client-side entitlement gate. UX ONLY — the real check runs server-side.
 * Never rely on this alone to protect sensitive data or actions.
 */
export function FeatureGate({
  feature,
  children,
  fallbackWhileLoading,
  renderLocked,
}: Props) {
  const { loading, tier } = useSubscription();
  if (loading) return <>{fallbackWhileLoading ?? children}</>;
  if (hasFeature(tier, feature)) return <>{children}</>;

  const required = minTierFor(feature);
  if (renderLocked) return <>{renderLocked({ requiredTier: TIER_LABEL[required], feature })}</>;

  return (
    <Card className="p-6 text-center space-y-4 border-dashed">
      <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
        <Lock className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h3 className="font-semibold">Upgrade to unlock {FEATURE_LABEL[feature]}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {FEATURE_LABEL[feature]} is included in the {TIER_LABEL[required]} plan and above.
        </p>
      </div>
      <Button asChild>
        <Link to="/pricing">See plans</Link>
      </Button>
    </Card>
  );
}
