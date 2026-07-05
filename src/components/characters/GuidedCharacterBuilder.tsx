import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, ChevronLeft, ChevronRight, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { upsertCharacter, generateFullCharacter } from "@/lib/characters.functions";

type Step = {
  field: string;
  title: string;
  explainer: string;
  example: string;
  placeholder: string;
};

const STEPS: Step[] = [
  { field: "role", title: "Story role",
    explainer: "The role this character plays in the story engine — protagonist, foil, mentor, catalyst. Keep it about function, not personality.",
    example: "e.g. Reluctant protagonist chased by their past.",
    placeholder: "Protagonist, foil, mentor…" },
  { field: "external_goal", title: "What they want",
    explainer: "The visible, external thing they are chasing. A camera could film it.",
    example: "e.g. Get her sister out of the country before Sunday.",
    placeholder: "The visible thing they are chasing…" },
  { field: "internal_need", title: "What they need",
    explainer: "The unspoken thing the story will force them to learn or accept. Often the opposite of what they want.",
    example: "e.g. To accept help without flinching.",
    placeholder: "The invisible thing they must learn…" },
  { field: "wound", title: "Core wound",
    explainer: "The old hurt that shaped who they are today. Concrete, not abstract.",
    example: "e.g. Their father chose the church over their mother's funeral.",
    placeholder: "The old hurt that shaped them…" },
  { field: "core_lie", title: "Core lie",
    explainer: "The false belief they carry because of the wound. The story will test this lie.",
    example: "e.g. If I stay in control, nobody else gets hurt.",
    placeholder: "The false belief they live by…" },
  { field: "secret", title: "Secret",
    explainer: "Something they keep hidden. Not just from us — from someone in the story.",
    example: "e.g. They were the one who let the door stay open.",
    placeholder: "What they never say aloud…" },
  { field: "voice_summary", title: "Voice",
    explainer: "How they sound on the page. Sentence length, humor, tells. One line.",
    example: "e.g. Dry, watchful, asks questions instead of answering.",
    placeholder: "How their dialogue sounds…" },
  { field: "visual_description", title: "Visual identity",
    explainer: "How they look and move. Aim for one image the reader can hold.",
    example: "e.g. Lean, watchful, muted neutrals — always one item that doesn't fit the room.",
    placeholder: "The image the reader keeps…" },
  { field: "character_arc", title: "Arc",
    explainer: "The one-sentence transformation. From X to Y.",
    example: "e.g. From self-reliance as armor → to chosen vulnerability as strength.",
    placeholder: "From __ to __" },
];

export function GuidedCharacterBuilder({
  characterId,
  projectId,
  character,
  onDone,
}: {
  characterId: string;
  projectId: string;
  character: any;
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const callUpsert = useServerFn(upsertCharacter);
  const callFull = useServerFn(generateFullCharacter);

  const [step, setStep] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const current = STEPS[step];
  const value = drafts[current.field] ?? (character?.[current.field] ?? "");
  const hasExisting = !!(character?.[current.field] && String(character[current.field]).trim());

  const progress = useMemo(() => {
    return STEPS.filter((s) => (character?.[s.field] && String(character[s.field]).trim())).length;
  }, [character]);

  const save = useMutation({
    mutationFn: async (patch: Record<string, any>) =>
      callUpsert({ data: { id: characterId, project_id: projectId, patch } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["character", characterId] });
      qc.invalidateQueries({ queryKey: ["characters", projectId] });
    },
  });

  const commitStep = async (nextIndex: number) => {
    const trimmed = (drafts[current.field] ?? "").trim();
    // Only persist when there's a new value AND (no existing OR user confirmed overwrite via typing).
    if (trimmed && trimmed !== (character?.[current.field] ?? "")) {
      await save.mutateAsync({ [current.field]: trimmed });
    }
    setStep(Math.max(0, Math.min(STEPS.length - 1, nextIndex)));
  };

  const skip = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const helpMeWrite = async () => {
    if (hasExisting) {
      toast.info("This field already has content. Clear it first if you want a fresh suggestion.");
      return;
    }
    setBusy(true);
    try {
      // Uses generateFullCharacter which returns a whole demo/AI patch.
      // We only accept the value for the current field and only if empty.
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

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-muted-foreground">
            Step {step + 1} of {STEPS.length} · {progress}/{STEPS.length} complete
          </div>
          <Button size="sm" variant="ghost" onClick={onDone} className="text-[11px]">Switch to Advanced Profile</Button>
        </div>
        <div className="flex gap-1">
          {STEPS.map((s, i) => {
            const filled = !!(character?.[s.field] && String(character[s.field]).trim());
            return (
              <button
                key={s.field}
                onClick={() => setStep(i)}
                className={[
                  "h-1.5 flex-1 rounded-full transition",
                  i === step ? "bg-primary" : filled ? "bg-primary/40" : "bg-border",
                ].join(" ")}
                aria-label={`Go to step ${i + 1}: ${s.title}`}
              />
            );
          })}
        </div>
      </div>

      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-xl">{current.title}</h3>
          {hasExisting && <Check className="h-4 w-4 text-primary" />}
        </div>
        <p className="text-sm text-muted-foreground">{current.explainer}</p>
        <p className="text-xs italic text-muted-foreground">{current.example}</p>

        <Textarea
          value={value}
          rows={4}
          placeholder={current.placeholder}
          onChange={(e) => setDrafts((d) => ({ ...d, [current.field]: e.target.value }))}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={helpMeWrite} disabled={busy || hasExisting}>
            {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
            Help me write this
          </Button>
          {hasExisting && (
            <span className="text-[10px] text-muted-foreground">
              Existing value protected — clear the field to request a new suggestion.
            </span>
          )}
          <div className="flex-1" />
          <Button size="sm" variant="ghost" onClick={skip}>Skip for now</Button>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={back} disabled={step === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" />Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => commitStep(step + 1)} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Save & Next<ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={async () => { await commitStep(step); onDone?.(); toast.success("Character saved"); }} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Finish
          </Button>
        )}
      </div>
    </div>
  );
}
