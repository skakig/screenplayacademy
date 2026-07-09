import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { createCustomerPortalSession } from "@/lib/customerPortal.functions";
import { getStripeEnvironment } from "@/lib/stripe";

/**
 * One-line banner shown while a subscription is in Stripe's payment-retry window
 * (`past_due`). Access is preserved; this just nudges the user to fix the card.
 */
export function DunningBanner() {
  const { isPastDue } = useSubscription();
  const openPortal = useServerFn(createCustomerPortalSession);
  const [busy, setBusy] = useState(false);

  if (!isPastDue) return null;

  const handleClick = async () => {
    setBusy(true);
    try {
      const result = await openPortal({
        data: { environment: getStripeEnvironment(), returnUrl: window.location.href },
      });
      if ("error" in result) throw new Error(result.error);
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open billing portal");
    } finally {
      setBusy(false);
    }
  };



  return (
    <div className="w-full bg-orange-100 border-b border-orange-300 px-4 py-2 text-center text-sm text-orange-900 flex items-center justify-center gap-3">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>Your last payment failed. Update your card to keep your subscription active.</span>
      <button
        onClick={handleClick}
        disabled={busy}
        className="underline font-medium hover:no-underline disabled:opacity-60"
      >
        {busy ? "Opening…" : "Update payment method"}
      </button>
    </div>
  );
}
