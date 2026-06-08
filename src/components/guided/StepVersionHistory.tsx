import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  History,
  RotateCcw,
  Trash2,
  Sparkles,
  User,
  FileInput,
  Loader2,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { listStepVersions, deleteStepVersion } from "@/lib/academy.functions";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const SOURCE_META: Record<string, { icon: any; label: string; tone: string }> = {
  ai: { icon: Sparkles, label: "AI", tone: "text-primary" },
  manual: { icon: User, label: "Draft", tone: "text-muted-foreground" },
  applied: { icon: FileInput, label: "Applied", tone: "text-emerald-500" },
};

type Version = {
  id: string;
  source: string;
  label: string | null;
  content: string;
  created_at: string;
};

/* ---------- lightweight diff ---------- */
function computeDiff(left: string, right: string) {
  const a = left.split("\n");
  const b = right.split("\n");
  const m = a.length;
  const n = b.length;

  // LCS
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const lines: {
    type: "same" | "del" | "add";
    left?: string;
    right?: string;
  }[] = [];
  let i = 0, j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && a[i] === b[j]) {
      lines.push({ type: "same", left: a[i], right: b[j] });
      i++; j++;
    } else if (j < n && (i >= m || dp[i][j + 1] >= dp[i + 1][j])) {
      lines.push({ type: "add", right: b[j] });
      j++;
    } else if (i < m && (j >= n || dp[i][j + 1] < dp[i + 1][j])) {
      lines.push({ type: "del", left: a[i] });
      i++;
    } else {
      break;
    }
  }
  return lines;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function DiffView({ base, compare }: { base: Version; compare: Version }) {
  const lines = useMemo(() => computeDiff(base.content, compare.content), [base.content, compare.content]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <ChevronLeft className="h-3 w-3" />
          {formatDistanceToNow(new Date(base.created_at), { addSuffix: true })}
          <span className="uppercase tracking-wider ml-1">({SOURCE_META[base.source]?.label ?? base.source})</span>
        </div>
        <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <span className="uppercase tracking-wider">({SOURCE_META[compare.source]?.label ?? compare.source})</span>
          {formatDistanceToNow(new Date(compare.created_at), { addSuffix: true })}
          <ChevronRight className="h-3 w-3" />
        </div>
      </div>
      <ScrollArea className="flex-1 border rounded-md bg-background/40">
        <div className="text-xs font-mono min-w-[600px]">
          {lines.map((ln, idx) => {
            if (ln.type === "same") {
              return (
                <div key={idx} className="flex">
                  <div className="w-1/2 p-1.5 border-r border-border/30 whitespace-pre-wrap text-foreground/80">{ln.left}</div>
                  <div className="w-1/2 p-1.5 whitespace-pre-wrap text-foreground/80">{ln.right}</div>
                </div>
              );
            }
            if (ln.type === "del") {
              return (
                <div key={idx} className="flex">
                  <div className="w-1/2 p-1.5 border-r border-border/30 whitespace-pre-wrap bg-red-500/10 text-red-700 dark:text-red-300">
                    <span className="inline-block w-4 text-red-500 select-none">−</span>
                    {ln.left}
                  </div>
                  <div className="w-1/2 p-1.5 whitespace-pre-wrap bg-muted/20" />
                </div>
              );
            }
            return (
              <div key={idx} className="flex">
                <div className="w-1/2 p-1.5 border-r border-border/30 whitespace-pre-wrap bg-muted/20" />
                <div className="w-1/2 p-1.5 whitespace-pre-wrap bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                  <span className="inline-block w-4 text-emerald-500 select-none">+</span>
                  {ln.right}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

export function StepVersionHistory({
  projectId,
  stepKey,
  onRestore,
}: {
  projectId: string;
  stepKey: string;
  onRestore: (content: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [diffOpen, setDiffOpen] = useState(false);
  const qc = useQueryClient();
  const listFn = useServerFn(listStepVersions);
  const delFn = useServerFn(deleteStepVersion);

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ["step-versions", projectId, stepKey],
    queryFn: () => listFn({ data: { projectId, stepKey } }),
    enabled: open,
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["step-versions", projectId, stepKey] });
      toast.success("Version deleted");
    },
  });

  const handleToggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const baseVersion = versions.find((v: Version) => v.id === compareIds[0]);
  const compareVersion = versions.find((v: Version) => v.id === compareIds[1]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost">
            <History className="h-3.5 w-3.5 mr-1.5" />History
            {versions.length > 0 && <span className="ml-1.5 text-[10px] text-muted-foreground">({versions.length})</span>}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Version history</DialogTitle>
          </DialogHeader>
          {compareIds.length === 2 && baseVersion && compareVersion && (
            <div className="flex items-center gap-2 mb-2">
              <Button
                size="sm"
                variant="secondary"
                className="h-7 text-xs"
                onClick={() => setDiffOpen(true)}
              >
                <ArrowLeftRight className="h-3 w-3 mr-1" />
                Show diff ({SOURCE_META[baseVersion.source]?.label ?? baseVersion.source} vs {SOURCE_META[compareVersion.source]?.label ?? compareVersion.source})
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setCompareIds([])}
              >
                <X className="h-3 w-3 mr-1" />Clear
              </Button>
            </div>
          )}
          {isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</div>
          ) : versions.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No saved versions yet. AI generations and applied changes are saved here automatically.
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-3 pr-3">
                {versions.map((v: Version) => {
                  const meta = SOURCE_META[v.source] ?? SOURCE_META.manual;
                  const Icon = meta.icon;
                  const isSelected = compareIds.includes(v.id);
                  return (
                    <div
                      key={v.id}
                      className={`rounded-md border p-3 transition-colors ${
                        isSelected ? "border-primary/60 bg-primary/5" : "border-border/60 bg-card/40"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          className="accent-primary h-3.5 w-3.5"
                          checked={isSelected}
                          onChange={() => handleToggleCompare(v.id)}
                          title="Select for compare"
                        />
                        <Icon className={`h-3.5 w-3.5 ${meta.tone}`} />
                        <span className={`text-[10px] uppercase tracking-wider font-semibold ${meta.tone}`}>{meta.label}</span>
                        {v.label && <span className="text-xs text-foreground/70">· {v.label}</span>}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <pre className="text-xs whitespace-pre-wrap font-sans text-foreground/85 max-h-40 overflow-auto bg-background/40 rounded p-2 border border-border/30">
                        {v.content}
                      </pre>
                      <div className="flex justify-end gap-1 mt-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => del.mutate(v.id)}
                          disabled={del.isPending}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />Delete
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => {
                            onRestore(v.content);
                            setOpen(false);
                            toast.success("Version restored to draft");
                          }}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />Restore
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Diff Dialog */}
      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Compare versions</DialogTitle>
          </DialogHeader>
          {baseVersion && compareVersion ? (
            <DiffView base={baseVersion} compare={compareVersion} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Select two versions to compare.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
