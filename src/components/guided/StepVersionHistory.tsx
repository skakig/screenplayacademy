import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, RotateCcw, Trash2, Sparkles, User, FileInput, Loader2 } from "lucide-react";
import { listStepVersions, deleteStepVersion } from "@/lib/academy.functions";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const SOURCE_META: Record<string, { icon: any; label: string; tone: string }> = {
  ai: { icon: Sparkles, label: "AI", tone: "text-primary" },
  manual: { icon: User, label: "Draft", tone: "text-muted-foreground" },
  applied: { icon: FileInput, label: "Applied", tone: "text-emerald-500" },
};

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

  return (
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
        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</div>
        ) : versions.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No saved versions yet. AI generations and applied changes are saved here automatically.
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-3 pr-3">
              {versions.map((v: any) => {
                const meta = SOURCE_META[v.source] ?? SOURCE_META.manual;
                const Icon = meta.icon;
                return (
                  <div key={v.id} className="rounded-md border border-border/60 bg-card/40 p-3">
                    <div className="flex items-center gap-2 mb-2">
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
  );
}
