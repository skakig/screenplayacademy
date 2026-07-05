import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { upsertOnboarding } from "@/lib/onboarding.functions";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useWriteMode } from "@/hooks/use-write-mode";
import { Minimize2, Compass, LayoutDashboard } from "lucide-react";
import { t } from "@/lib/i18n/t";

const LS_KEY = "lovable.modeChooser.v1";

type Choice = "focus" | "basic" | "advanced";

export function FirstRunModeDialog() {
  const { data: onboarding, isLoading } = useOnboarding();
  const qc = useQueryClient();
  const upsert = useServerFn(upsertOnboarding);
  const writeMode = useWriteMode();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (typeof window === "undefined") return;
    let seen = false;
    try {
      seen = window.localStorage.getItem(LS_KEY) === "1";
    } catch {
      /* ignore */
    }
    if (!seen) setOpen(true);
  }, [isLoading]);

  const save = useMutation({
    mutationFn: (patch: {
      preferred_mode?: "studio" | "guided";
      coaching_level?: "off" | "gentle" | "active" | "teaching";
      app_walkthrough_completed?: boolean;
    }) => upsert({ data: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding"] }),
  });

  const pick = async (choice: Choice) => {
    try {
      window.localStorage.setItem(LS_KEY, "1");
    } catch {
      /* ignore */
    }
    if (choice === "focus") {
      writeMode.set(true);
      save.mutate({ app_walkthrough_completed: true });
    } else if (choice === "basic") {
      writeMode.set(false);
      save.mutate({
        preferred_mode: "guided",
        coaching_level: "teaching",
        app_walkthrough_completed: true,
      });
    } else {
      writeMode.set(false);
      save.mutate({ preferred_mode: "studio", app_walkthrough_completed: true });
    }
    setOpen(false);
  };

  const Card = ({
    choice,
    icon: Icon,
    label,
    tagline,
  }: {
    choice: Choice;
    icon: typeof Minimize2;
    label: string;
    tagline: string;
  }) => (
    <button
      type="button"
      onClick={() => pick(choice)}
      className="text-left rounded-lg border border-border/60 bg-card/60 hover:bg-card hover:border-primary/60 transition p-4 flex flex-col gap-2 focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <h3 className="font-semibold">{label}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{tagline}</p>
      <span className="mt-1 text-xs text-primary font-medium">{t("mode.chooser.pick")} →</span>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("mode.chooser.title")}</DialogTitle>
          <DialogDescription>{t("mode.chooser.subtitle")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card choice="focus" icon={Minimize2} label={t("mode.focus")} tagline={t("mode.focus.tagline")} />
          <Card choice="basic" icon={Compass} label={t("mode.basic")} tagline={t("mode.basic.tagline")} />
          <Card choice="advanced" icon={LayoutDashboard} label={t("mode.advanced")} tagline={t("mode.advanced.tagline")} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
