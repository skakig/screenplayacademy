import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { upsertOnboarding } from "@/lib/onboarding.functions";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useWriteMode } from "@/hooks/use-write-mode";
import { PencilLine, Clapperboard, Mic } from "lucide-react";
import { toast } from "sonner";

type DeskMode = "writer" | "studio" | "rehearsal";

/**
 * Writer's Desk three-way mode toggle.
 *
 * Composes the existing hooks — no schema or storage changes:
 *  - Writer    → useWriteMode.on (focus on the page, hide side panels)
 *  - Studio    → useWriteMode off + preferred_mode = "studio"
 *  - Rehearsal → useWriteMode off + preferred_mode = "guided"
 *
 * The Director's Chair stays available; Rehearsal just biases the right
 * panel toward the guided/coaching tab via `coachDefaultTab` upstream.
 */
export function WriterDeskModeToggle() {
  const { data: onboarding } = useOnboarding();
  const qc = useQueryClient();
  const upsert = useServerFn(upsertOnboarding);
  const writeMode = useWriteMode();

  const preferred = (onboarding?.preferred_mode ?? "studio") as "studio" | "guided";
  const mode: DeskMode = writeMode.on ? "writer" : preferred === "guided" ? "rehearsal" : "studio";

  const setPreferred = useMutation({
    mutationFn: (next: "studio" | "guided") => upsert({ data: { preferred_mode: next } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding"] }),
  });

  const select = (next: DeskMode) => {
    if (next === mode) return;
    if (next === "writer") {
      if (!writeMode.on) writeMode.toggle();
      toast.success("Writer mode — page only", { duration: 1200 });
      return;
    }
    // studio or rehearsal — make sure focus mode is off
    if (writeMode.on) writeMode.toggle();
    if (next === "studio" && preferred !== "studio") {
      setPreferred.mutate("studio");
      toast.success("Studio mode", { duration: 1200 });
    } else if (next === "rehearsal" && preferred !== "guided") {
      setPreferred.mutate("guided");
      toast.success("Rehearsal mode", { duration: 1200 });
    }
  };

  const Item = ({ value, icon: Icon, label }: { value: DeskMode; icon: typeof PencilLine; label: string }) => {
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
      aria-label="Writer's Desk mode"
      className="inline-flex items-center rounded-full border border-border/60 bg-card/60 backdrop-blur p-0.5 font-sans"
    >
      <Item value="writer" icon={PencilLine} label="Writer" />
      <Item value="studio" icon={Clapperboard} label="Studio" />
      <Item value="rehearsal" icon={Mic} label="Rehearsal" />
    </div>
  );
}
