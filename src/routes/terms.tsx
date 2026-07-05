import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/brand/BrandLogo";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — SceneSmith Studio" },
      { name: "description", content: "Terms and conditions governing use of SceneSmith Studio, operated by Joshua Ellis." },
      { property: "og:title", content: "Terms & Conditions — SceneSmith Studio" },
      { property: "og:description", content: "Terms governing use of SceneSmith Studio." },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "https://scenesmithstudio.com/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
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
        <h1>Terms & Conditions</h1>
        <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

        <h2>1. Who we are</h2>
        <p>
          SceneSmith Studio (the "Service") is operated by <strong>Joshua Ellis</strong> ("we", "us", "our"),
          a sole proprietor trading as SceneSmith Studio. By using the Service, you enter into a contract
          with Joshua Ellis.
        </p>

        <h2>2. Acceptance</h2>
        <p>
          By creating an account, accessing, or continuing to use the Service, you agree to be bound by these
          Terms. If you do not agree, do not use the Service. You confirm you are of legal age in your
          jurisdiction and, if using the Service on behalf of an organization, that you have authority to
          bind that organization.
        </p>

        <h2>3. The Service</h2>
        <p>
          SceneSmith Studio is an AI-assisted collaborative writing studio for screenplays, pitch materials,
          storyboards, table reads, and related creative outputs.
        </p>

        <h2>4. Acceptable use</h2>
        <p>You must not misuse the Service. In particular, you must not:</p>
        <ul>
          <li>Use the Service for any unlawful purpose, fraud, spam, or harassment;</li>
          <li>Infringe intellectual property, publicity, or privacy rights of others;</li>
          <li>Upload malware, probe or scan for vulnerabilities, or interfere with the Service's security;</li>
          <li>Scrape, reverse engineer, resell, or redistribute the Service or its outputs beyond your plan;</li>
          <li>Attempt to circumvent access controls, rate limits, or feature gates;</li>
          <li>Generate illegal content, deepfakes without consent, hate speech, sexual content involving minors, or content designed to deceive or defraud;</li>
          <li>Attempt to "jailbreak" the AI models or use outputs to train competing models.</li>
        </ul>

        <h2>5. AI outputs</h2>
        <p>
          The Service uses generative AI. You are responsible for the prompts you submit, for reviewing and
          verifying any AI outputs before relying on them, and for ensuring you have the rights to any
          content you upload or import. Outputs may be inaccurate and are not a substitute for professional
          legal, financial, or medical advice. We may filter, refuse, or moderate outputs and may remove
          content or suspend accounts that violate these Terms.
        </p>

        <h2>6. Your content</h2>
        <p>
          You retain ownership of the screenplays, characters, notes, and other content you create using the
          Service ("Your Content"). You grant us a limited, worldwide, non-exclusive license to host, store,
          process, transmit, and display Your Content solely to provide, secure, and improve the Service for
          you and your invited collaborators. You represent that you have the rights necessary to grant this
          license.
        </p>

        <h2>7. Our intellectual property</h2>
        <p>
          The Service — including its software, user interface, documentation, and branding — is owned by
          Joshua Ellis and its licensors. We grant you a limited, non-exclusive, non-transferable right to
          use the Service under your active plan. All rights not expressly granted are reserved.
        </p>

        <h2>8. Payments and subscriptions</h2>
        <p>
          Our order process is conducted by our online reseller <strong>Paddle.com</strong>. Paddle.com is
          the Merchant of Record for all our orders. Paddle provides all customer service inquiries and
          handles returns. Payment, billing, tax, cancellation, and refund mechanics are governed by{" "}
          <a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noopener noreferrer">Paddle's Buyer Terms</a>.
          Subscriptions renew automatically at the end of each billing period until cancelled. See our{" "}
          <Link to="/refund">Refund Policy</Link> for refund terms.
        </p>

        <h2>9. Account and credentials</h2>
        <p>
          You must provide accurate account information, keep it up to date, and keep your credentials
          confidential. You are responsible for all activity under your account.
        </p>

        <h2>10. Service level and warranties</h2>
        <p>
          The Service is provided "as is" and "as available". We do not guarantee that the Service will be
          uninterrupted, error-free, or that AI outputs will meet your requirements. To the fullest extent
          permitted by law, we disclaim all implied warranties, including merchantability, fitness for a
          particular purpose, and non-infringement.
        </p>

        <h2>11. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, our aggregate liability arising out of or related to the
          Service is limited to the fees you paid us in the 12 months before the claim. We are not liable
          for indirect, consequential, incidental, special, or punitive damages, including loss of profits,
          revenue, data, or goodwill. Nothing in these Terms limits liability for fraud, death, or personal
          injury caused by negligence, or any other liability that cannot be limited by law.
        </p>

        <h2>12. Indemnity</h2>
        <p>
          You will indemnify and hold us harmless from claims arising out of Your Content, your use of AI
          outputs, your violation of these Terms, or your unlawful conduct.
        </p>

        <h2>13. Suspension and termination</h2>
        <p>
          We may suspend or terminate your access for: material breach of these Terms, non-payment, security
          or fraud risk, or repeated or serious policy violations. You may cancel your subscription at any
          time via the customer portal in Settings; access continues until the end of the current billing
          period. On termination, we may delete Your Content after a reasonable export window.
        </p>

        <h2>14. Changes</h2>
        <p>
          We may update these Terms from time to time. Material changes will be notified via email or an
          in-app notice. Continued use of the Service after changes take effect constitutes acceptance.
        </p>

        <h2>15. Governing law</h2>
        <p>
          These Terms are governed by the laws of Joshua Ellis's principal place of business, without regard
          to conflict-of-laws principles. Disputes will be resolved in the courts of that jurisdiction,
          unless applicable law grants you rights in your local courts.
        </p>

        <h2>16. Contact</h2>
        <p>
          Questions about these Terms: contact Joshua Ellis via the support channel available in your
          account settings, or via Paddle at{" "}
          <a href="https://paddle.net" target="_blank" rel="noopener noreferrer">paddle.net</a> for billing
          matters.
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
