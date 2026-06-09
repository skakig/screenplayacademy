import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { BLOCK_LABEL } from "@/lib/editor/autoFormat";
import type { ParsedBlock } from "./screenplayAutoFormat";

const TYPES = ["scene_heading","action","character","dialogue","parenthetical","transition","shot","note"];

export function PasteFormatPreviewDialog({
  open,
  blocks,
  onCancel,
  onInsertFormatted,
  onInsertRaw,
}: {
  open: boolean;
  blocks: ParsedBlock[];
  onCancel: () => void;
  onInsertFormatted: (accepted: ParsedBlock[]) => void;
  onInsertRaw: () => void;
}) {
  const [editable, setEditable] = useState<ParsedBlock[]>(blocks);
  const [included, setIncluded] = useState<boolean[]>(blocks.map(() => true));

  // Re-sync if blocks identity changes (new paste)
  useMemo(() => {
    setEditable(blocks);
    setIncluded(blocks.map(() => true));
  }, [blocks]);

  const handleType = (i: number, t: string) => {
    setEditable((prev) => prev.map((b, j) => (j === i ? { ...b, block_type: t } : b)));
  };
  const handleContent = (i: number, c: string) => {
    setEditable((prev) => prev.map((b, j) => (j === i ? { ...b, content: c } : b)));
  };
  const toggle = (i: number) => setIncluded((p) => p.map((v, j) => (j === i ? !v : v)));
  const allIn = included.every(Boolean);

  const confidenceTone = (c: ParsedBlock["confidence"]) =>
    c === "high"
      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
      : c === "medium"
      ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
      : "bg-muted/40 text-muted-foreground border-border/50";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col font-sans">
        <DialogHeader>
          <DialogTitle>Format pasted script</DialogTitle>
          <DialogDescription>
            We detected {blocks.length} block{blocks.length === 1 ? "" : "s"}. Adjust types or content,
            uncheck lines to skip, then insert.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between text-xs text-muted-foreground py-1">
          <button
            type="button"
            className="underline-offset-2 hover:underline"
            onClick={() => setIncluded(blocks.map(() => !allIn))}
          >
            {allIn ? "Uncheck all" : "Check all"}
          </button>
          <span>Confidence: green = high, amber = medium</span>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-1.5">
          {editable.map((b, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-md border p-2 ${
                included[i] ? "bg-card" : "bg-muted/30 opacity-60"
              }`}
            >
              <Checkbox
                checked={included[i]}
                onCheckedChange={() => toggle(i)}
                className="mt-1.5"
                aria-label={`Include block ${i + 1}`}
              />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <Select value={b.block_type} onValueChange={(v) => handleType(i, v)}>
                    <SelectTrigger className="h-7 w-[150px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{BLOCK_LABEL[t] ?? t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span
                    className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${confidenceTone(b.confidence)}`}
                    title={b.reason}
                  >
                    {b.confidence}
                  </span>
                </div>
                <textarea
                  value={b.content}
                  onChange={(e) => handleContent(i, e.target.value)}
                  rows={Math.min(4, Math.max(1, b.content.split("\n").length))}
                  className="w-full bg-transparent text-sm border border-border/50 rounded px-2 py-1 resize-y focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 flex-row justify-end">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="outline" onClick={onInsertRaw}>Insert as plain Action</Button>
          <Button
            onClick={() => onInsertFormatted(editable.filter((_, i) => included[i]))}
            disabled={!included.some(Boolean)}
          >
            Insert formatted ({included.filter(Boolean).length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
