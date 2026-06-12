import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand/BrandLogo";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — SceneSmith Studio" },
      { name: "description", content: "Simple, transparent pricing for storytellers. Start free, then upgrade as your projects grow — Creator, Pro, and Studio plans for screenplays, novels, worlds, comedy, and audio." },
      { property: "og:title", content: "Pricing — SceneSmith Studio" },
      { property: "og:description", content: "Start free and upgrade when you're ready to pitch. Compare Creator, Pro, and Studio plans across the writer's toolbox." },
      { property: "og:url", content: "https://scenesmithstudio.com/pricing" },
      { name: "twitter:title", content: "Pricing — SceneSmith Studio" },
      { name: "twitter:description", content: "Start free and upgrade when you're ready to pitch. Compare Creator, Pro, and Studio plans." },
    ],
    links: [
      { rel: "canonical", href: "https://scenesmithstudio.com/pricing" },
    ],
  }),
  component: Pricing,
});

const TIERS = [
  {
    name: "Free", price: "$0", cadence: "forever",
    features: ["1 project", "Basic editor", "5 AI assists / month", "3 characters", "Watermarked export"],
    cta: "Start Free", to: "/auth" as const, highlight: false,
  },
  {
    name: "Creator", price: "$19", cadence: "/month",
    features: ["10 projects", "100 AI assists / month", "25 storyboard panels / month", "30 min AI table read / month", "PDF export", "Character bible", "Outline builder"],
    cta: "Choose Creator", highlight: true,
  },
  {
    name: "Pro", price: "$49", cadence: "/month",
    features: ["Unlimited projects", "500 AI assists / month", "100 storyboard panels / month", "180 min AI table read / month", "Sound effects", "Pitch package export", "Collaboration-ready", "Script doctor reports"],
    cta: "Choose Pro", highlight: false,
  },
  {
    name: "Studio", price: "$149", cadence: "/month",
    features: ["Team workspace", "Shared projects", "Admin seats", "1,000+ AI assists / month", "Bulk table reads", "Advanced pitch packages", "School / studio workflows"],
    cta: "Contact us", highlight: false,
  },
];

function Pricing() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60 bg-background/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <BrandLogo size="sm" />
          <Link to="/auth"><Button size="sm">Sign in</Button></Link>
        </div>
      </header>
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground mb-3">SceneSmith Studio · Pricing</p>
          <h1 className="font-display text-5xl font-bold tracking-tight">Pricing for every storyteller.</h1>
          <p className="text-muted-foreground mt-3">Write free. Upgrade when you're ready to pitch.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={`p-6 rounded-xl border bg-card/40 flex flex-col ${t.highlight ? "border-primary/60 shadow-lg shadow-primary/15 ring-1 ring-primary/30" : "border-border/60"}`}
            >
              {t.highlight && <div className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-2">Most popular</div>}
              <h3 className="font-display text-2xl font-bold">{t.name}</h3>
              <div className="mt-2 mb-4">
                <span className="text-3xl font-bold">{t.price}</span>
                <span className="text-muted-foreground text-sm ml-1">{t.cadence}</span>
              </div>
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
                  onClick={() => toast.info("Checkout coming soon — your account is being prepared.")}
                >
                  {t.cta} <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
