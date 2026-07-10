import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Mic2, Loader2 } from "lucide-react";
import {
  CREDIT_PACKS,
  packsByFeature,
  type CreditFeature,
  type CreditPack,
} from "@/lib/creditPacks";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { supabase } from "@/integrations/supabase/client";

interface BuyCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preselect a tab based on which cap the user hit. */
  focus?: CreditFeature;
}

function formatUsd(n: number): string {
  return `$${n.toFixed(0)}`;
}

export function BuyCreditsDialog({ open, onOpenChange, focus }: BuyCreditsDialogProps) {
  const [tab, setTab] = useState<CreditFeature>(focus ?? "ai_tokens");
  const [buying, setBuying] = useState<string | null>(null);
  const { openCheckout, checkoutElement, closeCheckout } = useStripeCheckout();

  const handleBuy = async (pack: CreditPack) => {
    setBuying(pack.priceId);
    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      openCheckout({
        priceId: pack.priceId,
        quantity: 1,
        customerEmail: user?.email,
        userId: user?.id,
        returnUrl: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}&pack=${pack.priceId}`,
      });
      // Close the picker so the embedded checkout is unambiguous.
      onOpenChange(false);
    } finally {
      setBuying(null);
    }
  };

  const packs = packsByFeature(tab);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Buy more credits</DialogTitle>
            <DialogDescription>
              One-time top-ups that never expire. Credits kick in automatically
              once your monthly plan cap is reached.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <button
              type="button"
              onClick={() => setTab("ai_tokens")}
              className={
                "flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition " +
                (tab === "ai_tokens"
                  ? "border-primary/60 bg-primary/10 text-foreground"
                  : "border-border/50 bg-transparent text-muted-foreground hover:bg-muted/40")
              }
            >
              <Sparkles className="h-4 w-4" /> AI Credits
            </button>
            <button
              type="button"
              onClick={() => setTab("tts_characters")}
              className={
                "flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition " +
                (tab === "tts_characters"
                  ? "border-primary/60 bg-primary/10 text-foreground"
                  : "border-border/50 bg-transparent text-muted-foreground hover:bg-muted/40")
              }
            >
              <Mic2 className="h-4 w-4" /> Table Read Credits
            </button>
          </div>

          <div className="grid gap-3">
            {packs.map((pack) => (
              <Card key={pack.priceId} className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium">{pack.label}</div>
                  <div className="text-xs text-muted-foreground">{pack.subtitle}</div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleBuy(pack)}
                  disabled={buying !== null}
                >
                  {buying === pack.priceId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    formatUsd(pack.usd)
                  )}
                </Button>
              </Card>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground pt-1">
            Prices exclude tax where applicable. Credits are non-refundable
            once used.
          </p>
        </DialogContent>
      </Dialog>

      {/* Embedded Stripe checkout renders in its own modal */}
      {checkoutElement ? (
        <Dialog open onOpenChange={(o) => !o && closeCheckout()}>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Complete purchase</DialogTitle>
            </DialogHeader>
            {checkoutElement}
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

// Re-export the catalog constant for tests / diagnostics.
export { CREDIT_PACKS };
