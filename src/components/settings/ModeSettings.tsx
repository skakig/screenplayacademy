import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { upsertOnboarding } from "@/lib/onboarding.functions";
import { useOnboarding } from "@/hooks/use-onboarding";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n/t";

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

  const showChooserAgain = () => {
    try {
      window.localStorage.removeItem("lovable.modeChooser.v1");
      toast.success(t("mode.settings.reopenToast"));
    } catch {
      /* ignore */
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <h2 className="font-semibold">{t("mode.settings.title")}</h2>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label>{t("mode.settings.title")}</Label>
          <Select value={mode} onValueChange={(v: "guided" | "studio") => mutate.mutate({ preferred_mode: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="guided">{t("mode.basic")} — {t("mode.basic.tagline")}</SelectItem>
              <SelectItem value="studio">{t("mode.advanced")} — {t("mode.advanced.tagline")}</SelectItem>
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
      <div className="pt-2 border-t border-border/40">
        <button
          type="button"
          onClick={showChooserAgain}
          className="text-xs text-primary hover:underline"
        >
          {t("mode.settings.reopenChooser")}
        </button>
      </div>
    </Card>
  );
}
