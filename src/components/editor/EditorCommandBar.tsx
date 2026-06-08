import { Button } from "@/components/ui/button";
import { Sparkles, CornerDownLeft, ChevronsUpDown, Plus } from "lucide-react";
import { BLOCK_LABEL } from "@/lib/editor/autoFormat";

type Props = {
  currentBlockType: string | null;
  onCycleType: () => void;
  onNewLine: () => void;
  onAiContinue: () => void;
  aiBusy?: boolean;
  hasFocus: boolean;
};

/**
 * Sticky writer command bar. Always visible at the bottom of the editor section
 * (desktop) and floats above the mobile keyboard. Shows what element you're in
 * and gives one-tap access to the three things that actually move you forward.
 */
export function EditorCommandBar({
  currentBlockType,
  onCycleType,
  onNewLine,
  onAiContinue,
  aiBusy,
  hasFocus,
}: Props) {
  const label = currentBlockType ? BLOCK_LABEL[currentBlockType] ?? currentBlockType : "—";

  return (
    <div
      className="sticky bottom-0 z-30 -mx-6 lg:-mx-10 mt-6 border-t border-border/60 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 font-sans"
      role="toolbar"
      aria-label="Writer controls"
    >
      <div className="max-w-[680px] mx-auto px-4 py-2 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-muted-foreground uppercase tracking-wider">Now:</span>
          <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-0.5 font-medium">
            {label}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={onCycleType}
            disabled={!hasFocus}
            title="Change element type (Tab)"
          >
            <ChevronsUpDown className="h-3.5 w-3.5 mr-1" />
            Change
            <kbd className="hidden sm:inline ml-1.5 text-[9px] text-muted-foreground border border-border rounded px-1">Tab</kbd>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={onNewLine}
            title="Insert new line (Enter)"
          >
            <CornerDownLeft className="h-3.5 w-3.5 mr-1" />
            New line
            <kbd className="hidden sm:inline ml-1.5 text-[9px] text-muted-foreground border border-border rounded px-1">↵</kbd>
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={onAiContinue}
            disabled={aiBusy}
            title="Ask AI to continue from here"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            {aiBusy ? "Thinking…" : "AI continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
