import { useWriteMode } from "@/hooks/use-write-mode";
import { BLOCK_LABEL } from "@/lib/editor/autoFormat";
import {
  ChevronsUpDown,
  CornerDownLeft,
  Sparkles,
  Minimize2,
  X,
  Loader2,
} from "lucide-react";
import { t } from "@/lib/i18n/t";

type Props = {
  currentBlockType: string | null;
  hasFocus: boolean;
  onCycleType: () => void;
  onNewLine: () => void;
  onAiContinue: () => void;
  aiBusy?: boolean;
};

/**
 * Unified Focus Mode chrome — replaces the three overlapping floaters
 * (block-type pill, command bar, focus pill, vault chip) with a single
 * bottom-anchored accessory bar. Follows the iOS/Highland keyboard-bar
 * pattern: one row, three grouped zones, safe-area padded, no overlap.
 *
 * Only renders when Focus Mode is active. Non-focus editor keeps its
 * existing EditorCommandBar / EditorSummonBar chrome untouched.
 */
export function FocusAccessoryBar({
  currentBlockType,
  hasFocus,
  onCycleType,
  onNewLine,
  onAiContinue,
  aiBusy,
}: Props) {
  const writeMode = useWriteMode();
  if (!writeMode.on) return null;

  const label = currentBlockType ? BLOCK_LABEL[currentBlockType] ?? currentBlockType : "—";

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/75 font-sans"
      role="toolbar"
      aria-label={t("editor.focus.toolbarLabel")}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto max-w-[900px] px-3 sm:px-4 py-2 flex items-center gap-2">
        {/* Left — context */}
        <div className="flex items-center gap-1.5 min-w-0 shrink-0">
          <Minimize2 className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground hidden sm:inline">
            {t("editor.focus.now")}
          </span>
          <span
            className="inline-flex items-center rounded-md bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-medium truncate max-w-[8rem]"
            title={label}
          >
            {label}
          </span>
        </div>

        {/* Center — primary actions */}
        <div className="flex items-center gap-1 mx-auto">
          <button
            type="button"
            onClick={onCycleType}
            disabled={!hasFocus}
            className="inline-flex items-center gap-1 h-9 min-h-[44px] sm:min-h-0 sm:h-8 px-2.5 rounded-md border border-border/60 bg-card/60 hover:bg-card text-xs disabled:opacity-40 transition"
            title={t("editor.focus.changeTitle")}
            aria-label={t("editor.focus.changeType")}
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("editor.focus.change")}</span>
            <kbd className="hidden md:inline text-[9px] text-muted-foreground border border-border rounded px-1 ml-1">Tab</kbd>
          </button>
          <button
            type="button"
            onClick={onNewLine}
            className="inline-flex items-center gap-1 h-9 min-h-[44px] sm:min-h-0 sm:h-8 px-2.5 rounded-md border border-border/60 bg-card/60 hover:bg-card text-xs transition"
            title={t("editor.focus.newLineTitle")}
            aria-label={t("editor.focus.newLine")}
          >
            <CornerDownLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("editor.focus.newLine")}</span>
          </button>
          <button
            type="button"
            onClick={onAiContinue}
            disabled={aiBusy}
            className="inline-flex items-center gap-1 h-9 min-h-[44px] sm:min-h-0 sm:h-8 px-2.5 rounded-md bg-primary text-primary-foreground text-xs disabled:opacity-60 transition"
            title={t("editor.focus.aiContinueTitle")}
            aria-label={t("editor.focus.aiContinue")}
          >
            {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{aiBusy ? t("editor.focus.thinking") : t("editor.focus.aiContinue")}</span>
          </button>
        </div>

        {/* Right — exit */}
        <button
          type="button"
          onClick={() => writeMode.set(false)}
          className="inline-flex items-center gap-1 h-9 min-h-[44px] sm:min-h-0 sm:h-8 px-2.5 rounded-md border border-border/60 bg-card/60 hover:bg-card text-xs text-muted-foreground hover:text-foreground transition shrink-0"
          title={t("editor.focus.exitTitle")}
          aria-label={t("editor.focus.exit")}
        >
          <X className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t("editor.focus.exit")}</span>
          <kbd className="hidden md:inline text-[9px] text-muted-foreground border border-border rounded px-1 ml-1">Esc</kbd>
        </button>
      </div>
    </div>
  );
}
