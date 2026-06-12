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
  Globe,
  PenTool,
} from "lucide-react";
import { PublicSiteHeader } from "@/components/brand/PublicSiteHeader";
import { PublicSiteFooter } from "@/components/brand/PublicSiteFooter";
import { SceneSmithLogo } from "@/components/brand/SceneSmithLogo";
import { BRAND_DOMAIN, BRAND_NAME, BRAND_SOCIAL_IMAGE, BRAND_TAGLINE } from "@/lib/brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
      },
      {
        name: "description",
        content:
          "SceneSmith Studio is the AI-powered storytelling studio for screenwriters, novelists, worldbuilders, comedians, and audio storytellers.",
      },
      {
        property: "og:title",
        content: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
      },
      {
        property: "og:description",
        content:
          "Write, develop, and shape better stories inside a premium storytelling studio built for scene-by-scene work.",
      },
      { property: "og:url", content: BRAND_DOMAIN },
      { property: "og:image", content: BRAND_SOCIAL_IMAGE },
      { name: "twitter:title", content: `${BRAND_NAME} — ${BRAND_TAGLINE}` },
      {
        name: "twitter:description",
        content:
          "Write, develop, and shape better stories inside a premium storytelling studio built for scene-by-scene work.",
      },
      { name: "twitter:image", content: BRAND_SOCIAL_IMAGE },
    ],
    links: [{ rel: "canonical", href: BRAND_DOMAIN }],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: FileText,
    title: "Screenplays",
    desc: "Write with professional screenplay structure, clean formatting, and a workspace built for scene-by-scene momentum.",
  },
  {
    icon: PenTool,
    title: "Novels",
    desc: "Develop long-form fiction with character arcs, scene planning, and creative support that stays close to the page.",
  },
  {
    icon: Globe,
    title: "Worldbuilding",
    desc: "Track lore, settings, and story logic so every choice feels grounded inside the world you are building.",
  },
  {
    icon: Users,
    title: "Character work",
    desc: "Shape living characters with contradiction, desire, and emotional pressure instead of flat profiles.",
  },
  {
    icon: ImageIcon,
    title: "Storyboards",
    desc: "Visualize key moments, references, and scene intent when you want to think in images as well as words.",
  },
  {
    icon: Mic,
    title: "Audio storytelling",
    desc: "Hear pacing, rhythm, and performance through table reads and voice-led review tools.",
  },
];

const STEPS = [
  {
    n: "01",
    t: "Start with the page",
    d: "Write without friction inside a studio designed to keep creative focus on the story, not the software.",
  },
  {
    n: "02",
    t: "Develop scene by scene",
    d: "Refine characters, tension, structure, and story logic with tools that support the work instead of taking it over.",
  },
  {
    n: "03",
    t: "Move toward pitch",
    d: "Shape materials, visual references, and rehearsal-ready outputs when the story is ready to leave the desk.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicSiteHeader />

      <main>
        <section className="border-b border-border/50 bg-[linear-gradient(180deg,rgba(212,162,58,0.08),transparent_28%),linear-gradient(135deg,rgba(15,27,45,0.02),rgba(15,27,45,0.08))]">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                AI-assisted storytelling
              </div>
              <h1 className="max-w-3xl font-display text-5xl font-semibold leading-[0.98] text-foreground md:text-7xl">
                Build better stories,
                <br />
                scene by scene.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
                SceneSmith Studio is your intelligent creative partner for screenplays, novels,
                worldbuilding, comedy, and audio storytelling.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link to="/auth">
                  <Button size="lg" className="h-12 px-6 text-base shadow-lg shadow-primary/20">
                    Start Writing <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/pricing">
                  <Button variant="outline" size="lg" className="h-12 px-6 text-base">
                    Explore Pricing
                  </Button>
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" /> Professional writing workspace
                </span>
                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" /> Story-first AI assistance
                </span>
                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" /> Scene-by-scene development
                </span>
              </div>
            </div>

            <div className="relative">
              <div
                className="absolute inset-0 rounded-[2rem] bg-primary/10 blur-3xl"
                aria-hidden="true"
              />
              <div className="relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-[0_30px_90px_-40px_rgba(15,27,45,0.45)]">
                <div className="border-b border-border/60 px-6 py-5">
                  <SceneSmithLogo iconClassName="h-14 w-14" />
                </div>
                <div className="grid gap-0 md:grid-cols-[220px_1fr]">
                  <aside className="border-b border-border/60 bg-secondary/45 p-5 md:border-b-0 md:border-r">
                    <div className="space-y-3 text-sm">
                      {["Projects", "Scenes", "Outlines", "Characters", "Worlds", "Audio"].map(
                        (item, index) => (
                          <div
                            key={item}
                            className={`rounded-md px-3 py-2 ${index === 0 ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground"}`}
                          >
                            {item}
                          </div>
                        ),
                      )}
                    </div>
                  </aside>
                  <div className="bg-background p-6">
                    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                      <div className="mb-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Last Light
                      </div>
                      <div className="space-y-4 font-mono text-sm leading-7 text-foreground/90">
                        <p>INT. OBSERVATORY — NIGHT</p>
                        <p>The telescope hums softly.</p>
                        <p>MIRA adjusts the focus.</p>
                        <div className="pt-2 text-center">
                          <p>MIRA</p>
                          <p>(whisper)</p>
                          <p>There it is.</p>
                        </div>
                        <p>A comet breaks through the clouds.</p>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-border/60 bg-secondary/35 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-primary">
                          AI Co-Writer
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Reveal character conflict, raise the stakes, and deepen the moment without
                          losing your voice.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-secondary/35 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-primary">
                          Studio Tools
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Format, notes, beat board, and story assists stay close to the page
                          instead of crowding it.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border/50 bg-background">
          <div className="mx-auto max-w-6xl px-4 py-16 lg:py-20">
            <div className="grid gap-px overflow-hidden rounded-[1.5rem] border border-border/60 bg-border/40 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="bg-background p-6">
                  <feature.icon className="mb-4 h-7 w-7 text-primary" />
                  <h2 className="font-display text-2xl font-semibold">{feature.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border/50 bg-card/25">
          <div className="mx-auto max-w-5xl px-4 py-16 lg:py-20">
            <div className="mb-12 text-center">
              <p className="text-xs uppercase tracking-[0.24em] text-primary">
                A better creative rhythm
              </p>
              <h2 className="mt-3 font-display text-4xl font-semibold md:text-5xl">
                A storytelling studio, not a generic dashboard.
              </h2>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {STEPS.map((step) => (
                <div
                  key={step.n}
                  className="rounded-[1.5rem] border border-border/60 bg-background p-6 shadow-sm"
                >
                  <div className="text-sm uppercase tracking-[0.22em] text-primary">{step.n}</div>
                  <h3 className="mt-4 font-display text-2xl font-semibold">{step.t}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{step.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-background">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center lg:py-24">
            <p className="text-xs uppercase tracking-[0.24em] text-primary">SceneSmith Studio</p>
            <h2 className="mt-3 font-display text-4xl font-semibold md:text-6xl">
              The page is yours.
              <br />
              The studio is waiting.
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              Start free, write with momentum, and shape the work with tools built for storytellers.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link to="/auth">
                <Button size="lg" className="h-12 px-6 text-base shadow-lg shadow-primary/20">
                  Enter the Studio <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button variant="outline" size="lg" className="h-12 px-6 text-base">
                  View pricing
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
