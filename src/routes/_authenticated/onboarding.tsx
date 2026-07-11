import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { upsertOnboarding } from "@/lib/onboarding.functions";
import { useOnboarding } from "@/hooks/use-onboarding";
import { supabase } from "@/integrations/supabase/client";
import {
  Pencil, BookOpen, Clapperboard, Library, FileText,
  Wand2, MessageCircle, ShieldCheck, Sparkles, ArrowRight,
  Drama, Laugh, Heart, Swords, Ghost, Compass,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Step inside — Screenplay Academy" }] }),
  component: OnboardingPage,
});

type Experience = "first" | "guided" | "experienced" | "adapting" | "pitching";
type Coaching = "off" | "gentle" | "active" | "teaching";
type Flavor = "drama" | "comedy" | "romance" | "action" | "thriller" | "exploring";

const EXPERIENCE_OPTIONS: { value: Experience; label: string; hint: string; icon: typeof Pencil; mode: "guided" | "studio" }[] = [
  { value: "first", label: "My first screenplay", hint: "Walk me onto the lot.", icon: Pencil, mode: "guided" },
  { value: "guided", label: "I've written before — guide me", hint: "I want a steady director on set.", icon: BookOpen, mode: "guided" },
  { value: "experienced", label: "Take me to the studio", hint: "I know the craft. Hand me the keys.", icon: Clapperboard, mode: "studio" },
  { value: "adapting", label: "Adapting a novel or idea", hint: "I'm bringing source material with me.", icon: Library, mode: "guided" },
  { value: "pitching", label: "Building a pitch package", hint: "I'm prepping the producer room.", icon: FileText, mode: "studio" },
];

const FLAVOR_OPTIONS: { value: Flavor; label: string; icon: typeof Drama }[] = [
  { value: "drama", label: "Drama", icon: Drama },
  { value: "comedy", label: "Comedy", icon: Laugh },
  { value: "romance", label: "Romance", icon: Heart },
  { value: "action", label: "Action / Adventure", icon: Swords },
  { value: "thriller", label: "Thriller / Horror", icon: Ghost },
  { value: "exploring", label: "Still exploring", icon: Compass },
];

const COACHING_OPTIONS: { value: Coaching; label: string; description: string; icon: typeof Wand2 }[] = [
  { value: "teaching", label: "Teach me as I go", description: "Walk me through each concept as I write.", icon: Wand2 },
  { value: "active", label: "Director's Chair, always on", description: "Suggest craft improvements as I go.", icon: MessageCircle },
  { value: "gentle", label: "Only when I call action", description: "Stay out of my way unless I ask.", icon: ShieldCheck },
  { value: "off", label: "Just the page", description: "Professional tools, no coach.", icon: Sparkles },
];

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            step === i ? "w-10 bg-primary" : step > i ? "w-6 bg-primary/60" : "w-6 bg-border"
          }`}
        />
      ))}
    </div>
  );
}

function OptionButton({
  active, onClick, icon: Icon, label, hint,
}: { active: boolean; onClick: () => void; icon: typeof Pencil; label: string; hint?: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-lg border transition flex items-start gap-3 cine-card ${
        active ? "border-primary bg-primary/[0.06]" : "border-border/60 hover:border-primary/40 bg-card"
      }`}
    >
      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${active ? "text-primary" : "text-muted-foreground"}`} />
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
      </div>
    </button>
  );
}

function OnboardingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertOnboarding);
  const { data: existing, isLoading } = useOnboarding();
  const [step, setStep] = useState(0);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [flavor, setFlavor] = useState<Flavor | null>(null);
  const [coaching, setCoaching] = useState<Coaching | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (!experience || !coaching) throw new Error("Pick both options");
      const mode = EXPERIENCE_OPTIONS.find((o) => o.value === experience)?.mode ?? "studio";
      await upsertFn({
        data: {
          writer_experience_level: experience,
          preferred_mode: mode,
          coaching_level: coaching,
        },
      });
      const { count } = await supabase.from("projects").select("id", { count: "exact", head: true });
      return { mode, hasProjects: (count ?? 0) > 0 };
    },
    onSuccess: ({ hasProjects }) => {
      qc.invalidateQueries({ queryKey: ["onboarding"] });
      toast.success("Studio's ready. Lights up.");
      if (!hasProjects) navigate({ to: "/projects/new" });
      else navigate({ to: "/dashboard" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <AppShell><div className="p-10 text-muted-foreground font-script italic">Setting the stage…</div></AppShell>;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-12">
        {existing && (
          <div className="text-xs text-muted-foreground mb-3 font-mono uppercase tracking-[0.18em]">
            Re-shoot: updating these will reset your studio setup.
          </div>
        )}
        <StepDots step={step} />
        <p className="text-xs font-mono uppercase tracking-[0.22em] text-primary/80 mb-2">
          Scene {step + 1} of 3
        </p>

        {step === 0 && (
          <>
            <h1 className="font-display text-3xl md:text-4xl font-semibold mb-1">What are we making?</h1>
            <p className="text-muted-foreground mb-6">Tell us how you walked onto the lot — we'll set the studio around it.</p>
            <div className="space-y-2">
              {EXPERIENCE_OPTIONS.map((o) => (
                <OptionButton
                  key={o.value}
                  active={experience === o.value}
                  onClick={() => setExperience(o.value)}
                  icon={o.icon}
                  label={o.label}
                  hint={o.hint}
                />
              ))}
            </div>
            <div className="flex justify-end mt-6">
              <Button disabled={!experience} onClick={() => setStep(1)}>
                Continue <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="font-display text-3xl md:text-4xl font-semibold mb-1">What kind of story?</h1>
            <p className="text-muted-foreground mb-6">A rough tone is enough — you can change genre any time.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FLAVOR_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setFlavor(o.value)}
                  className={`p-4 rounded-lg border transition flex flex-col items-center gap-2 cine-card ${
                    flavor === o.value ? "border-primary bg-primary/[0.06]" : "border-border/60 hover:border-primary/40 bg-card"
                  }`}
                >
                  <o.icon className={`h-6 w-6 ${flavor === o.value ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-sm font-medium">{o.label}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-6">
              <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>
              <Button disabled={!flavor} onClick={() => setStep(2)}>
                Continue <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="font-display text-3xl md:text-4xl font-semibold mb-1">How much help?</h1>
            <p className="text-muted-foreground mb-6">Pick a director style. You can change this from Studio Settings.</p>
            <div className="space-y-2">
              {COACHING_OPTIONS.map((o) => (
                <OptionButton
                  key={o.value}
                  active={coaching === o.value}
                  onClick={() => setCoaching(o.value)}
                  icon={o.icon}
                  label={o.label}
                  hint={o.description}
                />
              ))}
            </div>
            <div className="flex justify-between mt-6">
              <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
              <Button disabled={!coaching || save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? "Rolling…" : "Enter the Studio"}
              </Button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
