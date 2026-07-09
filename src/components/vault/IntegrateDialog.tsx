import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { IntegrationWarningList } from "./IntegrationWarningList";
import { integrationCheck } from "@/lib/vault/vaultAi.functions";
import { integrateVaultScene } from "@/lib/vault/vaultIntegration.functions";
import type { VaultSceneRow } from "@/lib/vault/schemas";

const DESTS = [
  { v: "act_1", label: "Act I" },
  { v: "act_2a", label: "Act II-A" },
  { v: "midpoint", label: "Midpoint" },
  { v: "act_2b", label: "Act II-B" },
  { v: "act_3", label: "Act III" },
  { v: "custom", label: "Custom position…" },
] as const;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scene: VaultSceneRow;
  scenes: Array<{ id: string; title: string | null; scene_heading: string | null; order_index: number }>;
};

export function IntegrateDialog({ open, onOpenChange, scene, scenes }: Props) {
  const qc = useQueryClient();
  const checkFn = useServerFn(integrationCheck);
  const integrateFn = useServerFn(integrateVaultScene);

  const [destination, setDestination] = useState<(typeof DESTS)[number]["v"]>("act_2a");
  const [refSceneId, setRefSceneId] = useState<string | null>(null);
  const [pos, setPos] = useState<"before" | "after">("after");

  const check = useQuery({
    enabled: open,
    queryKey: ["integration-check", scene.id, destination, refSceneId],
    queryFn: () =>
      checkFn({
        data: { vaultSceneId: scene.id, destination, referenceSceneId: refSceneId ?? undefined },
      }),
  });

  const integrate = useMutation({
    mutationFn: () =>
      integrateFn({
        data: {
          vaultSceneId: scene.id,
          destination,
          referenceSceneId: refSceneId ?? undefined,
          position: pos,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vault-scenes", scene.project_id] });
      qc.invalidateQueries({ queryKey: ["scenes", scene.project_id] });
      toast.success("Sent to the timeline");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canIntegrate = destination !== "custom" || Boolean(refSceneId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Integrate into Timeline</DialogTitle>
          <DialogDescription>
            Copy this vault scene into the timeline. The vault version stays put.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium mb-1 block">Destination</label>
            <Select value={destination} onValueChange={(v) => setDestination(v as typeof destination)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DESTS.map((d) => <SelectItem key={d.v} value={d.v}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {destination === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium mb-1 block">Position</label>
                <Select value={pos} onValueChange={(v) => setPos(v as "before" | "after")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="before">Before</SelectItem>
                    <SelectItem value="after">After</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Reference scene</label>
                <Select value={refSceneId ?? ""} onValueChange={setRefSceneId}>
                  <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                  <SelectContent>
                    {scenes.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        #{s.order_index + 1} {s.title ?? s.scene_heading ?? "(untitled)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="pt-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              <Sparkles className="h-3.5 w-3.5" /> Integration Check
            </div>
            {check.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Reading your story…
              </div>
            ) : check.isError ? (
              <div className="text-sm text-destructive">Couldn't run the check. You can still integrate.</div>
            ) : (
              <>
                {check.data?.summary && (
                  <p className="text-xs text-muted-foreground italic mb-2">{check.data.summary}</p>
                )}
                <IntegrationWarningList warnings={check.data?.warnings ?? []} />
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => integrate.mutate()}
            disabled={!canIntegrate || integrate.isPending}
          >
            {integrate.isPending ? "Integrating…" : "Integrate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
