import { Sparkles, FileText, Pencil, Loader2, Wand2 } from "lucide-react";
import { useState } from "react";

type Props = {
  hasLogline: boolean;
  onUseTemplate: () => void | Promise<void>;
  onDraftWithAi: () => void | Promise<void>;
  onStartFromScratch: () => void | Promise<void>;
  onOpenStoryBuilder: () => void;
};

export function EmptyEditorTeacher({ hasLogline, onUseTemplate, onDraftWithAi, onStartFromScratch, onOpenStoryBuilder }: Props) {
  const [busy, setBusy] = useState<null | "template" | "ai" | "scratch">(null);
  const run = (kind: "template" | "ai" | "scratch", fn: () => void | Promise<void>) => async () => {
    setBusy(kind);
    try { await fn(); } finally { setBusy(null); }
  };

  return (
    <div className="text-center py-10 font-sans">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
        <Pencil className="h-5 w-5 text-primary" />
      </div>
      <h2 className="text-xl font-semibold mb-1">Where you write your screenplay</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
        This page is the actual script — every line you write here becomes a page in the manuscript. Pick how you want to start.
      </p>

      {/* Featured: Story Builder */}
      <div className="max-w-2xl mx-auto mb-3">
        <button
          onClick={onOpenStoryBuilder}
          disabled={!!busy}
          className="w-full rounded-lg border-2 border-primary/40 bg-gradient-to-br from-primary/[0.08] to-primary/[0.02] hover:border-primary/70 hover:bg-primary/[0.06] transition p-5 text-left disabled:opacity-60"
        >
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 shrink-0 rounded-md bg-primary/15 inline-flex items-center justify-center">
              <Wand2 className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm mb-0.5 flex items-center gap-1.5">
                Build my story with me
                <span className="text-[10px] uppercase tracking-wider text-primary/80 font-mono px-1.5 py-0.5 rounded bg-primary/15">recommended</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Three questions → logline, 8-beat outline, and starter characters. The app does the structural thinking so you can write.
              </div>
            </div>
          </div>
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left">
        <button
          disabled={!!busy}
          onClick={run("scratch", onStartFromScratch)}
          className="rounded-lg border border-border bg-card/60 hover:border-primary/50 hover:bg-primary/[0.04] transition p-4 text-left disabled:opacity-60"
        >
          <Pencil className="h-4 w-4 text-primary mb-2" />
          <div className="font-semibold text-sm mb-1 flex items-center gap-1.5">
            Just start writing
            {busy === "scratch" && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>
          <div className="text-xs text-muted-foreground">Drops an empty scene heading and parks your cursor there.</div>
        </button>
        <button
          disabled={!!busy}
          onClick={run("template", onUseTemplate)}
          className="rounded-lg border border-border bg-card/60 hover:border-primary/50 hover:bg-primary/[0.04] transition p-4 text-left disabled:opacity-60"
        >
          <FileText className="h-4 w-4 text-primary mb-2" />
          <div className="font-semibold text-sm mb-1 flex items-center gap-1.5">
            Use a template
            {busy === "template" && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>
          <div className="text-xs text-muted-foreground">FADE IN → scene heading → action → dialogue scaffolding.</div>
        </button>
        <button
          disabled={!!busy}
          onClick={run("ai", onDraftWithAi)}
          className="rounded-lg border border-border bg-card/60 hover:border-primary/50 hover:bg-primary/[0.04] transition p-4 text-left disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4 text-primary mb-2" />
          <div className="font-semibold text-sm mb-1 flex items-center gap-1.5">
            AI drafts the opening
            {busy === "ai" && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>
          <div className="text-xs text-muted-foreground">
            {hasLogline ? "Uses your logline to spark a 1–2 page opening." : "Tip: write a logline first for stronger results."}
          </div>
        </button>
      </div>
    </div>
  );
}
