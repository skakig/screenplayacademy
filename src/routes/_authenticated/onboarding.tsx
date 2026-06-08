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
import { Pencil, BookOpen, Clapperboard, Library, FileText, Wand2, MessageCircle, ShieldCheck, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Welcome — SceneSmith AI" }] }),
  component: OnboardingPage,
});

type Experience = "first" | "guided" | "experienced" | "adapting" | "pitching";
type Coaching = "off" | "gentle" | "active" | "teaching";

const EXPERIENCE_OPTIONS: { value: Experience; label: string; icon: typeof Pencil; mode: "guided" | "studio" }[] = [
  { value: "first", label: "I'm writing my first screenplay.", icon: Pencil, mode: "guided" },
  { value: "guided", label: "I've written before, but I want guidance.", icon: BookOpen, mode: "guided" },
  { value: "experienced", label: "I'm experienced. Take me to the studio.", icon: Clapperboard, mode: "studio" },
  { value: "adapting", label: "I'm adapting a novel, comic, or idea.", icon: Library, mode: "guided" },
  { value: "pitching", label: "I'm building a pitch package.", icon: FileText, mode: "studio" },
];

const COACHING_OPTIONS: { value: Coaching; label: string; description: string; icon: typeof Wand2 }[] = [
  { value: "teaching", label: "Step-by-step lessons", description: "Walk me through each concept as I write.", icon: Wand2 },
  { value: "active", label: "Gentle coaching while I write", description: "Suggest craft improvements as I go.", icon: MessageCircle },
  { value: "gentle", label: "AI help only when I ask", description: "Stay out of my way unless I call for help.", icon: ShieldCheck },
  { value: "off", label: "Professional tools, minimal guidance", description: "Just the editor — no coach.", icon: Sparkles },
];

function OnboardingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertOnboarding);
  const { data: existing, isLoading } = useOnboarding();
  const [step, setStep] = useState(0);
  const [experience, setExperience] = useState<Experience | null>(null);
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
      // Check if user has any projects yet — if not, send them straight to project creation
      const { count } = await supabase.from("projects").select("id", { count: "exact", head: true });
      return { mode, hasProjects: (count ?? 0) > 0 };
    },
    onSuccess: ({ hasProjects }) => {
      qc.invalidateQueries({ queryKey: ["onboarding"] });
      toast.success("Welcome to SceneSmith.");
      if (!hasProjects) navigate({ to: "/projects/new" });
      else navigate({ to: "/dashboard" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <AppShell><div className="p-10 text-muted-foreground">Loading…</div></AppShell>;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-12">
        {existing && (
          <div className="text-xs text-muted-foreground mb-3">You've onboarded before — updating preferences will reset your studio.</div>
        )}
        <div className="flex items-center gap-2 mb-2">
          <span className={`h-2 w-12 rounded-full ${step >= 0 ? "bg-primary" : "bg-border"}`} />
          <span className={`h-2 w-12 rounded-full ${step >= 1 ? "bg-primary" : "bg-border"}`} />
        </div>
        {step === 0 ? (
          <>
            <h1 className="font-display text-3xl font-bold mb-1">What kind of writer are you today?</h1>
            <p className="text-muted-foreground mb-6">We'll tailor SceneSmith around how you want to work.</p>
            <div className="space-y-2">
              {EXPERIENCE_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setExperience(value)}
                  className={`w-full text-left p-4 rounded-lg border transition flex items-center gap-3 ${
                    experience === value
                      ? "border-primary bg-primary/5"
                      : "border-border/60 hover:border-primary/40 bg-card"
                  }`}
                >
                  <Icon className="h-5 w-5 text-primary shrink-0" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-6">
              <Button disabled={!experience} onClick={() => setStep(1)}>
                Continue <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl font-bold mb-1">How would you like SceneSmith to help?</h1>
            <p className="text-muted-foreground mb-6">Pick a coach style. You can change this anytime in Settings.</p>
            <div className="space-y-2">
              {COACHING_OPTIONS.map(({ value, label, description, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setCoaching(value)}
                  className={`w-full text-left p-4 rounded-lg border transition flex items-start gap-3 ${
                    coaching === value
                      ? "border-primary bg-primary/5"
                      : "border-border/60 hover:border-primary/40 bg-card"
                  }`}
                >
                  <Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-6">
              <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>
              <Button disabled={!coaching || save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? "Saving…" : "Enter SceneSmith"}
              </Button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
