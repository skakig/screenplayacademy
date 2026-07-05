import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { upsertOnboarding } from "@/lib/onboarding.functions";
import { useOnboarding } from "@/hooks/use-onboarding";
import { Compass, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n/t";

export function StudioModeToggle() {
  const { data: onboarding } = useOnboarding();
  const qc = useQueryClient();
  const upsert = useServerFn(upsertOnboarding);
  const mode = (onboarding?.preferred_mode ?? "studio") as "studio" | "guided";

  const setMode = useMutation({
    mutationFn: (next: "studio" | "guided") =>
      upsert({ data: { preferred_mode: next } }),
    onSuccess: (_d, next) => {
      qc.invalidateQueries({ queryKey: ["onboarding"] });
      toast.success(next === "guided" ? t("mode.basic.toast") : t("mode.advanced.toast"));
    },
  });

  return (
    <div className="inline-flex items-center rounded-full border border-border/60 bg-card/60 backdrop-blur p-0.5 text-xs font-sans">
      <button
        onClick={() => mode !== "studio" && setMode.mutate("studio")}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors ${
          mode === "studio"
            ? "bg-primary text-primary-foreground font-semibold shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <LayoutDashboard className="h-3 w-3" /> {t("mode.advanced")}
      </button>
      <button
        onClick={() => mode !== "guided" && setMode.mutate("guided")}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors ${
          mode === "guided"
            ? "bg-primary text-primary-foreground font-semibold shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Compass className="h-3 w-3" /> {t("mode.basic")}
      </button>
    </div>
  );
}
