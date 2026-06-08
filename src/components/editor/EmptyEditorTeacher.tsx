import { Button } from "@/components/ui/button";
import { Sparkles, FileText, Pencil, Loader2 } from "lucide-react";
import { useState } from "react";

type Props = {
  hasLogline: boolean;
  onUseTemplate: () => void | Promise<void>;
  onDraftWithAi: () => void | Promise<void>;
  onStartFromScratch: () => void | Promise<void>;
};

export function EmptyEditorTeacher({ hasLogline, onUseTemplate, onDraftWithAi, onStartFromScratch }: Props) {
  const [busy, setBusy] = useState<null | "template" | "ai" | "scratch">(null);
  const run = (kind: "template" | "ai" | "scratch", fn: () => void | Promise<void>) => async () => {
    setBusy(kind);
    try { await fn(); } finally { setBusy(null); }
  };

  return (
    <div className="text-center py-12 font-sans">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
        <Pencil className="h-5 w-5 text-primary" />
      </div>
      <h2 className="text-xl font-semibold mb-1">Welcome to your editor</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
        Pick the way you want to start. You can always switch later — these are just safe on-ramps.
      </p>
      <div className="grid sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left">
        <button
          disabled={!!busy}
          onClick={run("template", onUseTemplate)}
          className="rounded-lg border border-border bg-card/60 hover:border-primary/50 hover:bg-primary/[0.04] transition p-4 text-left disabled:opacity-60"
        >
          <FileText className="h-4 w-4 text-primary mb-2" />
          <div className="font-semibold text-sm mb-1 flex items-center gap-1.5">
            Use the opening scene template
            {busy === "template" && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>
          <div className="text-xs text-muted-foreground">FADE IN → scene heading → action → dialogue placeholders.</div>
        </button>
        <button
          disabled={!!busy}
          onClick={run("ai", onDraftWithAi)}
          className="rounded-lg border border-border bg-card/60 hover:border-primary/50 hover:bg-primary/[0.04] transition p-4 text-left disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4 text-primary mb-2" />
          <div className="font-semibold text-sm mb-1 flex items-center gap-1.5">
            Let AI draft an opening
            {busy === "ai" && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>
          <div className="text-xs text-muted-foreground">
            {hasLogline ? "Uses your logline to spark a 1–2 page opening." : "Tip: write a logline first for stronger results."}
          </div>
        </button>
        <button
          disabled={!!busy}
          onClick={run("scratch", onStartFromScratch)}
          className="rounded-lg border border-border bg-card/60 hover:border-primary/50 hover:bg-primary/[0.04] transition p-4 text-left disabled:opacity-60"
        >
          <Pencil className="h-4 w-4 text-primary mb-2" />
          <div className="font-semibold text-sm mb-1 flex items-center gap-1.5">
            I'll start from scratch
            {busy === "scratch" && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>
          <div className="text-xs text-muted-foreground">Drops in a single empty scene heading. Type and go.</div>
        </button>
      </div>
    </div>
  );
}
