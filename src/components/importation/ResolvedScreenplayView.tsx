// UI-backed view that renders the resolved screenplay for an imported
// source document using stable character identities from the ITS/PfHU
// identity-resolution pipeline.
//
// Speaker lines display the canonical `characters.name`, action/dialogue
// mentions are chip-tagged with the resolved character_id, and each row
// preserves the underlying `segment_id` so downstream tools (approvals,
// evidence drill-in, revisions) can link back to the source segment.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getResolvedSegmentMap,
  type ResolvedSegmentMap,
  type ResolvedSegmentMapRow,
} from "@/lib/importation/segment-map.functions";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle } from "lucide-react";

type Props = {
  documentId: string;
  className?: string;
};

export function ResolvedScreenplayView({ documentId, className }: Props) {
  const fetchMap = useServerFn(getResolvedSegmentMap);
  const { data, isLoading, isError, error } = useQuery<ResolvedSegmentMap>({
    queryKey: ["importation", "segment-map", documentId],
    queryFn: () => fetchMap({ data: { document_id: documentId } }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Resolving character identities…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-start gap-2 p-6 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 h-4 w-4" />
        <div>
          <div className="font-medium">Could not load resolved screenplay</div>
          <div className="text-xs text-muted-foreground break-words">
            {error instanceof Error ? error.message : "Unknown error"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <ResolvedScreenplayHeader map={data} />
      <div className="divide-y divide-border/60">
        {data.rows.map((row) => (
          <ResolvedLine key={row.segment_id} row={row} />
        ))}
        {data.rows.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">
            No segments imported for this document yet.
          </div>
        )}
      </div>
    </div>
  );
}

function ResolvedScreenplayHeader({ map }: { map: ResolvedSegmentMap }) {
  const resolvedPct = map.totals.segments
    ? Math.round((map.totals.resolved_speakers / map.totals.segments) * 100)
    : 0;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border/60 p-4">
      <div>
        <h2 className="text-lg font-semibold">{map.title}</h2>
        <p className="text-xs text-muted-foreground">
          {map.totals.segments} segments · {map.totals.resolved_speakers}{" "}
          resolved speakers ({resolvedPct}%) ·{" "}
          {map.totals.segments_with_mentions} with mentions
        </p>
      </div>
      <div className="flex flex-wrap gap-1">
        {map.entities.slice(0, 8).map((e) => (
          <Badge key={e.character_id} variant="secondary" className="text-[10px]">
            {e.name}
          </Badge>
        ))}
        {map.entities.length > 8 && (
          <Badge variant="outline" className="text-[10px]">
            +{map.entities.length - 8} more
          </Badge>
        )}
      </div>
    </div>
  );
}

function ResolvedLine({ row }: { row: ResolvedSegmentMapRow }) {
  const mentions = useMemo(
    () => row.entities.filter((e) => e.role === "mention"),
    [row.entities],
  );
  return (
    <div
      className="grid grid-cols-[auto_1fr_auto] items-start gap-3 p-3 text-sm hover:bg-muted/30"
      data-segment-id={row.segment_id}
    >
      <div className="w-10 shrink-0 pt-0.5 text-right font-mono text-[10px] text-muted-foreground">
        {row.sequence}
      </div>
      <div className="min-w-0">
        <LineBody row={row} />
        {mentions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {mentions.map((m) => (
              <Badge
                key={m.character_id}
                variant="outline"
                className="text-[10px]"
                data-character-id={m.character_id}
                title={`Character ${m.character_id}`}
              >
                @{m.name}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <BlockTypeBadge type={row.block_type} />
    </div>
  );
}

function LineBody({ row }: { row: ResolvedSegmentMapRow }) {
  switch (row.block_type) {
    case "scene_heading":
      return (
        <div className="font-mono text-xs font-semibold uppercase tracking-wide">
          {row.text}
        </div>
      );
    case "character":
      return (
        <div
          className="text-center font-mono text-xs font-semibold uppercase"
          data-character-id={row.resolved_character_id ?? undefined}
          title={
            row.resolved_from_raw && row.resolved_from_raw !== row.text
              ? `Originally: ${row.resolved_from_raw}`
              : undefined
          }
        >
          {row.text}
          {row.resolved_character_id && (
            <span className="ml-1 text-[9px] font-normal text-emerald-600">
              ✓
            </span>
          )}
        </div>
      );
    case "dialogue":
      return <div className="pl-6 font-mono text-xs">{row.text}</div>;
    default:
      return <div className="font-mono text-xs">{row.text}</div>;
  }
}

function BlockTypeBadge({ type }: { type: ResolvedSegmentMapRow["block_type"] }) {
  const label =
    type === "scene_heading"
      ? "Slug"
      : type === "character"
        ? "Cue"
        : type === "dialogue"
          ? "Line"
          : "Action";
  return (
    <Badge variant="outline" className="shrink-0 text-[9px] uppercase">
      {label}
    </Badge>
  );
}
