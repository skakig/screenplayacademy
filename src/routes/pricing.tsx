import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PublicSiteHeader } from "@/components/brand/PublicSiteHeader";
import { PublicSiteFooter } from "@/components/brand/PublicSiteFooter";
import { BRAND_DOMAIN, BRAND_NAME, BRAND_SOCIAL_IMAGE } from "@/lib/brand";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: `Pricing — ${BRAND_NAME}` },
      {
        name: "description",
        content:
          "Simple, transparent pricing for SceneSmith Studio. Start free, then upgrade as your creative practice or team grows.",
      },
      { property: "og:title", content: `Pricing — ${BRAND_NAME}` },
      {
        property: "og:description",
        content:
          "Compare Free, Creator, Pro, and Studio plans for a premium storytelling workspace with AI-assisted tools.",
      },
      { property: "og:url", content: `${BRAND_DOMAIN}/pricing` },
      { property: "og:image", content: BRAND_SOCIAL_IMAGE },
      { name: "twitter:title", content: `Pricing — ${BRAND_NAME}` },
      {
        name: "twitter:description",
        content:
          "Compare Free, Creator, Pro, and Studio plans for a premium storytelling workspace with AI-assisted tools.",
      },
      { name: "twitter:image", content: BRAND_SOCIAL_IMAGE },
    ],
    links: [{ rel: "canonical", href: `${BRAND_DOMAIN}/pricing` }],
  }),
  component: Pricing,
});

const TIERS = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    features: [
      "1 project",
      "Core writing workspace",
      "5 AI assists / month",
      "3 characters",
      "Watermarked export",
    ],
    cta: "Start Free",
    to: "/auth" as const,
    highlight: false,
  },
  {
    name: "Creator",
    price: "$19",
    cadence: "/month",
    features: [
      "10 projects",
      "100 AI assists / month",
      "25 storyboard panels / month",
      "30 min AI table read / month",
      "PDF export",
      "Character bible",
      "Outline builder",
    ],
    cta: "Choose Creator",
    highlight: true,
  },
  {
    name: "Pro",
    price: "$49",
    cadence: "/month",
    features: [
      "Unlimited projects",
      "500 AI assists / month",
      "100 storyboard panels / month",
      "180 min AI table read / month",
      "Sound effects",
      "Pitch package export",
      "Collaboration-ready",
      "Script doctor reports",
    ],
    cta: "Choose Pro",
    highlight: false,
  },
  {
    name: "Studio",
    price: "$149",
    cadence: "/month",
    features: [
      "Team workspace",
      "Shared projects",
      "Admin seats",
      "1,000+ AI assists / month",
      "Bulk table reads",
      "Advanced pitch packages",
      "School / studio workflows",
    ],
    cta: "Contact us",
    highlight: false,
  },
];

function Pricing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicSiteHeader />
      <main>
        <section className="border-b border-border/50 bg-[linear-gradient(180deg,rgba(212,162,58,0.08),transparent_34%)]">
          <div className="mx-auto max-w-6xl px-4 py-16 text-center lg:py-20">
            <p className="text-xs uppercase tracking-[0.24em] text-primary">Pricing</p>
            <h1 className="mt-3 font-display text-5xl font-semibold md:text-6xl">
              Choose the studio that fits your practice.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              Start free. Upgrade when you want more room for projects, AI-assisted development,
              storyboards, table reads, and team workflows.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 lg:py-18">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`flex h-full flex-col rounded-[1.5rem] border bg-card/40 p-6 ${
                  tier.highlight
                    ? "border-primary/60 shadow-[0_24px_80px_-30px_rgba(212,162,58,0.5)] ring-1 ring-primary/25"
                    : "border-border/60"
                }`}
              >
                {tier.highlight ? (
                  <div className="mb-3 text-[11px] uppercase tracking-[0.22em] text-primary">
                    Most popular
                  </div>
                ) : null}
                <h2 className="font-display text-3xl font-semibold">{tier.name}</h2>
                <div className="mt-3 mb-5">
                  <span className="text-4xl font-semibold text-foreground">{tier.price}</span>
                  <span className="ml-1 text-sm text-muted-foreground">{tier.cadence}</span>
                </div>
                <ul className="mb-8 flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm leading-6 text-muted-foreground"
                    >
                      <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {tier.to ? (
                  <Link to={tier.to}>
                    <Button className="w-full" variant={tier.highlight ? "default" : "outline"}>
                      {tier.cta} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </Link>
                ) : (
                  <Button
                    className="w-full"
                    variant={tier.highlight ? "default" : "outline"}
                    onClick={() =>
                      toast.info("Checkout coming soon — your account is being prepared.")
                    }
                  >
                    {tier.cta} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
