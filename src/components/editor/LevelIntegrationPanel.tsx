import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useOnboarding } from "@/hooks/use-onboarding";
import { upsertOnboarding } from "@/lib/onboarding.functions";
import { resolveWriterGuidance } from "@/lib/story-intelligence/writerProfileSignals";
import { TMH_LEVELS, tmhVar } from "@/components/characters/tmh";
import { GraduationCap, Compass } from "lucide-react";
import { toast } from "sonner";

type Mode = "guided" | "studio";
type Coach = "off" | "gentle" | "active" | "teaching";

const EXPERIENCE_LEVELS: { value: string; label: string; desc: string }[] = [
  { value: "first", label: "First screenplay", desc: "Teach me the craft as I go." },
  { value: "guided", label: "Learning (guided)", desc: "Structured prompts and reminders." },
  { value: "adapting", label: "Adapting existing work", desc: "Focused format & structure checks." },
  { value: "experienced", label: "Experienced writer", desc: "Only speak up when something's off." },
  { value: "pitching", label: "Pitching / production", desc: "Diagnostic notes, no basics." },
];

export function LevelIntegrationPanel() {
  const qc = useQueryClient();
  const { data: onboarding } = useOnboarding();
  const upsertFn = useServerFn(upsertOnboarding);

  const mutate = useMutation({
    mutationFn: (patch: {
      preferred_mode?: Mode;
      coaching_level?: Coach;
      writer_experience_level?: string;
    }) => upsertFn({ data: patch }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding"] });
      toast.success("Level updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mode = (onboarding?.preferred_mode ?? "studio") as Mode;
  const coach = (onboarding?.coaching_level ?? "gentle") as Coach;
  const experience = (onboarding?.writer_experience_level ?? "experienced") as string;

  const guidance = useMemo(
    () =>
      resolveWriterGuidance({
        mode: mode === "guided" ? "basic" : "advanced",
        coachingLevel: coach,
        writerExperienceLevel: experience,
      }),
    [mode, coach, experience],
  );

  return (
    <div className="rounded-md border border-border/60 bg-card/40 p-3 space-y-3">
      <div className="flex items-center gap-1.5">
        <GraduationCap className="h-3.5 w-3.5 text-primary" />
        <h4 className="text-xs font-semibold">ITS / PfHU Levels</h4>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Writing mode</Label>
          <Select value={mode} onValueChange={(v: Mode) => mutate.mutate({ preferred_mode: v })}>
            <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="guided">Guided (basic) — teach as I go</SelectItem>
              <SelectItem value="studio">Studio (advanced) — pro formatting</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Experience level</Label>
          <Select
            value={experience}
            onValueChange={(v: string) => mutate.mutate({ writer_experience_level: v })}
          >
            <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EXPERIENCE_LEVELS.map((e) => (
                <SelectItem key={e.value} value={e.value}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground mt-1">
            {EXPERIENCE_LEVELS.find((e) => e.value === experience)?.desc}
          </p>
        </div>

        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Coach depth</Label>
          <Select value={coach} onValueChange={(v: Coach) => mutate.mutate({ coaching_level: v })}>
            <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="off">Off — silent</SelectItem>
              <SelectItem value="gentle">Gentle — flag issues only</SelectItem>
              <SelectItem value="active">Active — craft suggestions</SelectItem>
              <SelectItem value="teaching">Teaching — explain the principle</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Resolved guidance profile */}
      <div className="rounded-md bg-muted/30 border border-border/40 p-2 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Compass className="h-3 w-3 text-primary" />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Resolved coaching profile
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-[10px]">tone: {guidance.tone}</Badge>
          <Badge variant="outline" className="text-[10px]">depth: {guidance.depth}</Badge>
          <Badge variant="outline" className="text-[10px]">reasons ≤ {guidance.maxReasons}</Badge>
          {guidance.showEvidence && <Badge variant="outline" className="text-[10px]">evidence</Badge>}
          {guidance.showSuggestedFixes && <Badge variant="outline" className="text-[10px]">fixes</Badge>}
          {guidance.includeNextStep && <Badge variant="outline" className="text-[10px]">next step</Badge>}
          {guidance.includeConceptLabel && <Badge variant="outline" className="text-[10px]">concept labels</Badge>}
          {guidance.preferPlainLanguage && <Badge variant="outline" className="text-[10px]">plain language</Badge>}
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug">
          Truth Check, Director's Chair, and Would-They-Do-This panels apply this profile automatically.
        </p>
      </div>

      {/* TMH quick reference */}
      <div className="space-y-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          TMH — The Moral Hierarchy
        </span>
        <ul className="grid grid-cols-1 gap-0.5">
          {TMH_LEVELS.map((l) => (
            <li key={l.level} className="flex items-start gap-2 text-[11px]">
              <span
                className="mt-1 h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: tmhVar(l.level) }}
                aria-hidden
              />
              <span>
                <strong>L{l.level} {l.name}.</strong>{" "}
                <span className="text-muted-foreground">{l.description}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[10px] text-muted-foreground mt-1">
          Assign each character a TMH baseline in the Casting Wall — Truth Check uses it to score whether a beat rings true.
        </p>
      </div>
    </div>
  );
}
