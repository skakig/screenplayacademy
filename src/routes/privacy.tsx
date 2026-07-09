import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/brand/BrandLogo";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Notice — SceneSmith Studio" },
      { name: "description", content: "How SceneSmith Studio, operated by Joshua Ellis, collects, uses, and protects your personal data." },
      { property: "og:title", content: "Privacy Notice — SceneSmith Studio" },
      { property: "og:description", content: "How we handle your personal data." },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "https://scenesmithstudio.com/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
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
        <h1>Privacy Notice</h1>
        <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

        <h2>1. Who we are</h2>
        <p>
          SceneSmith Studio (the "Service") is operated by <strong>Joshua Ellis</strong>, a sole proprietor
          trading as SceneSmith Studio. Joshua Ellis is the <strong>data controller</strong> for personal
          data processed through the Service.
        </p>

        <h2>2. Personal data we collect</h2>
        <ul>
          <li><strong>Account data</strong>: name, email address, hashed password or OAuth identifier, profile picture.</li>
          <li><strong>Content you create</strong>: screenplays, characters, notes, pitch materials, storyboards, table-read audio, and other project content.</li>
          <li><strong>Collaboration data</strong>: invitations, comments, roles, and activity within shared projects.</li>
          <li><strong>Support messages</strong>: content of messages you send us.</li>
          <li><strong>Usage and telemetry</strong>: pages visited, feature usage, errors, timestamps.</li>
          <li><strong>Device data</strong>: browser type, operating system, device identifiers, IP address, approximate location derived from IP.</li>
          <li><strong>Billing data</strong>: handled by our Merchant of Record, Stripe. We receive a subscription status and customer identifier — we do not receive your card details.</li>
        </ul>

        <h2>3. Why we use it (purposes and legal bases)</h2>
        <ul>
          <li><strong>Provide the Service</strong> (account creation, hosting your content, AI features, collaboration) — <em>performance of a contract</em>.</li>
          <li><strong>Billing and subscription management</strong> — <em>performance of a contract</em> and <em>legal obligation</em> (tax records).</li>
          <li><strong>Security, fraud prevention, abuse detection</strong> — <em>legitimate interests</em>.</li>
          <li><strong>Product improvement and analytics</strong> — <em>legitimate interests</em>.</li>
          <li><strong>Customer support</strong> — <em>performance of a contract</em>.</li>
          <li><strong>Service announcements and legal notices</strong> — <em>legitimate interests</em> or <em>legal obligation</em>.</li>
          <li><strong>Marketing emails</strong>, where applicable — <em>consent</em>, which you can withdraw at any time.</li>
        </ul>

        <h2>4. AI processing</h2>
        <p>
          When you use AI features, the prompts and relevant project context are sent to third-party AI
          providers (e.g. Lovable AI Gateway, ElevenLabs for voice) to generate a response. We do not sell
          your content and we do not use your private project content to train foundation models.
        </p>

        <h2>5. Who we share it with</h2>
        <ul>
          <li><strong>Stripe</strong> — Merchant of Record for sales, subscription management, payments, tax compliance, invoicing, and refunds.</li>
          <li><strong>Supabase</strong> — database, authentication, and storage hosting.</li>
          <li><strong>Lovable</strong> — application hosting and AI gateway.</li>
          <li><strong>ElevenLabs</strong> — text-to-speech for the Table Read feature (only when you use it).</li>
          <li><strong>Analytics providers</strong> — aggregated, non-identifying traffic analytics.</li>
          <li><strong>Professional advisers</strong> — legal, accounting, where necessary.</li>
          <li><strong>Authorities</strong> — where required by law or to protect our rights.</li>
        </ul>
        <p>We do not sell your personal data.</p>

        <h2>6. International transfers</h2>
        <p>
          Some of our processors are located outside your country, including in the United States and the
          European Economic Area. Where personal data is transferred out of the UK/EEA, we rely on
          appropriate safeguards such as the European Commission's Standard Contractual Clauses or an
          adequacy decision.
        </p>

        <h2>7. Retention</h2>
        <p>
          We keep your personal data for as long as your account is active and as long as needed to provide
          the Service. If you delete your account, we delete or anonymise your personal data within 90 days,
          except where we must keep records to comply with legal or tax obligations (typically 6–7 years for
          billing records).
        </p>

        <h2>8. Your rights</h2>
        <p>
          Depending on your jurisdiction, you may have the right to access, correct, delete, restrict, or
          port your personal data, to object to processing, and to withdraw consent. UK/EEA users have these
          rights under the UK GDPR and EU GDPR, and the right to lodge a complaint with a supervisory
          authority. We will respond to verified requests within one month. To exercise a right, contact us
          via the support channel in your account settings.
        </p>

        <h2>9. Security</h2>
        <p>
          We use appropriate technical and organisational measures to protect your data, including
          encryption in transit (TLS), encryption at rest for our database and storage, access controls,
          role-based permissions, row-level security, and regular dependency scanning.
        </p>

        <h2>10. Cookies</h2>
        <p>
          We use strictly necessary cookies for authentication and session management, and privacy-respecting
          analytics cookies to understand aggregate usage. We do not use advertising cookies. You can manage
          cookies via your browser settings.
        </p>

        <h2>11. Children</h2>
        <p>
          The Service is not directed to children under 16. We do not knowingly collect personal data from
          children. If you believe a child has provided personal data, contact us and we will delete it.
        </p>

        <h2>12. Changes to this notice</h2>
        <p>
          We may update this Privacy Notice from time to time. Material changes will be notified via email
          or an in-app notice.
        </p>

        <h2>13. Contact</h2>
        <p>
          For any privacy question or to exercise your rights, contact Joshua Ellis via the support channel
          in your account settings. For billing-related privacy queries, you can also contact Stripe at{" "}
          <a href="https://billing.stripe.com" target="_blank" rel="noopener noreferrer">billing.stripe.com</a>.
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
