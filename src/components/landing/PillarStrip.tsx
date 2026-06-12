import { FileText, BookOpen, Globe2, Drama, Mic, type LucideIcon } from "lucide-react";

type Pillar = { icon: LucideIcon; label: string; tag: string };

const PILLARS: Pillar[] = [
  { icon: FileText, label: "Screenplays", tag: "Format & write" },
  { icon: BookOpen, label: "Novels", tag: "Plan & draft" },
  { icon: Globe2, label: "Worldbuilding", tag: "Canon & lore" },
  { icon: Drama, label: "Comedy", tag: "Beats & punch-ups" },
  { icon: Mic, label: "Audio Storytelling", tag: "Voice & performance" },
];

export function PillarStrip() {
  return (
    <section className="border-t border-border/40 bg-card/20">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <p className="text-center text-[11px] uppercase tracking-[0.32em] text-muted-foreground mb-6">
          One studio · Five storytelling crafts
        </p>
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {PILLARS.map(({ icon: Icon, label, tag }) => (
            <li
              key={label}
              className="group relative flex flex-col items-center text-center gap-2.5 px-4 py-5 rounded-xl border border-border/50 bg-card/50 hover:border-primary/40 hover:bg-card/80 transition-all"
            >
              <span
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10"
                style={{ boxShadow: "0 0 0 4px var(--accent-glow)" }}
              >
                <Icon className="h-5 w-5 text-primary" strokeWidth={1.6} />
              </span>
              <div className="font-display text-base font-semibold tracking-tight text-foreground">
                {label}
              </div>
              <div className="h-px w-6 bg-primary/40" />
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {tag}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
