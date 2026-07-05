import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Type, Wrench, Map as MapIcon, Clapperboard } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Bottom-right floating cluster of "summoners". These replace the
 * always-on CanvasToolbar, FeatureDock, and permanent Script Map /
 * Director's Chair panels. Tools are one click away, but the page
 * stays visually dominant.
 */
export function EditorSummonBar({
  onOpenScriptMap,
  onOpenDirector,
  onOpenTools,
  formatContent,
}: {
  onOpenScriptMap?: () => void;
  onOpenDirector?: () => void;
  onOpenTools?: () => void;
  /** Content for the Format popover (CanvasToolbar). Passed as children. */
  formatContent?: ReactNode;
}) {
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border/60 bg-card/90 backdrop-blur shadow-lg px-1 py-1">
        {onOpenScriptMap && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded-full text-xs"
            onClick={onOpenScriptMap}
            title="Script Map"
          >
            <MapIcon className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Script Map</span>
          </Button>
        )}
        {onOpenDirector && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded-full text-xs"
            onClick={onOpenDirector}
            title="Director's Chair"
          >
            <Clapperboard className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Director</span>
          </Button>
        )}
        {onOpenTools && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded-full text-xs"
            onClick={onOpenTools}
            title="Tools"
          >
            <Wrench className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Tools</span>
          </Button>
        )}
        {formatContent && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 rounded-full text-xs"
                title="Formatting"
              >
                <Type className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Format</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" side="top" className="w-auto p-2">
              {formatContent}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
