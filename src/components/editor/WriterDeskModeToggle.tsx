import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { upsertOnboarding } from "@/lib/onboarding.functions";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useWriteMode } from "@/hooks/use-write-mode";
import { Minimize2, Compass, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n/t";

type DeskMode = "focus" | "basic" | "advanced";

/**
 * Three-way writer mode toggle: Focus / Basic / Advanced.
 *
 *  - Focus    → useWriteMode.on = true (hide side panels, distraction-free)
 *  - Basic    → useWriteMode.on = false + preferred_mode = "guided"
 *  - Advanced → useWriteMode.on = false + preferred_mode = "studio"
 */
export function WriterDeskModeToggle() {
  const { data: onboarding } = useOnboarding();
  const qc = useQueryClient();
  const upsert = useServerFn(upsertOnboarding);
  const writeMode = useWriteMode();

  const preferred = (onboarding?.preferred_mode ?? "studio") as "studio" | "guided";
  const coach = (onboarding?.coaching_level ?? "gentle") as "off" | "gentle" | "active" | "teaching";
  const mode: DeskMode = writeMode.on ? "focus" : preferred === "guided" ? "basic" : "advanced";

  const setOnboarding = useMutation({
    mutationFn: (patch: {
      preferred_mode?: "studio" | "guided";
      coaching_level?: "off" | "gentle" | "active" | "teaching";
    }) => upsert({ data: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding"] }),
  });

  const select = (next: DeskMode) => {
    if (next === mode) return;
    if (next === "focus") {
      writeMode.set(true);
      toast.success(t("mode.focus.toast"), { duration: 1200 });
      return;
    }
    // Basic or Advanced — turn Focus off
    writeMode.set(false);
    if (next === "basic") {
      const patch: Parameters<typeof setOnboarding.mutate>[0] = {};
      if (preferred !== "guided") patch.preferred_mode = "guided";
      // Bump coaching to at least "teaching" for beginners.
      if (coach === "off" || coach === "gentle") patch.coaching_level = "teaching";
      if (Object.keys(patch).length) setOnboarding.mutate(patch);
      toast.success(t("mode.basic.toast"), { duration: 1200 });
    } else if (next === "advanced") {
      if (preferred !== "studio") setOnboarding.mutate({ preferred_mode: "studio" });
      toast.success(t("mode.advanced.toast"), { duration: 1200 });
    }
  };

  const Item = ({
    value,
    icon: Icon,
    label,
  }: {
    value: DeskMode;
    icon: typeof Minimize2;
    label: string;
  }) => {
    const active = mode === value;
    return (
      <button
        type="button"
        onClick={() => select(value)}
        aria-pressed={active}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-xs ${
          active
            ? "bg-primary text-primary-foreground font-semibold shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Icon className="h-3 w-3" />
        {label}
      </button>
    );
  };

  return (
    <div
      role="group"
      aria-label={t("mode.groupLabel")}
      className="inline-flex items-center rounded-full border border-border/60 bg-card/60 backdrop-blur p-0.5 font-sans"
    >
      <Item value="focus" icon={Minimize2} label={t("mode.focus")} />
      <Item value="basic" icon={Compass} label={t("mode.basic")} />
      <Item value="advanced" icon={LayoutDashboard} label={t("mode.advanced")} />
    </div>
  );
}
