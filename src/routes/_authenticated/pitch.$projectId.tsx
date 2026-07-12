import { createFileRoute, Link } from "@tanstack/react-router";
import { RouteReadinessGate } from "@/components/RouteReadinessGate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ProjectNav } from "@/components/ProjectNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Copy, Loader2, FileDown, Clapperboard, BookOpen, Lock } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { generatePitchPackage } from "@/lib/ai.functions";
import { format } from "date-fns";
import { downloadPitchKitPdf } from "@/components/editor/pitchKitPdf";
import { downloadPitchDeckPdf, type PitchDeckSection } from "@/components/editor/pitchDeckPdf";
import {
  getPitchCharacterBible,
  listPitchCharacterBibleVersions,
} from "@/lib/importation/pitch-bible.functions";
import {
  listProjectSceneSnapshots,
  getSceneSnapshot,
  type ProjectSnapshotSceneGroup,
} from "@/lib/editor/sceneSnapshots.functions";
import type { PitchDeckSceneSnapshot, PitchDeckWorldUsage } from "@/components/editor/pitchDeckPdf";
import { getWorldUsageReport } from "@/lib/world/worldUsageReport.functions";
import { Globe } from "lucide-react";
import { Clapperboard as SceneIcon } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { hasFeature } from "@/lib/entitlements";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { PageFeatureGate } from "@/components/PageFeatureGate";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";

export const Route = createFileRoute("/_authenticated/pitch/$projectId")({
  head: () => ({ meta: [{ title: "Pitch Deck — SceneSmith Studio" }] }),
  component: () => (<RouteReadinessGate to="/pitch/$projectId"><GatedPitch /></RouteReadinessGate>),
  errorComponent: RouteErrorBoundary,
});

function GatedPitch() {
  return (
    <PageFeatureGate feature="pitch">
      <Pitch />
    </PageFeatureGate>
  );
}


const SECTIONS: { key: string; label: string }[] = [
  { key: "logline", label: "Logline" },
  { key: "short_synopsis", label: "Short Synopsis" },
  { key: "one_page_synopsis", label: "One-Page Synopsis" },
  { key: "treatment", label: "Treatment" },
  { key: "character_bible", label: "Character Bible" },
  { key: "tone_statement", label: "Tone Statement" },
  { key: "comparables", label: "Comparable Films" },
  { key: "target_audience", label: "Target Audience" },
  { key: "budget_tier", label: "Budget Tier" },
  { key: "poster_prompt", label: "Poster Prompt" },
  { key: "trailer_vo", label: "Trailer Voiceover" },
  { key: "pitch_email", label: "Pitch Email" },
];

function Pitch() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();
  const callGen = useServerFn(generatePitchPackage);
  const fetchBible = useServerFn(getPitchCharacterBible);
  const listBibleVersions = useServerFn(listPitchCharacterBibleVersions);
  const { tier } = useSubscription();
  const bibleUnlocked = hasFeature(tier, "pitch_character_bible");
  const [includeBible, setIncludeBible] = useState(true);
  const [bibleVersionId, setBibleVersionId] = useState<string | "latest">(
    "latest",
  );
  // scene_id -> snapshot_id ("" = don't include). Absent key = don't include.
  const [sceneSnapshotSelections, setSceneSnapshotSelections] = useState<
    Record<string, string>
  >({});
  const listSnapshots = useServerFn(listProjectSceneSnapshots);
  const fetchSnapshot = useServerFn(getSceneSnapshot);
  const fetchWorldUsage = useServerFn(getWorldUsageReport);
  const [includeWorldUsage, setIncludeWorldUsage] = useState(true);


  const { data: snapshotGroups = [] as ProjectSnapshotSceneGroup[] } = useQuery({
    queryKey: ["pitch-scene-snapshots", projectId],
    queryFn: () => listSnapshots({ data: { project_id: projectId } }),
  });

  const { data: bibleVersions = [] } = useQuery({
    queryKey: ["pitch-bible-versions", projectId],
    queryFn: () => listBibleVersions({ data: { project_id: projectId } }),
    enabled: bibleUnlocked,
  });

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => (await supabase.from("projects").select("*").eq("id", projectId).single()).data,
  });
  const { data: pitch } = useQuery({
    queryKey: ["pitch", projectId],
    queryFn: async () => (await supabase.from("pitch_packages").select("*").eq("project_id", projectId).maybeSingle()).data,
  });
  const { data: takes } = useQuery({
    queryKey: ["draft_takes", projectId],
    queryFn: async () =>
      (
        await supabase
          .from("draft_takes")
          .select("id, name, captured_at, block_count, word_count, payload")
          .eq("project_id", projectId)
          .order("captured_at", { ascending: false })
          .limit(25)
      ).data ?? [],
  });

  const [loading, setLoading] = useState(false);
  const [exportingTimeline, setExportingTimeline] = useState(false);
  const [exportingDeck, setExportingDeck] = useState(false);

  const exportDeck = async () => {
    if (!pitch) {
      toast.error("Generate the pitch package first.");
      return;
    }
    setExportingDeck(true);
    try {
      const sections: PitchDeckSection[] = SECTIONS
        .map((s) => ({ key: s.key, label: s.label, value: String((pitch as any)[s.key] ?? "") }))
        .filter((s) => s.value.trim().length > 0);
      if (sections.length === 0) {
        toast.error("Pitch package is empty — regenerate it first.");
        return;
      }

      let characterBible = null;
      if (bibleUnlocked && includeBible) {
        try {
          const b = await fetchBible({
            data: {
              project_id: projectId,
              ...(bibleVersionId !== "latest"
                ? { bible_id: bibleVersionId }
                : {}),
            },
          });
          if (b && b.entries.length > 0) {
            characterBible = b;
          } else if (b === null) {
            toast.info("No Character Bible generated yet — export continues without it.");
          }
        } catch (e: any) {
          const msg = String(e?.message ?? "");
          if (msg.startsWith("PLAN_LIMIT")) {
            toast.error("Character Bible export requires Pro or higher.");
          } else {
            toast.error(`Couldn't attach Character Bible: ${msg || "unknown error"}`);
          }
        }
      }

      // Resolve selected scene snapshots (fetch full payloads).
      const chosen = Object.entries(sceneSnapshotSelections).filter(
        ([, snapId]) => snapId && snapId.length > 0,
      );
      const sceneSnapshots: PitchDeckSceneSnapshot[] = [];
      if (chosen.length > 0) {
        // Preserve scene order from snapshotGroups.
        const orderIndex = new Map(
          snapshotGroups.map((g, i) => [g.scene.id, i] as const),
        );
        chosen.sort(
          (a, b) => (orderIndex.get(a[0]) ?? 0) - (orderIndex.get(b[0]) ?? 0),
        );
        for (const [sceneId, snapshotId] of chosen) {
          try {
            const full = await fetchSnapshot({ data: { snapshot_id: snapshotId } });
            const group = snapshotGroups.find((g) => g.scene.id === sceneId);
            const sceneLabel =
              group?.scene.title ||
              group?.scene.scene_heading ||
              full.snapshot.scene.title ||
              full.snapshot.scene.scene_heading ||
              "Scene";
            sceneSnapshots.push({
              sceneLabel,
              sceneHeading:
                full.snapshot.scene.scene_heading ??
                group?.scene.scene_heading ??
                null,
              snapshotLabel: full.label ?? "Snapshot",
              capturedAt: full.created_at,
              blocks: full.snapshot.blocks.map((b) => ({
                block_type: b.block_type,
                content: b.content ?? "",
              })),
            });
          } catch (e: any) {
            toast.error(
              `Couldn't attach snapshot for a scene: ${e?.message ?? "unknown error"}`,
            );
          }
        }
      }

      downloadPitchDeckPdf({
        projectTitle: project?.title ?? "Untitled Project",
        projectType: (project as any)?.project_type ?? null,
        genre: (project as any)?.genre ?? null,
        tone: (project as any)?.tone ?? null,
        logline: (pitch as any)?.logline ?? (project as any)?.logline ?? null,
        sections,
        generatedAt: (pitch as any)?.generated_at ?? null,
        characterBible,
        sceneSnapshots: sceneSnapshots.length > 0 ? sceneSnapshots : null,
      });
      const bibleNote = characterBible
        ? ` · Character Bible v${characterBible.version}`
        : "";
      const sceneNote =
        sceneSnapshots.length > 0
          ? ` · ${sceneSnapshots.length} scene snapshot${sceneSnapshots.length === 1 ? "" : "s"}`
          : "";
      toast.success(`Pitch deck downloaded${bibleNote}${sceneNote}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't export pitch deck");
    } finally {
      setExportingDeck(false);
    }
  };

  const exportTimeline = async () => {
    if (!takes || takes.length === 0) {
      toast.error("No takes captured yet for this project.");
      return;
    }
    setExportingTimeline(true);
    try {
      const title = project?.title ?? "Untitled project";
      const mapped = takes.map((t: any) => ({
        id: t.id,
        name: t.name,
        capturedAt: new Date(t.captured_at).getTime(),
        blockCount: t.block_count ?? 0,
        wordCount: t.word_count ?? 0,
        payload: t.payload,
      }));
      downloadPitchKitPdf(
        {
          projectTitle: title,
          takes: mapped,
          selectedTakeIds: mapped.slice(0, 3).map((t) => t.id),
        },
        `${title.replace(/\s+/g, "_")}-pitch-revisions.pdf`,
      );
      toast.success("Revision timeline PDF downloaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't export PDF");
    } finally {
      setExportingTimeline(false);
    }
  };
  const gen = useMutation({
    mutationFn: async () => callGen({ data: { projectId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pitch", projectId] }); toast.success("Pitch package generated"); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const run = async () => { setLoading(true); try { await gen.mutateAsync(); } finally { setLoading(false); } };

  return (
    <AppShell>
      <ProjectNav projectId={projectId} title={project?.title} />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pitch Package</h1>
            <p className="text-muted-foreground">Industry-ready pitch in one click.</p>
          </div>
          <div className="flex items-center gap-2">
            {pitch && (
              <Button onClick={exportDeck} disabled={exportingDeck} size="lg" variant="outline">
                {exportingDeck ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Preparing…</>
                ) : (
                  <><FileDown className="h-4 w-4 mr-2" />Download Pitch Deck</>
                )}
              </Button>
            )}
            <Button onClick={run} disabled={loading} size="lg">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4 mr-2" />{pitch ? "Regenerate" : "Generate Pitch Package"}</>}
            </Button>
          </div>
        </div>

        {pitch && (
          <Card className="p-3 mb-6 flex flex-wrap items-center gap-3">
            <BookOpen className="h-4 w-4 text-primary" />
            <div className="flex-1 min-w-[220px]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  Include Character Bible in pitch deck
                </span>
                {!bibleUnlocked && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Lock className="h-3 w-3" /> Pro
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {bibleUnlocked
                  ? "Attaches the latest generated Character Bible as extra slides."
                  : "Upgrade to Pro or higher to attach the Character Bible to pitch exports."}
              </p>
            </div>
            {bibleUnlocked && includeBible && bibleVersions.length > 0 && (
              <Select
                value={bibleVersionId}
                onValueChange={(v) =>
                  setBibleVersionId(v as string | "latest")
                }
              >
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Version" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">
                    Latest (v{bibleVersions[0].version})
                  </SelectItem>
                  {bibleVersions.map((v, i) => (
                    <SelectItem key={v.id} value={v.id}>
                      v{v.version}
                      {i === 0 ? " · latest" : ""} ·{" "}
                      {format(new Date(v.created_at), "MMM d, yyyy")} ·{" "}
                      {v.entry_count} char
                      {v.entry_count === 1 ? "" : "s"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Switch
              checked={bibleUnlocked && includeBible}
              disabled={!bibleUnlocked}
              onCheckedChange={(v) => setIncludeBible(v)}
              aria-label="Include Character Bible in pitch deck"
            />
          </Card>
        )}

        {pitch && snapshotGroups.length > 0 && (
          <Card className="p-4 mb-6">
            <div className="flex items-start gap-3 mb-3">
              <SceneIcon className="h-4 w-4 text-primary mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium">
                  Include key scene snapshots
                </div>
                <p className="text-xs text-muted-foreground">
                  Pick a saved snapshot version for each scene you want to
                  attach as extra slides in the pitch deck.
                </p>
              </div>
              {Object.values(sceneSnapshotSelections).filter(Boolean).length > 0 && (
                <Badge variant="secondary" className="shrink-0">
                  {Object.values(sceneSnapshotSelections).filter(Boolean).length} selected
                </Badge>
              )}
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {snapshotGroups.map((g) => {
                const selected = sceneSnapshotSelections[g.scene.id] ?? "";
                const heading =
                  g.scene.scene_heading || g.scene.title || "Untitled scene";
                return (
                  <div
                    key={g.scene.id}
                    className="flex items-center gap-2 border rounded-md px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {heading}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {g.snapshots.length} snapshot
                        {g.snapshots.length === 1 ? "" : "s"}
                      </div>
                    </div>
                    <Select
                      value={selected || "__none__"}
                      onValueChange={(v) =>
                        setSceneSnapshotSelections((prev) => ({
                          ...prev,
                          [g.scene.id]: v === "__none__" ? "" : v,
                        }))
                      }
                    >
                      <SelectTrigger className="w-[260px]">
                        <SelectValue placeholder="Don't include" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Don't include</SelectItem>
                        {g.snapshots.map((s, i) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.label ?? `Snapshot ${i + 1}`}
                            {i === 0 ? " · latest" : ""} ·{" "}
                            {format(new Date(s.created_at), "MMM d, HH:mm")} ·{" "}
                            {s.word_count.toLocaleString()} w
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </Card>
        )}



        {!pitch ? (
          <Card className="p-12 text-center border-dashed">
            <Sparkles className="h-10 w-10 text-primary mx-auto mb-3" />
            <h3 className="font-semibold mb-1">No pitch package yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              We'll write your logline, synopsis, treatment, comps, pitch email and more. Best results with a title, logline, and a few written scenes already in place.
            </p>
            <div className="flex items-center gap-2 justify-center flex-wrap">
              <Button onClick={run} disabled={loading}>{loading ? "Generating..." : "Generate now"}</Button>
              <Button variant="outline" asChild>
                <Link to="/editor/$projectId" params={{ projectId }}>Write more first</Link>
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {SECTIONS.map((s) => {
              const v = (pitch as any)[s.key];
              if (!v) return null;
              return (
                <Card key={s.key} className="p-5">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <h3 className="font-display text-lg font-semibold">{s.label}</h3>
                    <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(v); toast.success("Copied"); }}>
                      <Copy className="h-3.5 w-3.5 mr-1.5" />Copy
                    </Button>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-foreground/90">{v}</p>
                </Card>
              );
            })}
            {pitch.generated_at && <p className="text-xs text-muted-foreground text-center">Generated {new Date(pitch.generated_at).toLocaleString()}</p>}

            <Card className="p-5">
              <div className="flex items-start justify-between mb-3 gap-2">
                <div className="flex items-center gap-2">
                  <Clapperboard className="h-4 w-4 text-primary" />
                  <h3 className="font-display text-lg font-semibold">Revision Timeline</h3>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={exportingTimeline || !takes || takes.length === 0}
                  onClick={exportTimeline}
                >
                  {exportingTimeline ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <FileDown className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Export PDF
                </Button>
              </div>
              {!takes || takes.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No revision takes captured yet. Slate one from the editor's Takes &amp; Revisions panel.
                </p>
              ) : (
                <ol className="space-y-2">
                  {takes.map((t: any, i: number) => (
                    <li
                      key={t.id}
                      className="flex items-center gap-3 text-sm border-l-2 border-primary/40 pl-3 py-1"
                    >
                      <span className="font-mono text-xs text-muted-foreground w-10 shrink-0">
                        TAKE {String(takes.length - i).padStart(2, "0")}
                      </span>
                      <span className="font-medium flex-1 truncate">{t.name}</span>
                      <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                        {format(new Date(t.captured_at), "MMM d, HH:mm")} ·{" "}
                        {(t.word_count ?? 0).toLocaleString()} words
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
