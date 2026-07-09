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
        <p>
          You agree to use the Service only for lawful, legitimate creative and business purposes.
          You must not, and must not allow any third party to:
        </p>
        <ul>
          <li><strong>Illegal activity</strong> — use the Service for any unlawful purpose, including fraud, money laundering, spam, phishing, harassment, stalking, or human trafficking;</li>
          <li><strong>Infringement</strong> — infringe intellectual property, publicity, or privacy rights of others, or upload content you do not have the rights to use;</li>
          <li><strong>Prohibited content</strong> — generate, upload, or distribute: child sexual abuse material (CSAM); non-consensual sexual content or intimate imagery; content that sexualises minors; terrorist or violent-extremist content; content that incites violence, self-harm, or genocide; hate speech targeting protected classes; deepfakes or synthetic media depicting real people without their explicit consent; content designed to defraud, deceive, or manipulate elections;</li>
          <li><strong>Regulated advice</strong> — present AI outputs as licensed legal, financial, medical, or other regulated professional advice;</li>
          <li><strong>Security</strong> — upload malware, probe or scan for vulnerabilities, disrupt, overload, or interfere with the Service's security or availability;</li>
          <li><strong>Reverse engineering & resale</strong> — reverse engineer, decompile, resell, sublicense, or redistribute the Service, or use outputs to develop or train a competing AI model or service;</li>
          <li><strong>Circumvention</strong> — attempt to bypass access controls, rate limits, feature gates, safety filters, or "jailbreak" the AI models;</li>
          <li><strong>Automated abuse</strong> — use bots, scrapers, or automated tools to access the Service outside our documented interfaces.</li>
        </ul>

        <h2>5. Generative AI — your responsibilities</h2>
        <p>
          The Service uses generative AI models provided by us and by third-party AI providers. You
          acknowledge and agree that:
        </p>
        <ul>
          <li><strong>Your inputs.</strong> You are solely responsible for the prompts, source material, and context you submit, and you represent that you have all necessary rights to submit them.</li>
          <li><strong>Your outputs.</strong> You are responsible for how you use, publish, or distribute AI outputs, including verifying their accuracy, originality, and fitness for your purpose before relying on them.</li>
          <li><strong>Accuracy disclosure.</strong> AI outputs can be inaccurate, incomplete, biased, or offensive. They are provided for creative assistance and are <em>not</em> a substitute for professional legal, financial, medical, or other regulated advice, and must not be used in place of professional oversight in those contexts.</li>
          <li><strong>IP in outputs.</strong> As between you and us, and subject to third-party rights and applicable law, you own the outputs you generate through your use of the Service. You are responsible for confirming that your use of an output does not infringe any third-party right.</li>
          <li><strong>Takedown pathway.</strong> If you believe content on the Service infringes your intellectual property or other rights, contact us via the support channel in your account settings with a detailed description and proof of ownership. We will investigate promptly and, where appropriate, remove or disable access to the content.</li>
          <li><strong>Repeat infringers.</strong> We terminate the accounts of users who repeatedly infringe others' rights.</li>
          <li><strong>Content moderation rights.</strong> We may, at our discretion and without prior notice, refuse, filter, restrict, or remove any input, output, or user content, and suspend or terminate any account, that we reasonably believe violates these Terms or applicable law.</li>
        </ul>



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
          Payments are processed by <strong>Stripe</strong>. By purchasing a subscription you also agree to
          Stripe's terms and privacy notice. Subscriptions renew automatically at the end of each billing
          period until cancelled. See our <Link to="/refund">Refund Policy</Link> for refund terms.
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
