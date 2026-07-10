import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Loader2, Tag } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { getStripeEnvironment, isStripeConfigured } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { createCustomerPortalSession } from "@/lib/customerPortal.functions";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — SceneSmith Studio" },
      { name: "description", content: "Simple, transparent pricing for storytellers. Start free, then upgrade — Creator, Pro, and Studio plans, monthly or yearly." },
      { property: "og:title", content: "Pricing — SceneSmith Studio" },
      { property: "og:description", content: "Start free and upgrade when you're ready to pitch. Save ~17% with yearly billing." },
      { property: "og:url", content: "https://scenesmithstudio.com/pricing" },
      { name: "twitter:title", content: "Pricing — SceneSmith Studio" },
      { name: "twitter:description", content: "Compare Creator, Pro, and Studio — monthly or yearly." },
    ],
    links: [
      { rel: "canonical", href: "https://scenesmithstudio.com/pricing" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    promo: typeof s.promo === "string" ? s.promo : undefined,
  }),
  component: Pricing,
});

type PriceId =
  | "creator_monthly" | "pro_monthly" | "studio_monthly"
  | "creator_yearly" | "pro_yearly" | "studio_yearly";

type Tier = {
  name: string;
  monthly: { price: string; cadence: string; priceId?: PriceId };
  yearly: { price: string; cadence: string; priceId?: PriceId; note?: string };
  features: string[];
  cta: string;
  to?: "/auth";
  highlight: boolean;
};

const TIERS: Tier[] = [
  {
    name: "Free",
    monthly: { price: "$0", cadence: "forever" },
    yearly: { price: "$0", cadence: "forever" },
    features: ["1 project", "Basic editor", "5 AI assists / month", "3 characters", "Watermarked export"],
    cta: "Start Free", to: "/auth", highlight: false,
  },
  {
    name: "Creator",
    monthly: { price: "$19", cadence: "/month", priceId: "creator_monthly" },
    yearly: { price: "$190", cadence: "/year", priceId: "creator_yearly", note: "Save ~17%" },
    features: ["10 projects", "100 AI assists / month", "25 storyboard panels / month", "30 min AI table read / month", "PDF export", "Character bible", "Outline builder"],
    cta: "Choose Creator", highlight: true,
  },
  {
    name: "Pro",
    monthly: { price: "$49", cadence: "/month", priceId: "pro_monthly" },
    yearly: { price: "$490", cadence: "/year", priceId: "pro_yearly", note: "Save ~17%" },
    features: ["Unlimited projects", "500 AI assists / month", "100 storyboard panels / month", "180 min AI table read / month", "Sound effects", "Pitch package export", "Collaboration-ready", "Script doctor reports"],
    cta: "Choose Pro", highlight: false,
  },
  {
    name: "Studio",
    monthly: { price: "$149", cadence: "/month", priceId: "studio_monthly" },
    yearly: { price: "$1,490", cadence: "/year", priceId: "studio_yearly", note: "Save ~17%" },
    features: ["Team workspace", "Shared projects", "Admin seats", "1,000+ AI assists / month", "Bulk table reads", "Advanced pitch packages", "School / studio workflows"],
    cta: "Choose Studio", highlight: false,
  },
];

function Pricing() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { openCheckout, closeCheckout, isOpen, checkoutElement } = useStripeCheckout();
  const [pending, setPending] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [cadence, setCadence] = useState<"monthly" | "yearly">("yearly");
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState(search.promo ?? "");
  const [promoCode, setPromoCode] = useState<string | undefined>(search.promo);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser({ id: data.user.id, email: data.user.email ?? undefined });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email ?? undefined } : null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const checkoutBlocked = !isStripeConfigured();
  const { isActive: hasActiveSub, tier: currentTier } = useSubscription();
  const openPortal = useServerFn(createCustomerPortalSession);

  const handleBuy = async (tier: Tier) => {
    const priceId = tier[cadence].priceId;
    if (!priceId) return;
    if (checkoutBlocked) {
      window.location.href = "mailto:hello@scenesmithstudio.com?subject=SceneSmith%20Studio%20paid%20plans%20waitlist";
      return;
    }
    if (!user) {
      toast.info("Sign in to subscribe.");
      navigate({ to: "/auth" });
      return;
    }
    if (hasActiveSub) {
      setPending(priceId);
      try {
        const result = await openPortal({
          data: { environment: getStripeEnvironment(), returnUrl: window.location.href },
        });
        if ("error" in result) throw new Error(result.error);
        toast.info(`You're already on ${currentTier}. Opening your billing portal to change plans.`);
        window.open(result.url, "_blank", "noopener,noreferrer");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't open billing portal");
      } finally {
        setPending(null);
      }
      return;
    }
    setPending(priceId);
    try {
      openCheckout({
        priceId,
        customerEmail: user.email,
        userId: user.id,
        returnUrl: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        promotionCode: promoCode,
      });
    } catch (e) {
      console.error(e);
      toast.error("Couldn't open checkout. Please try again.");
    } finally {
      setPending(null);
    }
  };

  void getStripeEnvironment;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60 bg-background/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <BrandLogo size="sm" />
          <Link to="/auth"><Button size="sm">Sign in</Button></Link>
        </div>
      </header>
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground mb-3">SceneSmith Studio · Pricing</p>
          <h1 className="font-display text-5xl font-bold tracking-tight">Pricing for every storyteller.</h1>
          <p className="text-muted-foreground mt-3">Write free. Upgrade when you're ready to pitch.</p>
          {checkoutBlocked && (
            <div className="mt-6 mx-auto max-w-xl text-sm rounded-lg border border-amber-400/40 bg-amber-100/70 text-amber-900 px-4 py-3">
              Paid plans are launching soon. Join the waitlist and we'll email you the moment checkout opens.
            </div>
          )}
        </div>

        {/* Monthly / Yearly toggle */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="inline-flex items-center rounded-full border border-border/60 bg-card/40 p-1">
            <button
              onClick={() => setCadence("monthly")}
              className={`px-4 py-1.5 text-sm rounded-full transition ${cadence === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              aria-pressed={cadence === "monthly"}
            >
              Monthly
            </button>
            <button
              onClick={() => setCadence("yearly")}
              className={`px-4 py-1.5 text-sm rounded-full transition flex items-center gap-1.5 ${cadence === "yearly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              aria-pressed={cadence === "yearly"}
            >
              Yearly
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cadence === "yearly" ? "bg-primary-foreground/20" : "bg-primary/15 text-primary"}`}>
                Save ~17%
              </span>
            </button>
          </div>

          <button
            onClick={() => setPromoOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            <Tag className="h-3 w-3" />
            {promoCode ? `Promo applied: ${promoCode}` : "Have a code?"}
          </button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {TIERS.map((t) => {
            const p = t[cadence];
            const isPending = pending === p.priceId;
            return (
              <div
                key={t.name}
                className={`p-6 rounded-xl border bg-card/40 flex flex-col ${t.highlight ? "border-primary/60 shadow-lg shadow-primary/15 ring-1 ring-primary/30" : "border-border/60"}`}
              >
                {t.highlight && <div className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-2">Most popular</div>}
                <h2 className="font-display text-2xl font-bold">{t.name}</h2>
                <div className="mt-2 mb-1">
                  <span className="text-3xl font-bold">{p.price}</span>
                  <span className="text-muted-foreground text-sm ml-1">{p.cadence}</span>
                </div>
                <div className="mb-4 h-4 text-[11px] text-primary">{cadence === "yearly" ? p.note ?? "" : ""}</div>
                <ul className="space-y-2 mb-6 flex-1">
                  {t.features.map((f) => (
                    <li key={f} className="text-sm flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /><span>{f}</span>
                    </li>
                  ))}
                </ul>
                {t.to ? (
                  <Link to={t.to}>
                    <Button className="w-full" variant={t.highlight ? "default" : "outline"}>{t.cta} <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Button>
                  </Link>
                ) : (
                  <Button
                    className="w-full"
                    variant={t.highlight ? "default" : "outline"}
                    disabled={isPending}
                    onClick={() => handleBuy(t)}
                  >
                    {isPending ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Opening checkout…</>
                    ) : checkoutBlocked ? (
                      <>Join the waitlist <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></>
                    ) : (
                      <>{t.cta} <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></>
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Promo code dialog */}
      <Dialog open={promoOpen} onOpenChange={setPromoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Apply a promo code</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value.trim().toUpperCase())}
              placeholder="LAUNCH50"
              maxLength={64}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              The code will apply automatically at checkout. If it's invalid, checkout will proceed at full price.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => { setPromoCode(undefined); setPromoInput(""); setPromoOpen(false); }}
              >
                Clear
              </Button>
              <Button
                onClick={() => {
                  setPromoCode(promoInput || undefined);
                  setPromoOpen(false);
                  if (promoInput) toast.success(`Promo ${promoInput} will apply at checkout`);
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isOpen} onOpenChange={(o) => { if (!o) closeCheckout(); }}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Complete your subscription</DialogTitle>
          </DialogHeader>
          <div className="p-4">{checkoutElement}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
