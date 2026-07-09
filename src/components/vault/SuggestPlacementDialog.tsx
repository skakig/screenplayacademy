import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Sparkles } from "lucide-react";
import { suggestPlacement } from "@/lib/vault/vaultAi.functions";
import type { VaultSceneRow } from "@/lib/vault/schemas";

const ACT_LABEL: Record<string, string> = {
  act_1: "Act I",
  act_2a: "Act II-A",
  midpoint: "Midpoint",
  act_2b: "Act II-B",
  act_3: "Act III",
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scene: VaultSceneRow;
  scenes: Array<{ id: string; title: string | null; scene_heading: string | null; order_index: number }>;
  onPick: (destination: string, referenceSceneId: string | null, position: "before" | "after") => void;
};

export function SuggestPlacementDialog({ open, onOpenChange, scene, scenes, onPick }: Props) {
  const fn = useServerFn(suggestPlacement);
  const q = useQuery({
    enabled: open,
    queryKey: ["suggest-placement", scene.id],
    queryFn: () => fn({ data: { vaultSceneId: scene.id } }),
  });

  const label = (id: string | null) => {
    if (!id) return null;
    const s = scenes.find((x) => x.id === id);
    return s ? `#${s.order_index + 1} ${s.title ?? s.scene_heading ?? "(untitled)"}` : null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Suggested Placements
          </DialogTitle>
          <DialogDescription>Where this scene might belong in your story.</DialogDescription>
        </DialogHeader>

        {q.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading your story…
          </div>
        ) : q.isError ? (
          <div className="text-sm text-destructive">Couldn't get suggestions right now.</div>
        ) : (q.data?.suggestions.length ?? 0) === 0 ? (
          <div className="text-sm text-muted-foreground py-4">
            No confident placements yet — try filling in more of your outline first.
          </div>
        ) : (
          <ul className="space-y-2">
            {q.data?.suggestions.map((s, i) => {
              const after = label(s.afterSceneId);
              const before = label(s.beforeSceneId);
              return (
                <li key={i}>
                  <button
                    className="w-full text-left rounded-md border border-border/70 p-3 hover:bg-muted transition"
                    onClick={() => {
                      if (s.afterSceneId) onPick("custom", s.afterSceneId, "after");
                      else if (s.beforeSceneId) onPick("custom", s.beforeSceneId, "before");
                      else onPick(s.act, null, "after");
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-sm">{ACT_LABEL[s.act] ?? s.act}</div>
                      <div className="text-[10px] uppercase text-muted-foreground">
                        {Math.round(s.confidence * 100)}% confidence
                      </div>
                    </div>
                    {(after || before) && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {after ? `After ${after}` : `Before ${before}`}
                      </div>
                    )}
                    <p className="text-xs mt-1.5">{s.rationale}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
