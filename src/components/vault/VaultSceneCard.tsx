import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Sparkles, GitMerge, Copy, Archive, Pencil } from "lucide-react";
import {
  KIND_LABEL,
  POSITION_LABEL,
  STATUS_LABEL,
  type VaultSceneRow,
  type VaultStatus,
} from "@/lib/vault/schemas";

const STATUS_COLOR: Record<VaultStatus, string> = {
  vaulted: "bg-muted text-foreground",
  candidate: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  integrated: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  alternate: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  needs_rewrite: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  locked: "bg-slate-500/20 text-slate-700 dark:text-slate-200",
  deleted: "bg-muted/60 text-muted-foreground line-through",
};

type Props = {
  scene: VaultSceneRow;
  onEdit: () => void;
  onSuggest: () => void;
  onIntegrate: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
};

// Deterministic slight rotation based on id — corkboard feel.
function tilt(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const deg = ((h % 5) - 2) * 0.6; // -1.2 .. +1.2
  return `${deg.toFixed(2)}deg`;
}

export function VaultSceneCard({ scene, onEdit, onSuggest, onIntegrate, onDuplicate, onArchive }: Props) {
  const preview = scene.content.split("\n").slice(0, 4).join("\n");
  const integrated = scene.status === "integrated";
  return (
    <Card
      className="relative p-4 bg-[hsl(45,55%,97%)] dark:bg-[hsl(35,15%,14%)] border-border/70 shadow-md hover:shadow-lg transition-all cursor-default"
      style={{ transform: `rotate(${tilt(scene.id)})` }}
    >
      {/* pushpin */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-rose-500 shadow-[0_1px_0_rgba(0,0,0,0.3)] ring-2 ring-rose-300/50" />

      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {KIND_LABEL[scene.kind]}
          </div>
          <h3 className="font-display text-lg leading-tight truncate">{scene.title}</h3>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 -mt-1 -mr-1">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}><Pencil className="h-3.5 w-3.5 mr-2" />Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={onSuggest}><Sparkles className="h-3.5 w-3.5 mr-2" />Suggest Placement</DropdownMenuItem>
            <DropdownMenuItem onClick={onIntegrate} disabled={integrated}>
              <GitMerge className="h-3.5 w-3.5 mr-2" />Integrate into Timeline
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}><Copy className="h-3.5 w-3.5 mr-2" />Duplicate as Alt Take</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onArchive} className="text-destructive">
              <Archive className="h-3.5 w-3.5 mr-2" />Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {preview && (
        <p className="text-xs text-foreground/80 whitespace-pre-wrap font-mono line-clamp-5 mb-3 min-h-[3rem]">
          {preview}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 mb-2">
        <Badge className={`text-[10px] ${STATUS_COLOR[scene.status]}`} variant="outline">
          {STATUS_LABEL[scene.status]}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {POSITION_LABEL[scene.estimated_position]}
        </Badge>
        {scene.emotional_tone && (
          <Badge variant="outline" className="text-[10px] italic">{scene.emotional_tone}</Badge>
        )}
      </div>

      {scene.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {scene.tags.slice(0, 6).map((t) => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
              #{t}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
