import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  ArrowLeft,
  UserCircle2,
  CircleDot,
  Sparkles,
  FileText,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { renderResolvedScreenplay } from "@/lib/importation/segment-render.functions";
import { CharacterBiblePeek } from "@/components/importation/CharacterBiblePeek";

export const Route = createFileRoute(
  "/_authenticated/importation/$projectId/$universeId/$documentId",
)({
  head: () => ({
    meta: [{ title: "Resolved Screenplay — SceneSmith Studio" }],
  }),
  component: ResolvedDocumentView,
  errorComponent: RouteErrorBoundary,
});

function ResolvedDocumentView() {
  const { projectId, universeId, documentId } = Route.useParams();
  const renderFn = useServerFn(renderResolvedScreenplay);
  const { data, isLoading, error } = useQuery({
    queryKey: ["resolved-screenplay", documentId] as const,
    queryFn: () => renderFn({ data: { document_id: documentId } }),
  });

  const [peekCharacter, setPeekCharacter] = useState<string | null>(null);

  const stats = useMemo(() => {
    if (!data) return null;
    return {
      total: data.totals.segments,
      resolvedSpeakers: data.totals.resolved_speakers,
      resolutionPct:
        data.totals.segments > 0
          ? Math.round(
              (data.totals.resolved_speakers / data.totals.segments) * 100,
            )
          : 0,
      mentions: data.totals.segments_with_mentions,
    };
  }, [data]);

  return (
    <AppShell title={data?.title ?? "Resolved Screenplay"}>
      <div className="max-w-[1000px] mx-auto px-4 py-6 space-y-4">
        <header className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link
              to="/importation/$projectId/$universeId"
              params={{ projectId, universeId }}
            >
              <ArrowLeft className="h-4 w-4" /> Importation
            </Link>
          </Button>
          <div className="flex-1" />
          {stats && (
            <div className="flex flex-wrap gap-1.5 text-xs">
              <Badge variant="secondary" className="gap-1">
                <FileText className="h-3 w-3" />
                {stats.total} segments
              </Badge>
              <Badge variant="outline" className="gap-1">
                <UserCircle2 className="h-3 w-3" />
                {stats.resolvedSpeakers} resolved speakers ({stats.resolutionPct}%)
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Sparkles className="h-3 w-3" />
                {stats.mentions} segments with mentions
              </Badge>
            </div>
          )}
        </header>

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Rendering resolved
            document…
          </div>
        )}
        {error && (
          <Card className="p-4 border-destructive/40 text-destructive">
            {error instanceof Error ? error.message : "Failed to render"}
          </Card>
        )}

        {data && (
          <Card className="p-0 overflow-hidden">
            <ScrollArea className="h-[70vh]">
              <div className="p-6 space-y-1 font-mono text-sm leading-6">
                {data.lines.length === 0 && (
                  <p className="text-muted-foreground text-center py-12">
                    No segments in this document.
                  </p>
                )}
                {data.lines.map((line) => (
                  <ResolvedLine
                    key={line.segment_id}
                    line={line}
                    onOpenCharacter={setPeekCharacter}
                  />
                ))}
              </div>
            </ScrollArea>
          </Card>
        )}

        <CharacterBiblePeek
          open={Boolean(peekCharacter)}
          onOpenChange={(o) => !o && setPeekCharacter(null)}
          characterId={peekCharacter}
          projectId={projectId}
          universeId={universeId}
        />
      </div>
    </AppShell>
  );
}

type Line = NonNullable<
  Awaited<ReturnType<typeof renderResolvedScreenplay>>
>["lines"][number];

function ResolvedLine({
  line,
  onOpenCharacter,
}: {
  line: Line;
  onOpenCharacter: (id: string) => void;
}) {
  const isResolvedSpeaker =
    line.block_type === "character" && line.resolved_character_id;

  if (line.block_type === "scene_heading") {
    return (
      <div className="uppercase font-semibold text-primary pt-4 flex items-center gap-2">
        <span>{line.text}</span>
        <Badge
          variant="outline"
          className="text-[9px] uppercase tracking-wide"
          title="Deterministic scene slug from source"
        >
          canon
        </Badge>
      </div>
    );
  }

  if (line.block_type === "character") {
    return (
      <div className="pl-32 pt-2 flex items-center gap-2">
        {isResolvedSpeaker ? (
          <button
            type="button"
            className="uppercase font-semibold text-foreground hover:text-primary transition-colors"
            onClick={() => onOpenCharacter(line.resolved_character_id!)}
          >
            {line.text}
          </button>
        ) : (
          <span className="uppercase font-semibold text-foreground">
            {line.text}
          </span>
        )}
        <Badge
          variant={isResolvedSpeaker ? "default" : "outline"}
          className="text-[9px] uppercase tracking-wide gap-0.5"
          title={
            isResolvedSpeaker
              ? `Resolved to canonical identity from “${line.resolved_from_raw}”`
              : "Unresolved speaker — no accepted identity yet"
          }
        >
          <CircleDot className="h-2.5 w-2.5" />
          {isResolvedSpeaker ? "resolved" : "unresolved"}
        </Badge>
      </div>
    );
  }

  if (line.block_type === "dialogue") {
    return <div className="pl-20 pr-20">{line.text}</div>;
  }

  return <div>{line.text}</div>;
}
