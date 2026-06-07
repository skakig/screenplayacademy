import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Film, Sparkles, Users, LayoutGrid, Image as ImageIcon, Mic, FileText, ArrowRight, Check } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SceneSmith AI — AI-Native Screenwriting Studio" },
      { name: "description", content: "Write the script. See the scene. Hear the table read. SceneSmith AI is an AI-native screenwriting studio that helps you format, develop, visualize, and perform your screenplay." },
      { property: "og:title", content: "SceneSmith AI — AI-Native Screenwriting Studio" },
      { property: "og:description", content: "Format, develop, visualize, and perform your screenplay from first idea to pitch package." },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: FileText, title: "Screenplay Editor", desc: "Industry-standard formatting with structured script blocks." },
  { icon: Users, title: "Character Bibles", desc: "Wounds, secrets, contradictions, arcs. Built with AI." },
  { icon: LayoutGrid, title: "Scene Cards", desc: "Outline beat by beat with purpose, conflict, reversal." },
  { icon: ImageIcon, title: "Storyboards", desc: "Visualize key shots with AI-generated panels." },
  { icon: Mic, title: "Table Reads", desc: "Hear your screenplay performed with AI voices." },
  { icon: Sparkles, title: "Pitch Package", desc: "Logline, synopsis, treatment, pitch email — one click." },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60 bg-background/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Film className="h-5 w-5 text-primary" />
            <span className="font-bold tracking-tight">SceneSmith<span className="text-primary"> AI</span></span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link to="/pricing" className="px-3 py-1.5 text-muted-foreground hover:text-foreground">Pricing</Link>
            <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/auth"><Button size="sm">Start Free</Button></Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 py-24 lg:py-32 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary mb-6">
            <Sparkles className="h-3 w-3" /> AI-native screenwriting studio
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight leading-[1.05]">
            Write the script.<br />
            <span className="text-primary">See the scene.</span><br />
            Hear the table read.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mt-8 max-w-2xl mx-auto">
            SceneSmith AI helps you format, develop, visualize, and perform your screenplay — from first idea to pitch package.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="shadow-lg shadow-primary/30 text-base h-12 px-6">
                Start Writing Free <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link to="/pricing"><Button variant="outline" size="lg" className="h-12">See pricing</Button></Link>
          </div>
        </div>
      </section>

      <section className="border-t border-border/40">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <h2 className="text-3xl font-bold text-center mb-12">Everything a writer needs.</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-6 rounded-xl bg-card/40 border border-border/60 hover:border-primary/40 transition">
                <f.icon className="h-6 w-6 text-primary mb-3" />
                <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border/40 bg-card/20">
        <div className="max-w-5xl mx-auto px-4 py-20">
          <h2 className="text-3xl font-bold text-center mb-12">From idea to industry-ready in three steps.</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: "1", t: "Outline", d: "Drop in your premise. AI builds loglines, characters, and a beat sheet." },
              { n: "2", t: "Write", d: "Format-perfect screenplay editor with a sidebar of AI tools." },
              { n: "3", t: "Pitch", d: "Generate a pitch package, storyboard, and AI table read in seconds." },
            ].map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center font-display text-xl text-primary mb-3">{s.n}</div>
                <h3 className="font-semibold text-lg mb-1">{s.t}</h3>
                <p className="text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border/40">
        <div className="max-w-3xl mx-auto px-4 py-24 text-center">
          <h2 className="font-display text-4xl md:text-5xl font-bold">Your blank page awaits.</h2>
          <p className="text-muted-foreground mt-4 mb-8">Free forever to start. No credit card required.</p>
          <Link to="/auth">
            <Button size="lg" className="text-base h-12 px-6 shadow-lg shadow-primary/30">
              Start Writing Free <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> Industry formatting</span>
            <span className="inline-flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> AI assistant</span>
            <span className="inline-flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> Pitch package</span>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/40 py-8">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} SceneSmith AI</span>
          <div className="flex gap-4">
            <Link to="/pricing">Pricing</Link>
            <Link to="/auth">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
