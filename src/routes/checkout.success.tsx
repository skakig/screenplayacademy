import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useSubscription } from "@/hooks/useSubscription";
import { TIER_LABEL } from "@/lib/entitlements";

export const Route = createFileRoute("/checkout/success")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Welcome to SceneSmith Studio" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutSuccess,
});

function CheckoutSuccess() {
  // Stripe's embedded checkout returns after payment, but the subscription
  // row is created by the async webhook — usually within 1–5s. Poll every
  // 1.5s (up to ~30s) so the user sees their new plan appear instead of a
  // stale "Free" flash.
  const { tier, refetch, loading } = useSubscription();
  const [waited, setWaited] = useState(0);

  useEffect(() => {
    if (tier !== "free") return;
    if (waited >= 30_000) return;
    const t = setTimeout(() => {
      refetch();
      setWaited((w) => w + 1500);
    }, 1500);
    return () => clearTimeout(t);
  }, [tier, waited, refetch]);

  const confirmed = tier !== "free";
  const stillWaiting = !confirmed && waited < 30_000;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60 bg-background/60 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center">
          <BrandLogo size="sm" />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 h-14 w-14 rounded-full bg-primary/15 ring-1 ring-primary/40 flex items-center justify-center">
            {confirmed ? (
              <Check className="h-7 w-7 text-primary" />
            ) : (
              <Loader2 className="h-7 w-7 text-primary animate-spin" />
            )}
          </div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground mb-3">
            {confirmed ? "Your studio is open" : stillWaiting ? "Almost there" : "Confirmation pending"}
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight">
            {confirmed
              ? `Welcome to the ${TIER_LABEL[tier]} plan.`
              : stillWaiting
                ? "Confirming your subscription…"
                : "Payment received."}
          </h1>
          <p className="text-muted-foreground mt-3">
            {confirmed
              ? "Your subscription is active. Head to the Studio Lobby and pick up where your story begins."
              : stillWaiting
                ? "This usually takes a few seconds. You can head into the studio now — the plan will update automatically."
                : loading
                  ? "Still checking…"
                  : "We received your payment. If your plan doesn't show up in a minute, refresh this page or reach out and we'll sort it out."}
          </p>
          <div className="mt-8 flex justify-center gap-2">
            <Link to="/dashboard">
              <Button>Open Studio Lobby</Button>
            </Link>
            <Link to="/projects">
              <Button variant="outline">Script Vault</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
