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
import { getPitchCharacterBible } from "@/lib/importation/pitch-bible.functions";
import { useSubscription } from "@/hooks/useSubscription";
import { hasFeature } from "@/lib/entitlements";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

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
  const { tier } = useSubscription();
  const bibleUnlocked = hasFeature(tier, "pitch_character_bible");
  const [includeBible, setIncludeBible] = useState(true);

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
          const b = await fetchBible({ data: { project_id: projectId } });
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

      downloadPitchDeckPdf({
        projectTitle: project?.title ?? "Untitled Project",
        projectType: (project as any)?.project_type ?? null,
        genre: (project as any)?.genre ?? null,
        tone: (project as any)?.tone ?? null,
        logline: (pitch as any)?.logline ?? (project as any)?.logline ?? null,
        sections,
        generatedAt: (pitch as any)?.generated_at ?? null,
        characterBible,
      });
      toast.success(
        characterBible
          ? `Pitch deck downloaded (Character Bible v${characterBible.version} attached)`
          : "Pitch deck downloaded",
      );
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
