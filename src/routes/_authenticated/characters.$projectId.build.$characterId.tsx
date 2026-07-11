// Characters Rebuild — Pass 4 (Guided Character Builder).
// Dedicated full-screen route. One question at a time. Role-scaled depth.
// See docs/CHARACTERS_REBUILD.md.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Sparkles, ChevronLeft, ChevronRight, Loader2, Check, X, ArrowLeft,
  User as UserIcon, ShieldCheck, Target, Zap, BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { upsertCharacter, generateFullCharacter } from "@/lib/characters.functions";
import { useOnboarding } from "@/hooks/use-onboarding";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { RouteReadinessGate } from "@/components/RouteReadinessGate";

export const Route = createFileRoute(
  "/_authenticated/characters/$projectId/build/$characterId",
)({
  head: () => ({ meta: [{ title: "Build Character — SceneSmith Studio" }] }),
  component: () => (
    <RouteReadinessGate to="/characters/$projectId">
      <GuidedBuilderPage />
    </RouteReadinessGate>
  ),
  errorComponent: RouteErrorBoundary,
});

type Step = {
  field: string;
  title: string;
  explainer: string;
  example: string;
  placeholder: string;
  beginnerHint?: string;
};

const STEPS: Step[] = [
  {
    field: "name",
    title: "Name",
    explainer: "What do we call this character on the page? Short, memorable, castable.",
    example: "e.g. HANS, MAJOR FRIEDRICH, THE COOK",
    placeholder: "Character name…",
    beginnerHint: "Screenplay convention is uppercase for the first appearance. One or two words is best.",
  },
  {
    field: "role",
    title: "Story role",
    explainer: "The function this character serves in the story engine — not their personality.",
    example: "e.g. Reluctant protagonist chased by their past.",
    placeholder: "Protagonist, foil, mentor…",
    beginnerHint: "Think about what the story needs this character for, not what they're like.",
  },
  {
    field: "external_goal",
    title: "What they want",
    explainer: "The visible, external thing they are chasing. A camera could film it.",
    example: "e.g. Get her sister out of the country before Sunday.",
    placeholder: "The visible thing they are chasing…",
    beginnerHint: "If a stranger watched the movie with the sound off, could they see this goal?",
  },
  {
    field: "internal_need",
    title: "What they need",
    explainer: "The unspoken thing the story will force them to learn or accept. Often the opposite of what they want.",
    example: "e.g. To accept help without flinching.",
    placeholder: "The invisible thing they must learn…",
    beginnerHint: "The wound tells you what they need. The lie tells you why they can't have it yet.",
  },
  {
    field: "wound",
    title: "Core wound",
    explainer: "The old hurt that shaped who they are today. Concrete, not abstract.",
    example: "e.g. Their father chose the church over their mother's funeral.",
    placeholder: "The old hurt that shaped them…",
    beginnerHint: "Wounds are events, not feelings. Something specific happened.",
  },
  {
    field: "core_lie",
    title: "Core lie",
    explainer: "The false belief they carry because of the wound. The story will test this lie.",
    example: "e.g. If I stay in control, nobody else gets hurt.",
    placeholder: "The false belief they live by…",
    beginnerHint: "A good lie sounds like a virtue — that's why it's hard to give up.",
  },
  {
    field: "secret",
    title: "Secret",
    explainer: "Something they keep hidden. Not just from us — from someone in the story.",
    example: "e.g. They were the one who let the door stay open.",
    placeholder: "What they never say aloud…",
    beginnerHint: "Secrets create dramatic pressure. What would collapse if it came out?",
  },
  {
    field: "voice_summary",
    title: "Voice",
    explainer: "How they sound on the page. Sentence length, humor, tells. One line.",
    example: "e.g. Dry, watchful, asks questions instead of answering.",
    placeholder: "How their dialogue sounds…",
    beginnerHint: "Pick three adjectives, then a habit — 'clipped, dry, formal — never says the person's name.'",
  },
  {
    field: "visual_description",
    title: "Visual identity",
    explainer: "How they look and move. Aim for one image the reader can hold.",
    example: "e.g. Lean, watchful, muted neutrals — always one item that doesn't fit the room.",
    placeholder: "The image the reader keeps…",
    beginnerHint: "One striking detail beats a full paragraph. What would you notice first?",
  },
  {
    field: "character_arc",
    title: "Arc",
    explainer: "The one-sentence transformation. From X to Y.",
    example: "e.g. From self-reliance as armor → to chosen vulnerability as strength.",
    placeholder: "From __ to __",
    beginnerHint: "The lie at the start becomes the truth at the end. That's the arc.",
  },
];

function GuidedBuilderPage() {
  const { projectId, characterId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const callUpsert = useServerFn(upsertCharacter);
  const callFull = useServerFn(generateFullCharacter);
  const { data: onboarding } = useOnboarding();

  const experience = String(onboarding?.writer_experience_level ?? "").toLowerCase();
  const isBeginner = /\b(first|guided)\b/.test(experience);
  const isExperienced = /\b(experienced|pitching)\b/.test(experience);

  const { data: project } = useQuery({
    queryKey: ["project-title", projectId],
    queryFn: async () =>
      (await supabase.from("projects").select("title").eq("id", projectId).maybeSingle()).data,
  });

  const { data: character } = useQuery<any>({
    queryKey: ["character", characterId],
    refetchOnMount: "always",
    queryFn: async (): Promise<any> =>
      (await supabase.from("characters").select("*").eq("id", characterId).maybeSingle()).data,
  });

  const [step, setStep] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const current = STEPS[step];
  const value = drafts[current.field] ?? (character?.[current.field] ?? "");
  const hasExisting = !!(character?.[current.field] && String(character[current.field]).trim());

  const progress = useMemo(
    () => STEPS.filter((s) => character?.[s.field] && String(character[s.field]).trim()).length,
    [character],
  );
  const pct = Math.round((progress / STEPS.length) * 100);

  const save = useMutation({
    mutationFn: async (patch: Record<string, any>) =>
      callUpsert({ data: { id: characterId, project_id: projectId, patch } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["character", characterId] });
      qc.invalidateQueries({ queryKey: ["characters", projectId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const commitStep = async (nextIndex: number) => {
    const trimmed = (drafts[current.field] ?? "").trim();
    if (trimmed && trimmed !== (character?.[current.field] ?? "")) {
      await save.mutateAsync({ [current.field]: trimmed });
    }
    setStep(Math.max(0, Math.min(STEPS.length - 1, nextIndex)));
  };

  const helpMeWrite = async () => {
    if (hasExisting) {
      toast.info("This field already has content. Clear it first to request a new suggestion.");
      return;
    }
    setBusy(true);
    try {
      const out: any = await callFull({ data: { characterId } });
      const suggestion = out?.row?.[current.field];
      if (suggestion) {
        setDrafts((d) => ({ ...d, [current.field]: String(suggestion) }));
        toast.success(out?.demo ? "Suggested (demo mode)" : "Suggested");
      } else {
        toast.info("No suggestion available for this field.");
      }
      qc.invalidateQueries({ queryKey: ["character", characterId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Suggestion failed");
    } finally {
      setBusy(false);
    }
  };

  const exitTo = () =>
    navigate({ to: "/characters/$projectId", params: { projectId } });

  // Autosave when leaving a step via keyboard
  useEffect(() => {
    return () => { /* no-op cleanup */ };
  }, [step]);

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border/60 bg-card/60 backdrop-blur">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link
            to="/characters/$projectId"
            params={{ projectId }}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Cast</span>
          </Link>
          <span className="text-muted-foreground/60">/</span>
          <span className="text-sm text-foreground/80 truncate">{project?.title ?? "Project"}</span>
          <span className="text-muted-foreground/60">/</span>
          <span className="text-sm font-medium text-foreground truncate">
            Build {character?.name || "Character"}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span className="tabular-nums">{progress}/{STEPS.length} · {pct}%</span>
              <div className="h-1.5 w-32 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={exitTo}>
              <X className="h-4 w-4 mr-1" />Exit
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_320px] gap-6">
        {/* Left rail — stepper */}
        <nav aria-label="Builder steps" className="hidden lg:block">
          <ol className="space-y-1 sticky top-20">
            {STEPS.map((s, i) => {
              const filled = !!(character?.[s.field] && String(character[s.field]).trim());
              const active = i === step;
              return (
                <li key={s.field}>
                  <button
                    onClick={() => setStep(i)}
                    className={[
                      "w-full text-left flex items-center gap-3 rounded-md px-3 py-2 text-sm transition border",
                      active
                        ? "border-primary/50 bg-primary/10 text-foreground"
                        : "border-transparent hover:bg-secondary/60 text-muted-foreground hover:text-foreground",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "h-6 w-6 shrink-0 rounded-full grid place-items-center text-[11px] font-semibold border",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : filled
                          ? "bg-primary/20 text-primary border-primary/40"
                          : "bg-secondary text-muted-foreground border-border",
                      ].join(" ")}
                    >
                      {filled && !active ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    <span className="truncate">{s.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Center — question card */}
        <main className="min-w-0">
          <div className="rounded-2xl border border-border/70 bg-card/60 p-6 sm:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Step {step + 1} of {STEPS.length}
              </div>
              {hasExisting && (
                <span className="inline-flex items-center gap-1 text-xs text-primary">
                  <Check className="h-3.5 w-3.5" />Saved
                </span>
              )}
            </div>

            <h1 className="font-display text-3xl sm:text-4xl font-semibold text-foreground">
              {current.title}
            </h1>
            <p className="mt-3 text-base text-foreground/80 leading-relaxed">{current.explainer}</p>
            {!isExperienced && (
              <p className="mt-2 text-sm italic text-muted-foreground">{current.example}</p>
            )}
            {isBeginner && current.beginnerHint && (
              <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-foreground/85 flex gap-2">
                <BookOpen className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-primary font-semibold">Coach tip</div>
                  <div>{current.beginnerHint}</div>
                </div>
              </div>
            )}

            <div className="mt-6">
              {current.field === "name" ? (
                <Input
                  value={value}
                  autoFocus
                  placeholder={current.placeholder}
                  onChange={(e) => setDrafts((d) => ({ ...d, [current.field]: e.target.value }))}
                  className="text-lg h-12"
                />
              ) : (
                <Textarea
                  value={value}
                  autoFocus
                  rows={5}
                  placeholder={current.placeholder}
                  onChange={(e) => setDrafts((d) => ({ ...d, [current.field]: e.target.value }))}
                  className="text-base resize-none"
                />
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={helpMeWrite} disabled={busy || hasExisting}>
                {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                Help me write this
              </Button>
              {hasExisting && (
                <span className="text-[11px] text-muted-foreground">
                  Existing value protected — clear the field to request a new suggestion.
                </span>
              )}
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
                Skip for now
              </Button>
            </div>
          </div>

          {/* Nav footer */}
          <div className="mt-6 flex items-center justify-between">
            <Button variant="outline" onClick={() => commitStep(step - 1)} disabled={step === 0 || save.isPending}>
              <ChevronLeft className="h-4 w-4 mr-1" />Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => commitStep(step + 1)} disabled={save.isPending}>
                {save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Save & continue<ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={async () => {
                  await commitStep(step);
                  toast.success("Character saved");
                  exitTo();
                }}
                disabled={save.isPending}
              >
                {save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Finish & return to cast
              </Button>
            )}
          </div>
        </main>

        {/* Right rail — snapshot */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-4">
            <div className="rounded-2xl border border-border/70 bg-card/60 p-5">
              <div className="flex items-center gap-2 mb-3">
                <UserIcon className="h-4 w-4 text-primary" />
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Character snapshot
                </div>
              </div>
              <div className="font-display text-xl font-semibold text-foreground truncate">
                {(drafts.name || character?.name || "Untitled").toString()}
              </div>
              {character?.role && (
                <div className="text-xs text-muted-foreground mt-0.5">{character.role}</div>
              )}

              <dl className="mt-4 space-y-3 text-sm">
                <SnapshotRow icon={Target} label="Want" tone="text-primary/90"
                  value={drafts.external_goal ?? character?.external_goal} />
                <SnapshotRow icon={Zap} label="Need" tone="text-amber-500/90"
                  value={drafts.internal_need ?? character?.internal_need} />
                <SnapshotRow icon={ShieldCheck} label="Lie" tone="text-rose-400/90"
                  value={drafts.core_lie ?? character?.core_lie} />
                <SnapshotRow icon={BookOpen} label="Arc" tone="text-emerald-400/90"
                  value={drafts.character_arc ?? character?.character_arc} />
              </dl>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card/60 p-5">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Character truth
                </div>
              </div>
              <TruthStatus progress={progress} total={STEPS.length} />
              <p className="text-xs text-muted-foreground mt-3">
                Fill Want, Need, Lie, and Arc to unlock deeper Truth Checks in the Character workspace.
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                SceneSmith Academy
              </div>
              <p className="text-xs text-foreground/80">
                Learn how <span className="text-primary">Want vs Need</span> creates the engine of every scene.
              </p>
              <Link
                to="/academy"
                className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Open lesson<ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SnapshotRow({
  icon: Icon, label, value, tone,
}: { icon: any; label: string; value?: string | null; tone: string }) {
  return (
    <div>
      <dt className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold ${tone}`}>
        <Icon className="h-3 w-3" />{label}
      </dt>
      <dd className={`mt-1 text-xs ${value ? "text-foreground/85" : "text-muted-foreground/60 italic"} line-clamp-3`}>
        {value || "—"}
      </dd>
    </div>
  );
}

function TruthStatus({ progress, total }: { progress: number; total: number }) {
  const status =
    progress === total ? { label: "Strong", tone: "text-emerald-400", bar: "bg-emerald-400" } :
    progress >= Math.ceil(total * 0.6) ? { label: "Developing", tone: "text-amber-400", bar: "bg-amber-400" } :
    { label: "Needs work", tone: "text-rose-400", bar: "bg-rose-400" };
  const pct = Math.round((progress / total) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div className={`text-lg font-display font-semibold ${status.tone}`}>{status.label}</div>
        <div className="text-xs text-muted-foreground tabular-nums">{pct}%</div>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
        <div className={`h-full ${status.bar} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
