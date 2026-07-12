import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import {
  Loader2,
  Sparkles,
  BookOpen,
  Download,
  Lock,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { ProjectNav } from "@/components/ProjectNav";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listCharacterBibles,
  generateCharacterBible,
} from "@/lib/importation/character-bible.functions";
import { getCharacterBibleExport } from "@/lib/importation/character-bible-export.functions";
import { downloadCharacterBiblePdf } from "@/components/importation/characterBiblePdf";
import { useSubscription } from "@/hooks/useSubscription";
import { hasFeature } from "@/lib/entitlements";

type BibleEntry = {
  character_id: string;
  name: string;
  importance: string | null;
  aliases: string[];
  source_document_ids: string[];
  first_appearance: {
    document_id: string;
    segment_id: string;
    sequence: number;
    heading: string | null;
  } | null;
  speaking_segments: number;
  mention_segments: number;
  top_evidence: {
    segment_id: string;
    excerpt: string;
    confidence: number;
    document_id: string | null;
  }[];
};

type BibleRow = {
  id: string;
  version: number;
  summary: string | null;
  source_document_ids: string[] | null;
  entries: BibleEntry[] | null;
  generated_by: string | null;
  created_at: string;
};

export const Route = createFileRoute(
  "/_authenticated/character-bible/$projectId/$universeId",
)({
  head: () => ({ meta: [{ title: "Character Bible — SceneSmith Studio" }] }),
  component: CharacterBiblePage,
  errorComponent: RouteErrorBoundary,
});

function CharacterBiblePage() {
  const { projectId, universeId } = Route.useParams();
  const qc = useQueryClient();
  const listFn = useServerFn(listCharacterBibles);
  const generateFn = useServerFn(generateCharacterBible);
  const exportFn = useServerFn(getCharacterBibleExport);
  const { tier } = useSubscription();
  const pdfUnlocked = hasFeature(tier, "character_bible_pdf");
  const [exporting, setExporting] = useState(false);

  const queryKey = ["character-bibles", universeId, projectId] as const;

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () =>
      listFn({ data: { universe_id: universeId, project_id: projectId } }),
  });

  const bibles = (data ?? []) as BibleRow[];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const active = useMemo(() => {
    if (!bibles.length) return null;
    if (selectedId) return bibles.find((b) => b.id === selectedId) ?? bibles[0];
    return bibles[0]; // list is ordered version DESC → latest first
  }, [bibles, selectedId]);

  const generate = useMutation({
    mutationFn: () =>
      generateFn({
        data: { universe_id: universeId, project_id: projectId },
      }),
    onSuccess: (res) => {
      if (res?.skipped) {
        toast.info("No approved characters to compile yet.");
        return;
      }
      toast.success(`Generated v${res?.version ?? "?"}`);
      setSelectedId(res?.bible_id ?? null);
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Failed to generate"),
  });

  return (
    <AppShell title="Character Bible">
      <ProjectNav projectId={projectId} />
      <div className="max-w-[1200px] mx-auto px-4 py-6 space-y-6">
        <header className="flex flex-wrap items-center gap-3">
          <BookOpen className="h-5 w-5 text-primary" />
          <h1 className="font-display text-2xl font-semibold flex-1">
            Character Bible
          </h1>

          {bibles.length > 0 && (
            <Select
              value={active?.id ?? undefined}
              onValueChange={(v) => setSelectedId(v)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent>
                {bibles.map((b, i) => (
                  <SelectItem key={b.id} value={b.id}>
                    v{b.version}
                    {i === 0 ? " (latest)" : ""} ·{" "}
                    {format(new Date(b.created_at), "MMM d, yyyy")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            variant="outline"
            onClick={async () => {
              if (!active) return;
              setExporting(true);
              try {
                const payload = await exportFn({
                  data: {
                    project_id: projectId,
                    universe_id: universeId,
                    bible_id: active.id,
                  },
                });
                await downloadCharacterBiblePdf(payload);
                toast.success(`Downloaded v${payload.bible.version}`);
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Export failed";
                if (msg.startsWith("PLAN_LIMIT")) {
                  toast.error("PDF export requires Pro or higher.");
                } else {
                  toast.error(msg);
                }
              } finally {
                setExporting(false);
              }
            }}
            disabled={!active || exporting}
            className="gap-1.5"
            title={
              pdfUnlocked
                ? "Download PDF"
                : "PDF export requires Pro or higher"
            }
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : pdfUnlocked ? (
              <Download className="h-4 w-4" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            Download PDF
          </Button>

          <Button
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            className="gap-1.5"
          >
            {generate.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate new version
          </Button>
        </header>

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading bibles…
          </div>
        )}

        {error && (
          <Card className="p-4 border-destructive/40 text-destructive">
            {error instanceof Error ? error.message : "Failed to load"}
          </Card>
        )}

        {!isLoading && !bibles.length && (
          <Card className="p-8 text-center space-y-3">
            <p className="text-muted-foreground">
              No character bible yet. Approve character candidates from your
              imported sources, then generate the first version.
            </p>
            <Button
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
              className="gap-1.5"
            >
              <Sparkles className="h-4 w-4" /> Generate first version
            </Button>
          </Card>
        )}

        {active && <BibleView bible={active} />}
      </div>
    </AppShell>
  );
}

function BibleView({ bible }: { bible: BibleRow }) {
  const entries = bible.entries ?? [];
  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">v{bible.version}</Badge>
          <span>
            Generated {format(new Date(bible.created_at), "MMM d, yyyy · p")}
          </span>
          <span>·</span>
          <span>
            {entries.length} character{entries.length === 1 ? "" : "s"}
          </span>
          <span>·</span>
          <span>
            {(bible.source_document_ids ?? []).length} source doc
            {(bible.source_document_ids ?? []).length === 1 ? "" : "s"}
          </span>
        </div>
        {bible.summary && (
          <p className="text-sm text-foreground/80">{bible.summary}</p>
        )}
      </Card>

      {entries.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground text-sm">
          This version has no entries.
        </Card>
      ) : (
        <div className="grid gap-3">
          {entries.map((e) => (
            <Card key={e.character_id} className="p-4 space-y-2">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="font-display text-lg font-semibold">{e.name}</h2>
                {e.importance && (
                  <Badge variant="outline" className="text-xs">
                    {e.importance}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {e.speaking_segments} speaking · {e.mention_segments} mentions
                </span>
              </div>

              {e.aliases.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Also known as: </span>
                  {e.aliases.join(", ")}
                </div>
              )}

              {e.first_appearance && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">First appearance: </span>
                  {e.first_appearance.heading ?? "—"} (seq{" "}
                  {e.first_appearance.sequence})
                </div>
              )}

              {e.top_evidence.length > 0 && (
                <div className="pt-2 border-t border-border/50 space-y-1.5">
                  <div className="text-xs font-medium text-muted-foreground">
                    Evidence
                  </div>
                  <ul className="space-y-1">
                    {e.top_evidence.map((ev) => (
                      <li
                        key={ev.segment_id + ev.excerpt.slice(0, 20)}
                        className="text-sm text-foreground/80 border-l-2 border-primary/30 pl-2"
                      >
                        <span className="italic">"{ev.excerpt}"</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          conf {(ev.confidence * 100).toFixed(0)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
