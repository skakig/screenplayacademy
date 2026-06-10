import { useMemo, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeftRight, Bookmark, Check } from "lucide-react";
import type { DraftPayload } from "./draftBackup";
import { diffTakes, diffSummary } from "./takeDiff";
import { format } from "date-fns";

export type TakeSummary = {
  id: string;
  name: string;
  capturedAt: number;
  payload: DraftPayload;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  left: TakeSummary | null;
  right: TakeSummary | null;
  onSave?: (label: string) => void;
  defaultLabel?: string;
};

const opStyle: Record<string, string> = {
  equal: "bg-background/40 border-border/30 text-muted-foreground",
  added: "bg-emerald-500/10 border-emerald-500/30 text-emerald-100",
  removed: "bg-rose-500/10 border-rose-500/30 text-rose-100",
  changed: "bg-amber-500/10 border-amber-500/30 text-amber-100",
};

function BlockCell({
  block,
  op,
  side,
}: {
  block?: { block_type?: string; content?: string; index: number };
  op: string;
  side: "left" | "right";
}) {
  // Render filler for added/removed asymmetry
  const empty = !block;
  const show =
    (side === "left" && (op === "equal" || op === "removed" || op === "changed")) ||
    (side === "right" && (op === "equal" || op === "added" || op === "changed"));
  if (!show || empty) {
    return (
      <div className="flex-1 min-w-0 rounded border border-dashed border-border/20 bg-background/20 min-h-[2.25rem]" />
    );
  }
  return (
    <div
      className={`flex-1 min-w-0 rounded border px-2 py-1.5 ${opStyle[op]}`}
    >
      <p className="text-[9px] uppercase tracking-wider font-mono opacity-60 mb-0.5">
        {block.block_type ?? "block"}
      </p>
      <p className="text-xs whitespace-pre-wrap break-words font-mono leading-snug">
        {block.content || <em className="opacity-50">(empty)</em>}
      </p>
    </div>
  );
}

export function TakeDiffViewer({ open, onOpenChange, left, right, onSave, defaultLabel }: Props) {
  const rows = useMemo(
    () => (left && right ? diffTakes(left.payload, right.payload) : []),
    [left, right],
  );
  const summary = useMemo(() => diffSummary(rows), [rows]);
  const [label, setLabel] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setLabel(defaultLabel ?? (left && right ? `${left.name} ↔ ${right.name}` : ""));
      setSaved(false);
    }
  }, [open, defaultLabel, left, right]);

  if (!left || !right) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-primary" />
            Compare takes
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">{left.name}</Badge>
            <span className="text-muted-foreground">vs.</span>
            <Badge variant="outline">{right.name}</Badge>
            <span className="text-muted-foreground ml-auto flex flex-wrap gap-1.5">
              <Badge className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/20">
                +{summary.added} added
              </Badge>
              <Badge className="bg-rose-500/20 text-rose-100 hover:bg-rose-500/20">
                −{summary.removed} removed
              </Badge>
              <Badge className="bg-amber-500/20 text-amber-100 hover:bg-amber-500/20">
                ~{summary.changed} changed
              </Badge>
              <Badge variant="secondary">{summary.equal} unchanged</Badge>
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground font-mono px-1">
          <div>
            <strong className="text-foreground/80">A</strong> · {left.name} ·{" "}
            {format(left.capturedAt, "MMM d, HH:mm")}
          </div>
          <div>
            <strong className="text-foreground/80">B</strong> · {right.name} ·{" "}
            {format(right.capturedAt, "MMM d, HH:mm")}
          </div>
        </div>

        {onSave && (
          <div className="flex items-center gap-2 rounded-md border border-border/50 bg-card/40 px-2 py-1.5">
            <Bookmark className="h-3.5 w-3.5 text-primary shrink-0" />
            <Input
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                setSaved(false);
              }}
              placeholder="Comparison label"
              className="h-7 text-xs flex-1"
            />
            <Button
              size="sm"
              variant={saved ? "secondary" : "outline"}
              className="h-7 text-[11px] px-2"
              disabled={!label.trim() || saved}
              onClick={() => {
                onSave(label.trim());
                setSaved(true);
              }}
            >
              {saved ? (
                <><Check className="h-3 w-3 mr-1" />Saved</>
              ) : (
                "Save comparison"
              )}
            </Button>
          </div>
        )}


        <ScrollArea className="h-[60vh] pr-2">
          <ul className="space-y-1.5">
            {rows.map((r, idx) => (
              <li key={idx} className="flex gap-2 items-stretch">
                <BlockCell block={r.left} op={r.op} side="left" />
                <BlockCell block={r.right} op={r.op} side="right" />
              </li>
            ))}
            {rows.length === 0 && (
              <p className="text-xs text-muted-foreground italic text-center py-12">
                Both takes are empty.
              </p>
            )}
          </ul>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
