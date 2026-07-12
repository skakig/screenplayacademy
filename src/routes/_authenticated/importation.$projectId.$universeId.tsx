import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Loader2,
  FileText,
  Upload,
  ArrowRight,
  BookOpen,
  Sparkles,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ingestSourceDocument,
  listSourceDocuments,
} from "@/lib/importation/source-preservation.functions";

type Doc = Awaited<ReturnType<typeof listSourceDocuments>>[number];

export const Route = createFileRoute(
  "/_authenticated/importation/$projectId/$universeId",
)({
  head: () => ({
    meta: [{ title: "Importation Center — SceneSmith Studio" }],
  }),
  component: ImportationCenter,
  errorComponent: RouteErrorBoundary,
});

const SOURCE_TYPES = [
  "screenplay",
  "teleplay",
  "shooting_script",
  "novel",
  "novella",
  "short_story",
  "manuscript",
  "series_bible",
  "lore_document",
  "transcript",
  "stage_play",
  "unknown",
] as const;

function ImportationCenter() {
  const { projectId, universeId } = Route.useParams();
  const qc = useQueryClient();
  const listFn = useServerFn(listSourceDocuments);
  const ingestFn = useServerFn(ingestSourceDocument);

  const queryKey = ["source-documents", universeId] as const;
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => listFn({ data: { universe_id: universeId } }),
  });
  const docs = (data ?? []) as Doc[];

  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] =
    useState<(typeof SOURCE_TYPES)[number]>("screenplay");
  const [text, setText] = useState("");
  const [filename, setFilename] = useState<string | undefined>();

  const ingest = useMutation({
    mutationFn: (payload: {
      title: string;
      text: string;
      source_type: (typeof SOURCE_TYPES)[number];
      filename?: string;
    }) =>
      ingestFn({
        data: {
          universe_id: universeId,
          project_id: projectId,
          title: payload.title,
          text: payload.text,
          source_type: payload.source_type,
          media_type: "text/plain",
          filename: payload.filename,
          authority: "reference",
        },
      }),
    onSuccess: (res) => {
      toast.success(
        res.already_existed
          ? "Document already existed — re-parsed."
          : `Imported ${res.segments_written} segments.`,
      );
      setTitle("");
      setText("");
      setFilename(undefined);
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Ingest failed"),
  });

  const onFile = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      toast.error("File too large (max 4MB for plain text upload).");
      return;
    }
    const txt = await file.text();
    setText(txt);
    setFilename(file.name);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
  };

  const canSubmit = title.trim().length > 0 && text.trim().length > 0;
  const totalSegments = useMemo(
    () => docs.reduce((n, d) => n + ((d as Doc).byte_size ? 1 : 1), 0),
    [docs],
  );

  return (
    <AppShell title="Importation Center">
      <div className="max-w-[1100px] mx-auto px-4 py-6 space-y-6">
        <header className="flex flex-wrap items-center gap-3">
          <FileText className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <h1 className="font-display text-2xl font-semibold">
              Importation Center
            </h1>
            <p className="text-sm text-muted-foreground">
              Source documents preserved for this story universe. Each import
              is checksum-deduped and segmented for resolved rendering.
            </p>
          </div>
          <Button asChild variant="outline" className="gap-1.5">
            <Link
              to="/character-bible/$projectId/$universeId"
              params={{ projectId, universeId }}
            >
              <BookOpen className="h-4 w-4" /> Character Bible
            </Link>
          </Button>
        </header>

        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            <h2 className="font-medium">Add a source document</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="src-title">Title</Label>
              <Input
                id="src-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Season 1, Episode 3 — First Draft"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Source type</Label>
              <Select
                value={sourceType}
                onValueChange={(v) =>
                  setSourceType(v as (typeof SOURCE_TYPES)[number])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="src-text">Paste text or upload a .txt file</Label>
            <Textarea
              id="src-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder="Paste screenplay, novel, transcript, or lore text here…"
            />
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <input
                type="file"
                accept=".txt,.md,.fountain,text/plain"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                }}
              />
              {filename && <span>Loaded: {filename}</span>}
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              disabled={!canSubmit || ingest.isPending}
              onClick={() =>
                ingest.mutate({
                  title: title.trim(),
                  text,
                  source_type: sourceType,
                  filename,
                })
              }
              className="gap-1.5"
            >
              {ingest.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Ingest & segment
            </Button>
          </div>
        </Card>

        <section className="space-y-2">
          <h2 className="font-medium">
            Source documents{" "}
            <span className="text-muted-foreground text-sm font-normal">
              ({docs.length})
            </span>
          </h2>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : docs.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              No source documents yet. Paste or upload text above.
            </Card>
          ) : (
            <div className="grid gap-2">
              {docs.map((d) => (
                <Link
                  key={d.id}
                  to="/importation/$projectId/$universeId/$documentId"
                  params={{
                    projectId,
                    universeId,
                    documentId: d.id,
                  }}
                  className="block"
                >
                  <Card className="p-3 flex items-center gap-3 hover:border-primary/40 transition-colors">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{d.title}</div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-1.5 items-center">
                        <Badge variant="outline" className="text-[10px]">
                          {d.source_type}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {d.status}
                        </Badge>
                        <span>
                          {format(new Date(d.created_at), "MMM d, yyyy")}
                        </span>
                        {d.byte_size != null && (
                          <span>· {(d.byte_size / 1024).toFixed(1)} KB</span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Card>
                </Link>
              ))}
              <p className="sr-only">{totalSegments}</p>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
