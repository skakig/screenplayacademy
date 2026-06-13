import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Users,
  LayoutGrid,
  Image as ImageIcon,
  Mic,
  FileText,
  ArrowRight,
  Check,
  Sparkle,
} from "lucide-react";
import ctaScene from "@/assets/cta-writer-scene.jpg.asset.json";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { PillarStrip } from "@/components/landing/PillarStrip";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "SceneSmith Studio — The Writer's Toolbox for Every Story",
      },
      {
        name: "description",
        content:
          "SceneSmith Studio is an AI-powered writer's room for screenplays, novels, worldbuilding, comedy, and audio storytelling — from first spark to final pitch.",
      },
      {
        property: "og:title",
        content: "SceneSmith Studio — The Writer's Toolbox for Every Story",
      },
      {
        property: "og:description",
        content:
          "One studio for screenplays, novels, worlds, comedy, and audio stories. Write, develop, perform, and pitch with AI.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: FileText,
    title: "Writer's Desk",
    desc: "Industry-standard formatting, smart blocks, and AI that respects your voice. Click the page and write.",
  },
  {
    icon: Users,
    title: "Casting Wall",
    desc: "Wants, wounds, lies, secrets, and arcs. Build characters who can actually carry a scene.",
  },
  {
    icon: LayoutGrid,
    title: "Scene Board",
    desc: "Outline beat by beat with purpose, conflict, and reversal — corkboard cards, not spreadsheets.",
  },
  {
    icon: ImageIcon,
    title: "Shot Wall",
    desc: "See the movie. Storyboard frames and visual motifs generated from your scenes.",
  },
  {
    icon: Mic,
    title: "Rehearsal Room",
    desc: "Hear your story performed with AI voices, pacing, and director's notes.",
  },
  {
    icon: Sparkles,
    title: "Producer Room",
    desc: "Logline, synopsis, treatment, and pitch deck — packaged from your own pages.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      {/* Sticky nav */}
      <header className="border-b border-border/60 bg-background/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <BrandLogo size="sm" />
          <nav className="flex items-center gap-2 text-sm">
            <Link
              to="/pricing"
              className="px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
            <Link to="/auth">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="sm">Enter the Studio</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            className="absolute inset-0 -z-10 opacity-60"
            style={{ background: "var(--gradient-cinematic)" }}
          />
          <div
            className="absolute inset-0 -z-10 opacity-[0.07] pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle at 18% 28%, var(--primary) 0, transparent 38%), radial-gradient(circle at 82% 72%, var(--accent) 0, transparent 42%)",
            }}
          />

          <div className="max-w-5xl mx-auto px-4 py-24 lg:py-32 text-center">
            <div className="flex justify-center mb-8">
              <BrandLogo size="lg" asLink={false} />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary mb-6">
              <Sparkles className="h-3 w-3" /> AI-native writer's room
            </div>
            <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight leading-[1.05]">
              The page is yours.
              <br />
              <span className="text-primary">The studio is waiting.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mt-8 max-w-2xl mx-auto">
              Write, develop, and perform your stories inside an AI-powered
              writer's studio — screenplays, novels, worlds, comedy, and audio,
              all in one place.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link to="/auth">
                <Button
                  size="lg"
                  className="shadow-lg shadow-primary/30 text-base h-12 px-6"
                >
                  Enter the Studio <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button variant="outline" size="lg" className="h-12">
                  See pricing
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* 5-pillar strip */}
        <PillarStrip />

        {/* Features */}
        <section className="border-t border-border/40">
          <div className="max-w-6xl mx-auto px-4 py-20">
            <div className="text-center mb-12">
              <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground mb-3">
                Inside the studio
              </p>
              <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
                Everything a storyteller needs.
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((f) => (
                <article
                  key={f.title}
                  className="group relative p-6 rounded-xl bg-card border border-border/60 hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-300"
                  style={{ boxShadow: "0 1px 0 oklch(1 0 0 / 0.04) inset" }}
                >
                  <div
                    className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 mb-4"
                    style={{ boxShadow: "0 0 0 4px var(--accent-glow)" }}
                  >
                    <f.icon className="h-5 w-5 text-primary" strokeWidth={1.6} />
                  </div>
                  <h3 className="font-display text-xl font-semibold mb-1.5 tracking-tight">
                    {f.title}
                  </h3>
                  <div className="h-px w-8 bg-primary/40 mb-3" />
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {f.desc}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Three steps */}
        <section className="border-t border-border/40 bg-card/20">
          <div className="max-w-5xl mx-auto px-4 py-20">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-12 tracking-tight">
              From spark to screen in three acts.
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  n: "1",
                  t: "Develop",
                  d: "Drop in your premise. AI builds loglines, characters, and a beat sheet on the Scene Board.",
                },
                {
                  n: "2",
                  t: "Write",
                  d: "Format-perfect editor with the Director's Chair sidebar of studio tools at the ready.",
                },
                {
                  n: "3",
                  t: "Pitch",
                  d: "Generate a pitch package, Shot Wall, and Rehearsal Room table read in seconds.",
                },
              ].map((s) => (
                <div key={s.n} className="text-center">
                  <div className="mx-auto h-12 w-12 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center font-display text-xl text-primary mb-3">
                    {s.n}
                  </div>
                  <h3 className="font-display text-xl font-semibold mb-1 tracking-tight">
                    {s.t}
                  </h3>
                  <p className="text-sm text-muted-foreground">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border/40">
          <div className="max-w-3xl mx-auto px-4 py-24 text-center">
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
              Your blank page awaits.
            </h2>
            <p className="text-muted-foreground mt-4 mb-8">
              Free forever to start. No credit card required.
            </p>
            <Link to="/auth">
              <Button
                size="lg"
                className="text-base h-12 px-6 shadow-lg shadow-primary/30"
              >
                Enter the Studio <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Check className="h-3 w-3 text-primary" /> Industry formatting
              </span>
              <span className="inline-flex items-center gap-1">
                <Check className="h-3 w-3 text-primary" /> Director's Chair AI
              </span>
              <span className="inline-flex items-center gap-1">
                <Check className="h-3 w-3 text-primary" /> Producer Room pitch
                deck
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} SceneSmith Studio</span>
          <div className="flex gap-4">
            <Link to="/pricing">Pricing</Link>
            <Link to="/auth">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
