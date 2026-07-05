import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Ruler, Type as TypeIcon, AlignLeft, Film } from "lucide-react";

const CANONICAL = "https://scenesmithstudio.com/screenplay-formatting-standards";

const FAQ = [
  {
    q: "What font is used in screenplays?",
    a: "Industry standard is 12-point Courier (Courier Prime, Courier Final Draft, or plain Courier New). The monospaced font is what makes the 'one page equals roughly one minute of screen time' rule work.",
  },
  {
    q: "What are the standard screenplay margins?",
    a: "Left margin 1.5 inches, right margin 1 inch, top and bottom margins 1 inch. The wider left margin leaves room for hole-punching and binding.",
  },
  {
    q: "How wide is dialogue on a screenplay page?",
    a: "Dialogue is indented 2.5 inches from the left edge and 2.5 inches from the right edge, giving it a block width of roughly 3.5 inches.",
  },
  {
    q: "How wide is a character name (cue) on the page?",
    a: "Character cues sit 3.7 inches from the left edge of the page and are always in ALL CAPS.",
  },
  {
    q: "Do I still need CONTINUED and MORE tags?",
    a: "No. Modern spec scripts drop (CONTINUED) at page breaks and (MORE)/(CONT'D) on split dialogue. Production drafts may keep them; specs shouldn't.",
  },
  {
    q: "What's the difference between a spec script and a shooting script?",
    a: "A spec is written to sell — no scene numbers, no camera direction, minimal parentheticals. A shooting script is the production version with scene numbers, revision colors, and technical detail.",
  },
];

export const Route = createFileRoute("/screenplay-formatting-standards")({
  head: () => ({
    meta: [
      { title: "Screenplay Formatting Standards — The Complete Guide" },
      {
        name: "description",
        content:
          "The industry-standard guide to screenplay formatting: Courier 12pt, exact margins, scene headings, action, dialogue, parentheticals, transitions, and modern spec-script rules used by working screenwriters.",
      },
      { property: "og:title", content: "Screenplay Formatting Standards — The Complete Guide" },
      {
        property: "og:description",
        content:
          "Exact margins, fonts, and element spacing used by working screenwriters — plus the modern spec-script conventions that keep your script looking professional.",
      },
      { property: "og:url", content: CANONICAL },
      { property: "og:type", content: "article" },
      { name: "twitter:title", content: "Screenplay Formatting Standards — The Complete Guide" },
      {
        name: "twitter:description",
        content:
          "Courier 12pt, 1.5in left margin, 1in right — the exact spec every screenplay follows. Learn the modern conventions here.",
      },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Screenplay Formatting Standards — The Complete Guide",
          description:
            "The industry-standard guide to screenplay formatting: exact margins, fonts, and element spacing used by working screenwriters.",
          author: { "@type": "Organization", name: "SceneSmith Studio" },
          publisher: {
            "@type": "Organization",
            name: "SceneSmith Studio",
            url: "https://scenesmithstudio.com",
          },
          mainEntityOfPage: CANONICAL,
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: FormattingStandardsPage,
});

function SectionAnchor({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 font-serif text-3xl md:text-4xl mt-14 mb-4">
      {children}
    </h2>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function FormattingStandardsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo className="h-7 w-auto" />
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/auth" search={{ next: "" }} className="hover:text-foreground transition-colors">Sign in</Link>
          </nav>
          <Button asChild size="sm">
            <Link to="/auth" search={{ next: "" }}>
              Start writing <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        {/* Hero */}
        <div className="mb-10">
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-mono mb-3">
            The SceneSmith Field Guide
          </p>
          <h1 className="font-serif text-4xl md:text-5xl leading-tight">
            Screenplay Formatting Standards
          </h1>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
            The exact margins, fonts, and element rules used by working screenwriters — plus the modern spec-script
            conventions that keep your script looking professional to readers, agents, and production companies.
          </p>
        </div>

        {/* Quick specs */}
        <section aria-label="Quick specifications" className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
          <Spec label="Font" value="Courier 12pt" />
          <Spec label="Left margin" value="1.5 in" />
          <Spec label="Right margin" value="1.0 in" />
          <Spec label="Top / Bottom" value="1.0 in" />
          <Spec label="Dialogue block" value="2.5 in from left" />
          <Spec label="Character cue" value="3.7 in from left" />
          <Spec label="Parenthetical" value="3.1 in from left" />
          <Spec label="Transition" value="Right-aligned" />
        </section>

        {/* TOC */}
        <nav aria-label="On this page" className="rounded-lg border border-border/60 bg-card/30 px-5 py-4 mb-14">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono mb-2">
            On this page
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-y-1 text-sm">
            <li><a href="#why" className="text-primary hover:underline">Why formatting matters</a></li>
            <li><a href="#page" className="text-primary hover:underline">Page setup</a></li>
            <li><a href="#font" className="text-primary hover:underline">Font: why Courier</a></li>
            <li><a href="#elements" className="text-primary hover:underline">The eight elements</a></li>
            <li><a href="#scene" className="text-primary hover:underline">Scene headings (slugs)</a></li>
            <li><a href="#action" className="text-primary hover:underline">Action lines</a></li>
            <li><a href="#dialogue" className="text-primary hover:underline">Character &amp; dialogue</a></li>
            <li><a href="#transitions" className="text-primary hover:underline">Transitions &amp; shots</a></li>
            <li><a href="#modern" className="text-primary hover:underline">Modern spec conventions</a></li>
            <li><a href="#tools" className="text-primary hover:underline">Software that formats for you</a></li>
            <li><a href="#faq" className="text-primary hover:underline">FAQ</a></li>
          </ul>
        </nav>

        {/* Sections */}
        <SectionAnchor id="why">Why formatting matters</SectionAnchor>
        <p className="text-base leading-relaxed text-foreground/85">
          Screenplay formatting isn't decoration. It's a shared contract between the writer, the reader, and every
          department that will later turn the page into a shot. Because the format is standardized, one properly
          formatted page runs roughly one minute of screen time — so a 110-page script tells a producer the movie
          runs about 110 minutes without anyone timing a single scene. Break the format and you break that trust
          on page one.
        </p>

        <SectionAnchor id="page">Page setup</SectionAnchor>
        <div className="flex items-start gap-3 mb-4 text-muted-foreground">
          <Ruler className="h-5 w-5 mt-0.5 text-primary" aria-hidden="true" />
          <p className="text-base leading-relaxed text-foreground/85">
            US Letter (8.5 × 11 in). Left margin <strong>1.5 in</strong>, right margin <strong>1.0 in</strong>, top and
            bottom margins <strong>1.0 in</strong>. Page numbers go in the top-right corner starting on page 2, followed
            by a period. No header on page 1. No footer, ever.
          </p>
        </div>

        <SectionAnchor id="font">Font: why Courier</SectionAnchor>
        <div className="flex items-start gap-3 mb-4 text-muted-foreground">
          <TypeIcon className="h-5 w-5 mt-0.5 text-primary" aria-hidden="true" />
          <p className="text-base leading-relaxed text-foreground/85">
            <strong>12-point Courier</strong> — Courier Prime, Courier Final Draft, or Courier New. It's monospaced,
            which means every character occupies the same horizontal space. That property is what makes the
            one-page-per-minute rule reliable. Don't switch to Times New Roman, Arial, or a "cleaner" font to fit
            more on the page. Readers can tell within three seconds, and it signals a first-time writer.
          </p>
        </div>

        <SectionAnchor id="elements">The eight elements</SectionAnchor>
        <p className="text-base leading-relaxed text-foreground/85 mb-4">
          Every line in a screenplay is one of eight block types. Learn these and you know screenplay format.
        </p>
        <ol className="list-decimal pl-6 space-y-2 text-foreground/85">
          <li><strong>Scene heading</strong> (slug line) — <code className="font-mono text-sm">INT. LOCATION - DAY</code></li>
          <li><strong>Action</strong> — what we see and hear, present tense.</li>
          <li><strong>Character</strong> — the speaker's name, ALL CAPS.</li>
          <li><strong>Dialogue</strong> — what the character says.</li>
          <li><strong>Parenthetical</strong> — brief delivery cue like <code className="font-mono text-sm">(whispering)</code>.</li>
          <li><strong>Transition</strong> — <code className="font-mono text-sm">CUT TO:</code>, <code className="font-mono text-sm">FADE OUT:</code>, right-aligned.</li>
          <li><strong>Shot</strong> — <code className="font-mono text-sm">CLOSE ON</code>, <code className="font-mono text-sm">ANGLE ON</code> — use sparingly.</li>
          <li><strong>Note</strong> — a private writer note; never exports to a final draft.</li>
        </ol>

        <SectionAnchor id="scene">Scene headings (slug lines)</SectionAnchor>
        <p className="text-base leading-relaxed text-foreground/85 mb-3">
          Always ALL CAPS. Always start with <code className="font-mono text-sm">INT.</code> (interior),
          <code className="font-mono text-sm"> EXT.</code> (exterior), or
          <code className="font-mono text-sm"> INT./EXT.</code> (both). Then the location, then a hyphen, then the
          time of day.
        </p>
        <pre className="rounded-md border border-border/60 bg-muted/40 p-4 font-mono text-sm overflow-x-auto">
{`INT. AFRICAN DESERT OUTPOST - DAY

EXT. ODESSA TRAIN STATION - NIGHT

INT./EXT. TRUCK - MOVING - DAWN`}
        </pre>

        <SectionAnchor id="action">Action lines</SectionAnchor>
        <div className="flex items-start gap-3 mb-4 text-muted-foreground">
          <AlignLeft className="h-5 w-5 mt-0.5 text-primary" aria-hidden="true" />
          <p className="text-base leading-relaxed text-foreground/85">
            Present tense. Only what a camera can film or a microphone can record — no interior thoughts, no
            backstory dumps. Introduce a character in <strong>ALL CAPS</strong> the first time they appear, then
            switch to normal case. Keep paragraphs short: one to four lines each.
          </p>
        </div>
        <pre className="rounded-md border border-border/60 bg-muted/40 p-4 font-mono text-sm overflow-x-auto">
{`The sun burns across an endless sea of sand.

A lone soldier — STEPHAN, 30s, cracked lips, hollow
eyes — stumbles over a dune. His radio crackles.`}
        </pre>

        <SectionAnchor id="dialogue">Character &amp; dialogue</SectionAnchor>
        <p className="text-base leading-relaxed text-foreground/85 mb-3">
          Character cues sit 3.7 in from the left edge, ALL CAPS. Dialogue sits 2.5 in from the left and 2.5 in from
          the right. Parentheticals go on their own line, 3.1 in from the left, and only when the delivery genuinely
          matters — never as a substitute for action.
        </p>
        <pre className="rounded-md border border-border/60 bg-muted/40 p-4 font-mono text-sm overflow-x-auto">
{`                    STEPHAN
          Just a few more clicks.

                    COMMANDER (V.O.)
              (over the radio)
          You are lost, soldier.`}
        </pre>
        <p className="text-sm text-muted-foreground mt-3">
          Modifier tags — <code className="font-mono">(V.O.)</code> for voiceover,
          <code className="font-mono"> (O.S.)</code> for off-screen, <code className="font-mono">(CONT'D)</code> when
          the same character speaks again after action — sit on the same line as the character cue.
        </p>

        <SectionAnchor id="transitions">Transitions &amp; shots</SectionAnchor>
        <p className="text-base leading-relaxed text-foreground/85">
          Transitions are right-aligned and always end in a colon: <code className="font-mono">CUT TO:</code>,
          <code className="font-mono"> DISSOLVE TO:</code>, <code className="font-mono">SMASH CUT TO:</code>. Most modern
          specs drop transitions entirely except for <code className="font-mono">FADE IN:</code> at the top and
          <code className="font-mono"> FADE OUT.</code> at the bottom. Shot descriptions like
          <code className="font-mono"> CLOSE ON</code> or <code className="font-mono">ANGLE ON</code> should be
          reserved for moments the reader must see exactly the way you see them — the director will handle the rest.
        </p>

        <SectionAnchor id="modern">Modern spec-script conventions</SectionAnchor>
        <ul className="list-disc pl-6 space-y-2 text-foreground/85">
          <li>No scene numbers on a spec — only on shooting scripts.</li>
          <li>No camera direction unless it's essential to the story.</li>
          <li>Drop <code className="font-mono">(CONTINUED)</code> at page breaks and
            <code className="font-mono"> (MORE)</code> on split dialogue.</li>
          <li>No <code className="font-mono">WE SEE</code>, <code className="font-mono">WE HEAR</code>, or
            <code className="font-mono"> WE CUT TO</code> — trust the reader.</li>
          <li>Feature specs run <strong>90 to 120 pages</strong>. TV drama pilots run 55 to 65; comedy pilots 28 to 34.</li>
        </ul>

        <SectionAnchor id="tools">Software that formats for you</SectionAnchor>
        <p className="text-base leading-relaxed text-foreground/85 mb-4">
          Handling every margin, cue indent, and page break by hand is a losing game. Screenwriting software applies
          the format automatically as you type — <kbd className="px-1.5 py-0.5 border border-border/60 rounded text-xs font-mono">Enter</kbd> after a character cue jumps
          to a dialogue block, <kbd className="px-1.5 py-0.5 border border-border/60 rounded text-xs font-mono">Tab</kbd> cycles element type — so you focus on the story,
          not the ruler.
        </p>
        <div className="rounded-lg border border-primary/30 bg-primary/[0.04] p-5 my-6">
          <div className="flex items-start gap-3">
            <Film className="h-5 w-5 mt-0.5 text-primary shrink-0" aria-hidden="true" />
            <div>
              <h3 className="font-semibold mb-1">SceneSmith Studio — screenwriting software built around the format</h3>
              <p className="text-sm text-foreground/80 mb-3">
                SceneSmith Studio applies industry-standard screenplay formatting automatically. Type
                <code className="font-mono text-xs"> int desert day</code> and it becomes
                <code className="font-mono text-xs"> INT. DESERT - DAY</code>. Press
                <kbd className="mx-1 px-1.5 py-0.5 border border-border/60 rounded text-xs font-mono">Enter</kbd>
                after a character name and the next line is dialogue. Press
                <kbd className="mx-1 px-1.5 py-0.5 border border-border/60 rounded text-xs font-mono">Tab</kbd>
                to cycle element type without moving your caret.
              </p>
              <Button asChild size="sm">
                <Link to="/auth" search={{ next: "" }}>
                  Start writing free <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <SectionAnchor id="faq">Frequently asked questions</SectionAnchor>
        <div className="space-y-6">
          {FAQ.map((f) => (
            <div key={f.q}>
              <h3 className="font-semibold text-foreground mb-1.5">{f.q}</h3>
              <p className="text-foreground/80 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-16 border-t border-border/60 pt-8 flex flex-col md:flex-row items-start md:items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Ready to write a properly formatted screenplay without wrestling the format?
            </p>
          </div>
          <Button asChild>
            <Link to="/auth" search={{ next: "" }}>
              Start free on SceneSmith Studio <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </main>

      <footer className="border-t border-border/60 mt-16">
        <div className="mx-auto max-w-6xl px-6 py-8 text-xs text-muted-foreground flex flex-wrap gap-4 justify-between">
          <span>© {new Date().getFullYear()} SceneSmith Studio</span>
          <div className="flex gap-4">
            <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
