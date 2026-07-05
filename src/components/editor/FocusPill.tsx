import { useWriteMode } from "@/hooks/use-write-mode";
import { Minimize2, X } from "lucide-react";
import { t } from "@/lib/i18n/t";

/**
 * Small floating pill visible only in Focus Mode. Shows the mode label and
 * an "Exit Focus" button with an Esc hint.
 */
export function FocusPill() {
  const writeMode = useWriteMode();
  if (!writeMode.on) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
      <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card/90 backdrop-blur px-3 py-1.5 shadow-lg text-xs font-sans">
        <Minimize2 className="h-3 w-3 text-primary" />
        <span className="font-medium">{t("mode.focus.pill")}</span>
        <span className="opacity-40">·</span>
        <button
          type="button"
          onClick={() => writeMode.set(false)}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
          aria-label={t("mode.focus.exit")}
        >
          <X className="h-3 w-3" />
          {t("mode.focus.exit")}
        </button>
        <span className="hidden sm:inline text-[10px] font-mono text-muted-foreground/70">
          {t("mode.focus.escHint")}
        </span>
      </div>
    </div>
  );
}
