import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { upsertOnboarding } from "@/lib/onboarding.functions";
import { useOnboarding } from "@/hooks/use-onboarding";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

export function ModeSettings() {
  const qc = useQueryClient();
  const { data: onboarding } = useOnboarding();
  const upsertFn = useServerFn(upsertOnboarding);

  const mutate = useMutation({
    mutationFn: (patch: { preferred_mode?: "guided" | "studio"; coaching_level?: "off" | "gentle" | "active" | "teaching" }) =>
      upsertFn({ data: patch }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding"] });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mode = onboarding?.preferred_mode ?? "studio";
  const coach = onboarding?.coaching_level ?? "gentle";

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <h2 className="font-semibold">Mode & Coaching</h2>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label>Writing mode</Label>
          <Select value={mode} onValueChange={(v: "guided" | "studio") => mutate.mutate({ preferred_mode: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="guided">Guided — walk me through it</SelectItem>
              <SelectItem value="studio">Studio — straight to the editor</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1.5">Changes Dashboard layout and surfaces the First Screenplay Path.</p>
        </div>
        <div>
          <Label>Coach Mode</Label>
          <Select value={coach} onValueChange={(v: "off" | "gentle" | "active" | "teaching") => mutate.mutate({ coaching_level: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="off">Off</SelectItem>
              <SelectItem value="gentle">Gentle — only when something's off</SelectItem>
              <SelectItem value="active">Active — craft suggestions as you write</SelectItem>
              <SelectItem value="teaching">Teaching — explain the principle each time</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1.5">Editor tips appear in collapsible cards, never popups.</p>
        </div>
      </div>
    </Card>
  );
}
