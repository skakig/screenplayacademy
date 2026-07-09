import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/brand/BrandLogo";

export const Route = createFileRoute("/refund")({
  head: () => ({
    meta: [
      { title: "Refund Policy — SceneSmith Studio" },
      { name: "description", content: "30-day money-back guarantee. How to request a refund from SceneSmith Studio, operated by Joshua Ellis." },
      { property: "og:title", content: "Refund Policy — SceneSmith Studio" },
      { property: "og:description", content: "30-day money-back guarantee on SceneSmith Studio subscriptions." },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "https://scenesmithstudio.com/refund" }],
  }),
  component: RefundPage,
});

function RefundPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/"><BrandLogo /></Link>
          <nav className="flex gap-4 text-sm">
            <Link to="/pricing">Pricing</Link>
            <Link to="/auth">Sign in</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-12 prose prose-invert prose-headings:font-serif">
        <h1>Refund Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

        <h2>30-day money-back guarantee</h2>
        <p>
          SceneSmith Studio, operated by <strong>Joshua Ellis</strong>, offers a <strong>30-day
          money-back guarantee</strong> on paid subscriptions. If you're not satisfied with your purchase,
          you can request a full refund within <strong>30 days</strong> of your order date, for any reason.
        </p>

        <h2>How to request a refund</h2>
        <p>
          Payments are processed by <strong>Stripe</strong>. To request a refund, contact us via the
          support channel in your account settings with the email address you used at checkout and the
          date of the charge. We'll process eligible refunds through Stripe within a few business days.
        </p>

        <h2>Renewals and cancellations</h2>
        <p>
          Subscriptions renew automatically at the end of each billing period. You can cancel at any time
          from Settings → Manage subscription; your access continues until the end of the paid period. To
          request a refund for a recent renewal, use the process above within 30 days of the renewal
          charge.
        </p>

        <h2>Questions</h2>
        <p>
          If you have any questions about this policy, contact Joshua Ellis via the support channel in your
          account settings.
        </p>
      </main>
      <footer className="border-t border-border/40 py-8 mt-12">
        <div className="max-w-4xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Joshua Ellis — SceneSmith Studio</span>
          <div className="flex gap-4">
            <Link to="/pricing">Pricing</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/refund">Refund</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
