// Pass 1 debug surface. Behind a hidden query param (?merge=1) on the
// Characters route. This is the ONLY UI Pass 1 ships; the real Detected
// Characters Inbox lands in Pass 2.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  proposeCharacterMerges, mergeCharacters, rememberKeepSeparate,
} from "@/lib/characters/identity.functions";

type Proposal = {
  a: { id: string; name: string };
  b: { id: string; name: string };
  score: number;
  reasons: string[];
};

export function MergeReviewDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const propose = useServerFn(proposeCharacterMerges);
  const merge = useServerFn(mergeCharacters);
  const keepSep = useServerFn(rememberKeepSeparate);
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["merge-proposals", projectId, open],
    queryFn: () => propose({ data: { projectId } }),
    enabled: open,
  });

  const proposals: Proposal[] = data?.proposals ?? [];
  const [active, setActive] = useState<Proposal | null>(null);
  const selected = useMemo(() => active ?? proposals[0] ?? null, [active, proposals]);

  async function handleMerge(primary: { id: string; name: string }, secondary: { id: string; name: string }) {
    if (confirmName.trim() !== primary.name.trim()) {
      toast.error("Type the surviving character's name to confirm.");
      return;
    }
    setBusy(true);
    try {
      await merge({ data: {
        projectId,
        primaryId: primary.id,
        mergedIds: [secondary.id],
        chosenValues: {},
        survivingName: primary.name,
      } });
      toast.success(`Merged ${secondary.name} → ${primary.name}. Undo available for 90 days.`);
      setActive(null);
      setConfirmName("");
      await refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Merge failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleKeepSeparate(p: Proposal) {
    setBusy(true);
    try {
      await keepSep({ data: { projectId, characterIdA: p.a.id, characterIdB: p.b.id } });
      toast.success("Won't propose again.");
      setActive(null);
      await refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Merge review (debug)</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Analyzing cast…</div>
        ) : proposals.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No likely duplicates detected. This surface is Pass&nbsp;1 shadow mode;
            the real Detected Characters Inbox arrives in Pass&nbsp;2.
          </div>
        ) : (
          <div className="grid grid-cols-[280px_1fr] gap-4 max-h-[60vh]">
            <div className="space-y-2 overflow-auto pr-2">
              {proposals.map((p, i) => (
                <button
                  key={i}
                  className={`w-full text-left rounded-md border p-2 hover:bg-muted ${selected === p ? "bg-muted" : ""}`}
                  onClick={() => { setActive(p); setConfirmName(""); }}
                >
                  <div className="text-sm font-medium">{p.a.name} ↔ {p.b.name}</div>
                  <div className="text-xs text-muted-foreground">score {p.score.toFixed(2)}</div>
                </button>
              ))}
            </div>

            {selected && (
              <Card className="p-4 space-y-4 overflow-auto">
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Candidates</div>
                  <div className="grid grid-cols-2 gap-3">
                    {[selected.a, selected.b].map((c) => (
                      <div key={c.id} className="rounded-md border p-3">
                        <div className="font-semibold text-sm">{c.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-1 font-mono truncate">{c.id}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Evidence</div>
                  <div className="flex flex-wrap gap-1">
                    {selected.reasons.map((r) => (
                      <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <div className="text-xs text-muted-foreground">
                    Confirm by typing the surviving character's name exactly:
                  </div>
                  <Input
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={selected.a.name}
                  />
                  <div className="flex gap-2 pt-2 flex-wrap">
                    <Button
                      disabled={busy}
                      onClick={() => handleMerge(selected.a, selected.b)}
                    >
                      Keep <b className="mx-1">{selected.a.name}</b>, merge {selected.b.name}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => handleMerge(selected.b, selected.a)}
                    >
                      Keep <b className="mx-1">{selected.b.name}</b>, merge {selected.a.name}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => handleKeepSeparate(selected)}
                    >
                      Keep separate
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
