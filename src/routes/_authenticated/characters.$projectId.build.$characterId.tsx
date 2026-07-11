// Characters Rebuild — Pass 4 (Guided Character Builder).
// Cinematic full-screen route inspired by the approved iPad mockup.
// See docs/CHARACTERS_REBUILD.md.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Sparkles, ChevronLeft, ChevronRight, ChevronDown, Loader2, Check, X,
  ArrowLeft, ArrowRight, Star, HelpCircle, Rocket, Crosshair, Clock,
  MessageCircle, Shield, Lightbulb, Save, Eye, Wand2, Image as ImageIcon,
  GraduationCap, Flame, Users, BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { upsertCharacter, generateFullCharacter, generatePortrait } from "@/lib/characters.functions";
import { useOnboarding } from "@/hooks/use-onboarding";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";

export const Route = createFileRoute(
  "/_authenticated/characters/$projectId/build/$characterId",
)({
  head: () => ({ meta: [{ title: "Build Character — SceneSmith Studio" }] }),
  component: GuidedBuilderPage,
  errorComponent: RouteErrorBoundary,
});

type Step = {
  field: string;
  title: string;
  subtitle: string;
  question: (name: string) => string;
  whyItMatters: string;
  placeholder: string;
  starters: string[];
  coach: string[];
  beginnerHint?: string;
  kind?: "text" | "textarea" | "portrait";
};

const STEPS: Step[] = [
  {
    field: "role",
    title: "Role",
    subtitle: "Who they are in the story",
    question: (n) => `What is ${n}'s role in the story?`,
    whyItMatters: "Role sets the gravitational pull of every scene they enter — hero, antagonist, mirror, catalyst.",
    placeholder: "Reluctant company commander bearing the weight of leadership…",
    starters: ["They are the one who…", "In this world they represent…", "The story needs them to…", "Their function is…"],
    coach: [
      "Think about function, not personality. What does the story require this person to do?",
      "If you removed them from the script, what collapses?",
    ],
    beginnerHint: "Role is about job in the story engine, not adjectives. Protagonist, foil, mentor, catalyst.",
  },
  {
    field: "external_goal",
    title: "Want",
    subtitle: "What they're fighting for",
    question: (n) => `What does ${n} want more than anything else?`,
    whyItMatters: "The visible goal is what the camera can film — it drives every choice on the page.",
    placeholder: "To hold the line and protect his men at any cost…",
    starters: ["They will do anything to…", "By the end they need to…", "The prize they chase is…", "If they lose this, they lose…"],
    coach: [
      "A stranger watching with the sound off should see this goal.",
      "Concrete beats abstract. 'Get her out by Sunday' > 'find peace.'",
    ],
  },
  {
    field: "act2_pressure",
    title: "External Pressure",
    subtitle: "What stands in their way",
    question: (n) => `What outside force is squeezing ${n} right now?`,
    whyItMatters: "Pressure is the crucible that turns a want into drama. The stronger the vise, the sharper the choices.",
    placeholder: "A collapsing front line, orders that betray his conscience, no clean way out…",
    starters: ["The world is closing in because…", "They can't just walk away because…", "Time is running out because…", "The cost of failure is…"],
    coach: [
      "Pressure works when it forces a choice between two things they value.",
      "Name the specific external force — a person, a deadline, a threat.",
    ],
  },
  {
    field: "fear",
    title: "Fear",
    subtitle: "What they risk",
    question: (n) => `What is ${n} most afraid will happen if they fail?`,
    whyItMatters: "Fear creates pressure. It shapes the choices they make, the risks they take, and the lines they might cross.",
    placeholder: "Becoming the kind of man his father was — ruthless, feared, and alone…",
    starters: ["They fear that…", "If they fail…", "The worst part would be…", "Deep down they believe…"],
    coach: [
      "Is this fear about death — or about what survival might turn them into?",
      "What would this failure say about them?",
    ],
    beginnerHint: "The best fears aren't of losing something. They're of becoming someone.",
  },
  {
    field: "wound",
    title: "Wound",
    subtitle: "Where it hurts",
    question: (n) => `What old hurt still shapes ${n} today?`,
    whyItMatters: "Wounds are the private history that dictates present-tense behavior. Concrete events, not moods.",
    placeholder: "The night his brother was taken and no one came looking…",
    starters: ["The event they never talk about is…", "Everything changed the day…", "They still flinch when…", "Before the wound they were…"],
    coach: [
      "Wounds are events, not feelings. Something specific happened.",
      "The wound is the reason for the lie.",
    ],
  },
  {
    field: "core_lie",
    title: "Lie",
    subtitle: "What they believe",
    question: (n) => `What false belief does ${n} carry because of that wound?`,
    whyItMatters: "The lie is the truth the story will dismantle. Great arcs are lies giving way to a hard-earned truth.",
    placeholder: "If I stay in control, nobody else gets hurt…",
    starters: ["They tell themselves…", "The rule they live by is…", "They can't afford to believe…", "Their armor is…"],
    coach: [
      "A good lie sounds like a virtue — that's why it's hard to give up.",
      "The stronger the lie, the stronger the arc.",
    ],
  },
  {
    field: "relationships",
    title: "Relationships",
    subtitle: "Who shapes them",
    question: (n) => `Who is the one person who most challenges ${n}?`,
    whyItMatters: "The right relationship is a mirror the character can't look away from. Name who threatens the lie.",
    placeholder: "Hans — his loyal subordinate, and the one person who keeps offering him mercy he refuses to accept…",
    starters: ["They can't lie to…", "The one who sees them clearly is…", "They're softest around…", "The relationship at risk is…"],
    coach: [
      "Choose the person who exposes the lie, not the person who agrees with it.",
      "Conflict between values > conflict of goals.",
    ],
  },
  {
    field: "voice_summary",
    title: "Voice",
    subtitle: "How they speak",
    question: (n) => `How does ${n} sound on the page?`,
    whyItMatters: "Voice is signature. A reader should hear this character in the first two lines of any dialogue block.",
    placeholder: "Clipped, formal, never says a subordinate's first name. Asks questions instead of answering them…",
    starters: ["Their sentences tend to…", "They never say…", "Their tell is…", "Under stress they…"],
    coach: [
      "Three adjectives + one habit is enough.",
      "What word will they never use?",
    ],
  },
  {
    field: "character_arc",
    title: "Arc",
    subtitle: "How they change",
    question: (n) => `What is ${n}'s transformation — from what, to what?`,
    whyItMatters: "The arc is the promise of the story. The lie at the start becomes the truth at the end.",
    placeholder: "From self-reliance as armor → to chosen vulnerability as strength…",
    starters: ["From __ to __", "They start believing…", "By the final page they accept…", "The moment they change is when…"],
    coach: [
      "The lie is the start. Its opposite is the end.",
      "Great arcs are earned, not announced.",
    ],
  },
  {
    field: "portrait_url",
    title: "Portrait",
    subtitle: "Visual & emotional tone",
    question: (n) => `Generate ${n}'s feature portrait.`,
    whyItMatters: "A single frame that captures the contradictions you've written into the character. Reference for every casting and storyboard conversation.",
    placeholder: "",
    starters: [],
    coach: [
      "Portraits pull from name, role, wound, and voice. Sharpen those first for a truer image.",
      "You can regenerate as many times as you need — each pass costs credits.",
    ],
    kind: "portrait",
  },
];

function initials(name?: string | null): string {
  const n = (name || "").trim();
  if (!n) return "?";
  const parts = n.split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

function GuidedBuilderPage() {
  const { projectId, characterId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const callUpsert = useServerFn(upsertCharacter);
  const callFull = useServerFn(generateFullCharacter);
  const callPortrait = useServerFn(generatePortrait);
  const { data: onboarding } = useOnboarding();

  const experience = String(onboarding?.writer_experience_level ?? "").toLowerCase();
  const isBeginner = /\b(first|guided)\b/.test(experience);
  const isExperienced = /\b(experienced|pitching)\b/.test(experience);

  const { data: project } = useQuery({
    queryKey: ["project-title", projectId],
    queryFn: async () =>
      (await supabase.from("projects").select("title").eq("id", projectId).maybeSingle()).data,
  });

  const { data: character, isLoading: characterLoading } = useQuery<any>({
    queryKey: ["character", characterId],
    refetchOnMount: "always",
    queryFn: async (): Promise<any> =>
      (await supabase.from("characters").select("*").eq("id", characterId).maybeSingle()).data,
  });

  // Auto-create: if the URL characterId doesn't resolve to a real row, create
  // the first character for this project and redirect into its builder.
  const autoCreateRef = useRef(false);
  useEffect(() => {
    if (characterLoading) return;
    if (character) return;
    if (autoCreateRef.current) return;
    autoCreateRef.current = true;
    (async () => {
      try {
        const row: any = await callUpsert({
          data: { project_id: projectId, patch: { name: "New Character" } },
        });
        if (!row?.id) throw new Error("Could not create character");
        toast.success("Created your first character — let's build them.");
        qc.invalidateQueries({ queryKey: ["characters", projectId] });
        navigate({
          to: "/characters/$projectId/build/$characterId",
          params: { projectId, characterId: row.id },
          replace: true,
        });
      } catch (e: any) {
        autoCreateRef.current = false;
        toast.error(e?.message ?? "Could not create character");
      }
    })();
  }, [character, characterLoading, projectId, callUpsert, navigate, qc]);

  const [step, setStep] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [expandedCoach, setExpandedCoach] = useState<number | null>(0);
  const [portraitBusy, setPortraitBusy] = useState(false);

  const current = STEPS[step];
  const isPortrait = current.kind === "portrait";
  const currentValue = drafts[current.field] ?? (character?.[current.field] ?? "");
  const hasExisting = !!(character?.[current.field] && String(character[current.field]).trim());
  const charCount = currentValue.length;

  const strengths = useMemo(
    () => STEPS.filter((s) => character?.[s.field] && String(character[s.field]).trim()).length,
    [character],
  );
  const gaps = STEPS.length - strengths;
  const health = strengths >= 8 ? "Strong" : strengths >= 5 ? "Developing" : "Emerging";
  const healthTone =
    health === "Strong" ? "text-emerald-400" : health === "Developing" ? "text-amber-400" : "text-rose-400";

  const importance = (character?.importance || "").toLowerCase();
  const importanceLabel =
    importance === "main" ? "Lead Character" :
    importance === "supporting" ? "Supporting" :
    importance === "minor" ? "Minor" :
    importance === "unassigned" ? "Unassigned" : "Lead Character";

  const displayName = (drafts.name || character?.name || "Untitled").toString();

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
    if (!isPortrait) {
      const trimmed = (drafts[current.field] ?? "").trim();
      if (trimmed && trimmed !== (character?.[current.field] ?? "")) {
        await save.mutateAsync({ [current.field]: trimmed });
      }
    }
    setStep(Math.max(0, Math.min(STEPS.length - 1, nextIndex)));
    setExpandedCoach(0);
  };

  const saveDraft = async () => {
    if (isPortrait) return;
    const trimmed = (drafts[current.field] ?? "").trim();
    if (!trimmed || trimmed === (character?.[current.field] ?? "")) {
      toast.info("Nothing new to save.");
      return;
    }
    await save.mutateAsync({ [current.field]: trimmed });
    toast.success("Draft saved");
  };

  const insertStarter = (s: string) => {
    setDrafts((d) => {
      const cur = d[current.field] ?? (character?.[current.field] ?? "");
      const prefix = cur.trim() ? `${cur.trim()} ` : "";
      return { ...d, [current.field]: `${prefix}${s} ` };
    });
  };

  const helpMeWrite = async (mode: "example" | "sharper" | "simpler" | "academy") => {
    if (isPortrait) return;
    if (hasExisting && mode !== "sharper" && mode !== "simpler") {
      toast.info("This field has content. Try 'Make it sharper' or clear it first.");
      return;
    }
    setBusy(true);
    try {
      const out: any = await callFull({ data: { characterId } });
      const suggestion = out?.row?.[current.field];
      if (suggestion) {
        setDrafts((d) => ({ ...d, [current.field]: String(suggestion) }));
        toast.success(out?.demo ? "Suggested (demo)" : "Suggested");
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

  const generatePortraitNow = async () => {
    setPortraitBusy(true);
    try {
      const out: any = await callPortrait({ data: { characterId } });
      qc.invalidateQueries({ queryKey: ["character", characterId] });
      qc.invalidateQueries({ queryKey: ["characters", projectId] });
      if (out?.row?.portrait_url) toast.success("Portrait generated");
    } catch (e: any) {
      toast.error(e?.message ?? "Portrait generation failed");
    } finally {
      setPortraitBusy(false);
    }
  };

  const exitTo = () =>
    navigate({ to: "/characters/$projectId", params: { projectId } });

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link to="/projects" className="text-sm text-muted-foreground hover:text-foreground transition">
            Projects
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
          <Link
            to="/characters/$projectId"
            params={{ projectId }}
            className="text-sm text-muted-foreground hover:text-foreground transition truncate max-w-[160px]"
          >
            {project?.title ?? "Project"}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
          <Link
            to="/characters/$projectId"
            params={{ projectId }}
            className="text-sm text-muted-foreground hover:text-foreground transition"
          >
            Characters
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
          <span className="text-sm font-medium text-primary">Guided Builder</span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Help">
              <HelpCircle className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={exitTo}>
              <X className="h-4 w-4 mr-1" />Exit
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_340px] gap-6">
        {/* Left rail — stepper */}
        <nav aria-label="Builder steps" className="hidden lg:flex flex-col gap-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold px-1">
            Building {displayName}
          </div>
          <ol className="space-y-1">
            {STEPS.map((s, i) => {
              const filled = !!(character?.[s.field] && String(character[s.field]).trim());
              const active = i === step;
              return (
                <li key={s.field}>
                  <button
                    onClick={() => setStep(i)}
                    className={[
                      "w-full text-left flex items-start gap-3 rounded-lg px-2.5 py-2 text-sm transition group",
                      active ? "bg-primary/10" : "hover:bg-secondary/50",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "mt-0.5 h-7 w-7 shrink-0 rounded-full grid place-items-center text-[11px] font-semibold border-2 transition",
                        active
                          ? "border-primary text-primary shadow-[0_0_16px_rgba(201,168,76,0.35)]"
                          : filled
                          ? "border-primary/50 text-primary/80 bg-primary/10"
                          : "border-border text-muted-foreground/70",
                      ].join(" ")}
                    >
                      {filled && !active ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={["block font-medium leading-tight", active ? "text-foreground" : "text-foreground/80"].join(" ")}>
                        {s.title}
                      </span>
                      <span className="block text-[11px] text-muted-foreground/80 truncate">{s.subtitle}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <Link
            to="/academy"
            className="mt-2 rounded-xl border border-border/60 bg-card/60 p-3 flex gap-3 items-start hover:border-primary/40 transition"
          >
            <div className="h-8 w-8 rounded-lg bg-primary/15 grid place-items-center shrink-0">
              <GraduationCap className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-foreground">SceneSmith Academy</div>
              <div className="text-[11px] text-muted-foreground leading-snug">
                Learn how to craft unforgettable characters.
              </div>
              <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-primary">
                Open Academy <ChevronRight className="h-3 w-3" />
              </div>
            </div>
          </Link>
        </nav>

        {/* Center — main workspace */}
        <main className="min-w-0 space-y-5">
          {/* Character header card */}
          <div className="rounded-2xl border border-border/70 bg-card/60 p-5 sm:p-6 shadow-sm relative overflow-hidden">
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.05] bg-[radial-gradient(circle_at_top_right,var(--primary),transparent_60%)]" />
            <div className="relative flex items-center gap-5">
              {character?.portrait_url ? (
                <img
                  src={character.portrait_url}
                  alt={`${displayName} portrait`}
                  className="h-20 w-20 rounded-2xl object-cover border border-primary/40"
                />
              ) : (
                <div className="h-20 w-20 rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/20 to-primary/5 grid place-items-center font-display text-3xl text-primary">
                  {initials(displayName)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-wide text-foreground truncate">
                    {displayName.toUpperCase()}
                  </h1>
                  <button
                    aria-label="Favorite"
                    className="text-muted-foreground/60 hover:text-primary transition"
                  >
                    <Star className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border border-primary/40 text-primary bg-primary/5 uppercase tracking-wider">
                    {importanceLabel}
                  </span>
                </div>
              </div>
              <div className="hidden sm:block text-right shrink-0">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Step {step + 1} of {STEPS.length}</div>
                <div className="mt-0.5 font-display text-lg text-primary">{current.title}</div>
              </div>
              <div className="hidden md:block text-right shrink-0 pl-4 border-l border-border/60">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Profile Health</div>
                <div className={`mt-0.5 font-display text-lg ${healthTone} flex items-center gap-1.5 justify-end`}>
                  <Flame className="h-4 w-4" /> {health}
                </div>
                <div className="mt-1.5 flex gap-1 justify-end">
                  {STEPS.map((_, i) => (
                    <span
                      key={i}
                      className={[
                        "h-1.5 w-4 rounded-full",
                        i < strengths ? "bg-emerald-400/80" : "bg-secondary",
                      ].join(" ")}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Question card */}
          <div className="rounded-2xl border border-border/70 bg-card/50 p-6 sm:p-8">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-primary/90 font-semibold">
              <span className="h-1 w-1 rounded-full bg-primary" />
              Current prompt
            </div>

            {isPortrait ? (
              <>
                <h2 className="mt-3 font-display text-3xl sm:text-4xl font-semibold text-foreground leading-tight">
                  {current.question(displayName)}
                </h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  <span className="text-primary font-medium">Why this matters: </span>
                  {current.whyItMatters}
                </p>

                <div className="mt-6 grid sm:grid-cols-[240px_minmax(0,1fr)] gap-6 items-start">
                  <div className="aspect-[3/4] rounded-xl border border-border/70 bg-card overflow-hidden grid place-items-center relative">
                    {character?.portrait_url ? (
                      <img
                        src={character.portrait_url}
                        alt={`${displayName} portrait`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="text-center px-4">
                        <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/60" />
                        <p className="mt-2 text-xs text-muted-foreground">
                          No portrait yet. Generate one when Name, Role, Voice, and Wound feel true.
                        </p>
                      </div>
                    )}
                    {portraitBusy && (
                      <div className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-sm">
                        <div className="text-center">
                          <Loader2 className="h-6 w-6 mx-auto animate-spin text-primary" />
                          <p className="mt-2 text-xs text-muted-foreground">Rendering portrait…</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Button onClick={generatePortraitNow} disabled={portraitBusy} className="w-full sm:w-auto">
                      {portraitBusy
                        ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        : <Wand2 className="h-4 w-4 mr-2" />}
                      {character?.portrait_url ? "Regenerate portrait" : "Generate portrait"}
                    </Button>
                    <div className="rounded-lg border border-border/60 bg-secondary/40 p-3 text-xs text-muted-foreground space-y-1">
                      <div className="flex items-center gap-1.5 text-primary/90 font-semibold text-[11px] uppercase tracking-wider">
                        <Lightbulb className="h-3.5 w-3.5" />Coaching
                      </div>
                      <p>{current.coach[0]}</p>
                      <p>{current.coach[1]}</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="mt-3 font-display text-3xl sm:text-4xl font-semibold text-foreground leading-tight">
                  {current.question(displayName)}
                </h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  <span className="text-primary font-medium">Why this matters: </span>
                  {current.whyItMatters}
                </p>

                {current.starters.length > 0 && (
                  <div className="mt-6">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                      Starter prompts
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {current.starters.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => insertStarter(s)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-secondary/40 px-3 py-1.5 text-xs text-foreground/85 hover:border-primary/50 hover:text-primary transition"
                        >
                          {i === 0 && <MessageCircle className="h-3 w-3" />}
                          {i === 1 && <Rocket className="h-3 w-3" />}
                          {i === 2 && <Crosshair className="h-3 w-3" />}
                          {i === 3 && <Clock className="h-3 w-3" />}
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Your response
                    </div>
                    {hasExisting && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                        <Check className="h-3 w-3" />Saved
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    {current.field === "role" && !hasExisting ? (
                      <Input
                        value={currentValue}
                        autoFocus
                        placeholder={current.placeholder}
                        onChange={(e) => setDrafts((d) => ({ ...d, [current.field]: e.target.value }))}
                        className="h-12 text-base pr-10"
                      />
                    ) : (
                      <Textarea
                        value={currentValue}
                        autoFocus
                        rows={5}
                        maxLength={600}
                        placeholder={current.placeholder}
                        onChange={(e) => setDrafts((d) => ({ ...d, [current.field]: e.target.value }))}
                        className="text-base resize-none pr-10"
                      />
                    )}
                    <Sparkles className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-primary/70" />
                    <div className="absolute bottom-2 right-3 text-[10px] tabular-nums text-muted-foreground/70">
                      {charCount} / 600
                    </div>
                  </div>
                </div>

                {!isExperienced && (
                  <div className="mt-6">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                      Adaptive coaching
                    </div>
                    <div className="space-y-2">
                      {current.coach.map((line, i) => {
                        const open = expandedCoach === i;
                        return (
                          <button
                            key={i}
                            onClick={() => setExpandedCoach(open ? null : i)}
                            className="w-full text-left rounded-lg border border-border/60 bg-secondary/30 hover:border-primary/40 transition overflow-hidden"
                          >
                            <div className="flex items-center gap-2 px-3 py-2.5">
                              <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span className="flex-1 text-sm text-foreground/90">{line}</span>
                              <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
                            </div>
                            {open && isBeginner && current.beginnerHint && i === 0 && (
                              <div className="px-3 pb-3 pt-1 text-xs text-muted-foreground border-t border-border/50">
                                {current.beginnerHint}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-6 flex flex-wrap gap-2">
                  <ActionPill icon={Lightbulb} label="Need an example" onClick={() => helpMeWrite("example")} disabled={busy} />
                  <ActionPill icon={Crosshair} label="Make it sharper" onClick={() => helpMeWrite("sharper")} disabled={busy} />
                  <ActionPill icon={Eye} label="Keep it simple" onClick={() => helpMeWrite("simpler")} disabled={busy} />
                  <ActionPill icon={BookOpen} label="Use Academy guidance" onClick={() => helpMeWrite("academy")} disabled={busy} />
                </div>
              </>
            )}
          </div>

          {/* Nav footer */}
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" onClick={() => commitStep(step - 1)} disabled={step === 0 || save.isPending}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />Back
            </Button>
            <div className="flex items-center gap-2">
              {!isPortrait && (
                <Button variant="outline" onClick={saveDraft} disabled={save.isPending}>
                  <Save className="h-4 w-4 mr-1.5" />Save Draft
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button onClick={() => commitStep(step + 1)} disabled={save.isPending}>
                  {save.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                  Save & Continue<ArrowRight className="h-4 w-4 ml-1.5" />
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
                  {save.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                  Finish & return to cast
                </Button>
              )}
            </div>
          </div>
        </main>

        {/* Right rail — Character Snapshot */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 rounded-2xl border border-border/70 bg-card/50 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-primary/15 grid place-items-center">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-primary">
                Character Snapshot
              </div>
            </div>
            <div className="text-xs text-muted-foreground -mt-2">What we know so far</div>

            <SnapshotRow
              icon={BookOpen} tone="text-primary" label="Role in Story"
              value={drafts.role ?? character?.role}
              empty="Add a role in Step 1."
            />
            <SnapshotRow
              icon={Rocket} tone="text-primary" label="External Goal"
              value={drafts.external_goal ?? character?.external_goal}
              empty="Name the visible want."
            />
            <SnapshotRow
              icon={Crosshair} tone="text-primary" label="Core Tension"
              value={drafts.act2_pressure ?? character?.act2_pressure}
              empty="Add the pressure they face."
            />
            <SnapshotRow
              icon={Clock} tone="text-primary" label="TMH Baseline"
              value={character?.core_lie
                ? `${health} — The lie is holding, but the story is testing it.`
                : undefined}
              empty="Fill Wound + Lie to seed the arc."
            />
            <SnapshotRow
              icon={Users} tone="text-primary" label="Key Relationship"
              value={drafts.relationships ?? character?.relationships}
              empty="Add the person who challenges them."
            />

            <div className="pt-3 border-t border-border/60">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-primary font-semibold">
                <Shield className="h-3.5 w-3.5" /> Builds Toward Truth
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                Your answers feed the Truth Check and editorial review to ensure depth, consistency, and impact.
              </p>
              <Link to="/academy" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Learn more about Truth Check <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </aside>
      </div>

      {/* Bottom foundation banner */}
      <div className="border-t border-border/60 bg-card/40 backdrop-blur">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/15 grid place-items-center">
            <Flame className="h-4 w-4 text-primary" />
          </div>
          <div className="text-sm text-foreground/90 min-w-0 flex-1">
            Foundation is taking shape — <span className="text-emerald-400 font-medium">{strengths} strengths</span>
            {gaps > 0 && (
              <>
                {", "}
                <span className="text-amber-400 font-medium">{gaps} areas</span> to deepen.
              </>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setStep(STEPS.length - 1)}>
            View Insights<ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ActionPill({
  icon: Icon, label, onClick, disabled,
}: { icon: any; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-xs text-foreground/85 hover:border-primary/50 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition"
    >
      <Icon className="h-3.5 w-3.5" />{label}
    </button>
  );
}

function SnapshotRow({
  icon: Icon, label, value, tone, empty,
}: { icon: any; label: string; value?: string | null; tone: string; empty?: string }) {
  const hasValue = !!(value && String(value).trim());
  return (
    <div className="flex gap-3">
      <div className="h-8 w-8 rounded-lg bg-primary/10 grid place-items-center shrink-0">
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-[11px] uppercase tracking-wider font-semibold ${tone}`}>{label}</div>
        <div className={`mt-0.5 text-xs leading-relaxed ${hasValue ? "text-foreground/85" : "text-muted-foreground/70 italic"} line-clamp-4`}>
          {hasValue ? value : (empty || "—")}
        </div>
      </div>
    </div>
  );
}
