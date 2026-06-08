import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Check, X, GraduationCap, Loader2, Brain } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { aggregateWriterProfile, getWriterProfile } from "@/lib/its/writerProfile.functions";
import {
  generateCoachRecommendations,
  listCoachRecommendations,
  resolveCoachRecommendation,
} from "@/lib/its/coachRecommendations.functions";

const SKILLS: { key: keyof Pick<NonNullable<Awaited<ReturnType<typeof getWriterProfile>>>,
  "formatting_skill_score" | "scene_craft_score" | "dialogue_score" | "visual_writing_score" | "character_voice_score">; label: string }[] = [
  { key: "formatting_skill_score", label: "Formatting" },
  { key: "scene_craft_score", label: "Scene craft" },
  { key: "dialogue_score", label: "Dialogue" },
  { key: "visual_writing_score", label: "Visual writing" },
  { key: "character_voice_score", label: "Character voice" },
];

export function WriterInsightsPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getWriterProfile);
  const aggregate = useServerFn(aggregateWriterProfile);
  const fetchRecs = useServerFn(listCoachRecommendations);
  const generate = useServerFn(generateCoachRecommendations);
  const resolve = useServerFn(resolveCoachRecommendation);

  const profile = useQuery({
    queryKey: ["writer-profile"],
    queryFn: () => fetchProfile(),
    staleTime: 60_000,
  });

  const recs = useQuery({
    queryKey: ["coach-recs", projectId],
    queryFn: () => fetchRecs({ data: { project_id: projectId } }),
    staleTime: 30_000,
  });

  // On mount: aggregate + generate fresh recs (fire-and-forget; refresh queries after).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([aggregate(), generate({ data: { project_id: projectId } })]);
      } catch {
        /* silent */
      }
      if (!cancelled) {
        qc.invalidateQueries({ queryKey: ["writer-profile"] });
        qc.invalidateQueries({ queryKey: ["coach-recs", projectId] });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const resolveMut = useMutation({
    mutationFn: (vars: { id: string; status: "applied" | "dismissed" }) =>
      resolve({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coach-recs", projectId] }),
  });

  const p = profile.data;
  const recList = recs.data ?? [];

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border/60 bg-card/40 p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
            <Brain className="h-3 w-3" />Your skill profile
          </p>
          <span className="text-[10px] text-muted-foreground">
            Confidence {p?.confidence_score ?? "—"}
          </span>
        </div>
        {profile.isLoading ? (
          <p className="text-xs text-muted-foreground italic">Calibrating…</p>
        ) : (
          <div className="space-y-1.5">
            {SKILLS.map((s) => {
              const v = (p?.[s.key] as number | undefined) ?? 50;
              return (
                <div key={s.key} className="space-y-0.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-foreground/80">{s.label}</span>
                    <span className="text-muted-foreground font-mono">{v}</span>
                  </div>
                  <Progress value={v} className="h-1.5" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />Coach recommendations
          </p>
          {recs.isFetching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        {recList.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No tips yet — keep writing and the coach will weigh in.
          </p>
        ) : (
          recList.map((r) => (
            <div
              key={r.id}
              className={`rounded-md border p-2.5 ${
                r.severity === "warning"
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-border/60 bg-card/40"
              }`}
            >
              <p className="text-xs font-semibold text-foreground mb-1">{r.title}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">{r.body}</p>
              <div className="flex items-center gap-1.5">
                {r.lesson_slug && (
                  <Button asChild size="sm" variant="outline" className="h-6 text-[10px] px-2">
                    <Link
                      to="/academy/$moduleSlug/$lessonSlug"
                      params={{ moduleSlug: "screenplay-basics", lessonSlug: r.lesson_slug }}
                    >
                      <GraduationCap className="h-3 w-3 mr-1" />Teach me
                    </Link>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] px-2"
                  onClick={() => resolveMut.mutate({ id: r.id, status: "applied" })}
                >
                  <Check className="h-3 w-3 mr-1" />Got it
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] px-2 text-muted-foreground"
                  onClick={() => resolveMut.mutate({ id: r.id, status: "dismissed" })}
                >
                  <X className="h-3 w-3 mr-1" />Dismiss
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
