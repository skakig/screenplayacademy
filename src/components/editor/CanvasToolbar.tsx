import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Undo2, Redo2, Maximize2, MoreHorizontal } from "lucide-react";
import { BLOCK_LABEL } from "@/lib/editor/autoFormat";

type Props = {
  blockType: string | null;
  onChangeType: (t: string) => void;
  pageCount: number;
  currentPage: number;
  wordCount: number;
  sceneCount: number;
  zoom?: number;
  onZoomChange?: (z: number) => void;
};

const TYPES = ["scene_heading", "action", "character", "dialogue", "parenthetical", "transition", "shot", "note"];

export function CanvasToolbar({
  blockType,
  onChangeType,
  pageCount,
  currentPage,
  wordCount,
  sceneCount,
  zoom = 100,
  onZoomChange,
}: Props) {
  return (
    <div className="max-w-[760px] mx-auto mb-3 flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border/50 bg-card/60 backdrop-blur font-sans text-xs">
      <Select value={blockType ?? "action"} onValueChange={onChangeType}>
        <SelectTrigger className="h-7 text-xs w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TYPES.map((t) => (
            <SelectItem key={t} value={t} className="text-xs">{BLOCK_LABEL[t] ?? t}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="h-5 w-px bg-border/60 mx-0.5" />

      <ToolbarBtn title="Bold (Cmd+B)"><Bold className="h-3.5 w-3.5" /></ToolbarBtn>
      <ToolbarBtn title="Italic (Cmd+I)"><Italic className="h-3.5 w-3.5" /></ToolbarBtn>
      <ToolbarBtn title="Underline"><Underline className="h-3.5 w-3.5" /></ToolbarBtn>

      <div className="h-5 w-px bg-border/60 mx-0.5" />

      <ToolbarBtn title="Align left"><AlignLeft className="h-3.5 w-3.5" /></ToolbarBtn>
      <ToolbarBtn title="Align center"><AlignCenter className="h-3.5 w-3.5" /></ToolbarBtn>
      <ToolbarBtn title="Align right"><AlignRight className="h-3.5 w-3.5" /></ToolbarBtn>

      <div className="flex-1" />

      <span className="hidden md:inline-flex items-center gap-2 text-[10px] text-muted-foreground font-mono tabular-nums">
        <span>Page {currentPage} / {pageCount}</span>
        <span className="opacity-40">·</span>
        <span>{wordCount.toLocaleString()} words</span>
        <span className="opacity-40">·</span>
        <span>{sceneCount} {sceneCount === 1 ? "scene" : "scenes"}</span>
      </span>

      <div className="h-5 w-px bg-border/60 mx-0.5 hidden md:block" />

      <Select value={String(zoom)} onValueChange={(v) => onZoomChange?.(Number(v))}>
        <SelectTrigger className="h-7 text-xs w-[72px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[80, 90, 100, 110, 125, 150].map((z) => (
            <SelectItem key={z} value={String(z)} className="text-xs">{z}%</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ToolbarBtn title="Undo"><Undo2 className="h-3.5 w-3.5" /></ToolbarBtn>
      <ToolbarBtn title="Redo"><Redo2 className="h-3.5 w-3.5" /></ToolbarBtn>
      <ToolbarBtn title="Focus mode"><Maximize2 className="h-3.5 w-3.5" /></ToolbarBtn>
      <ToolbarBtn title="More"><MoreHorizontal className="h-3.5 w-3.5" /></ToolbarBtn>
    </div>
  );
}

function ToolbarBtn({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title={title}>
      {children}
    </Button>
  );
}
