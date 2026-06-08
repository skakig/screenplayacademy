import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

type Term = {
  title: string;
  explanation: string;
  example: string;
};

const TERMS: Record<string, Term> = {
  logline: {
    title: "Logline",
    explanation: "A one-sentence summary naming protagonist, goal, obstacle, stakes, and hook.",
    example: '"When a disgraced detective discovers a murder tied to his own buried lie…"',
  },
  theme: {
    title: "Theme",
    explanation: "The moral argument your story makes about human nature — not the topic.",
    example: '"Love costs more than it heals." (not just "love")',
  },
  want: {
    title: "Want (external goal)",
    explanation: "What the protagonist consciously pursues. Visible, concrete, measurable.",
    example: "Win the case. Survive the night. Get the girl.",
  },
  need: {
    title: "Need (internal)",
    explanation: "What the protagonist actually needs to grow. Usually opposite of the want.",
    example: "She wants the promotion; she needs to forgive her father.",
  },
  wound: {
    title: "Core wound",
    explanation: "The unresolved past event that shaped the character's lie.",
    example: "Childhood abandonment that taught him love is unsafe.",
  },
  lie: {
    title: "Core lie",
    explanation: "The false belief the character protects to avoid the wound's pain.",
    example: '"If I never need anyone, no one can leave me."',
  },
  scene_purpose: {
    title: "Scene purpose",
    explanation: "What this scene must accomplish for plot, character, or theme. Without one, the scene is filler.",
    example: "This scene forces the protagonist to choose between truth and safety.",
  },
  scene_turn: {
    title: "Scene turn",
    explanation: "The moment the scene's value flips — from hope to despair, trust to betrayal, etc.",
    example: "She walks in believing he's innocent; she walks out knowing he lied.",
  },
  stakes: {
    title: "Stakes",
    explanation: "What's lost if the protagonist fails. The bigger and more personal, the better.",
    example: "If he doesn't confess by sunrise, his daughter goes to prison.",
  },
  midpoint: {
    title: "Midpoint",
    explanation: "The story's pivot — new information forces the protagonist to recommit at a higher cost.",
    example: "She learns the killer is her brother. Now she can't walk away.",
  },
  climax_choice: {
    title: "Climax choice",
    explanation: "The final moral decision that proves whether the character has changed.",
    example: "He destroys the evidence — or lets it convict the woman he loves.",
  },
  character_arc: {
    title: "Character arc",
    explanation: "The shape of how the character's belief shifts from start to end.",
    example: "From 'I work alone' to 'I will die for these people.'",
  },
  tmh_baseline: {
    title: "TMH baseline",
    explanation: "Where this character sits morally at rest, 1 (corrupt) to 9 (saintly).",
    example: "A weary cop with a 5 baseline — neither hero nor villain.",
  },
  tmh_stress: {
    title: "TMH under stress",
    explanation: "Where the character regresses morally when pressured. Reveals their shadow.",
    example: "Baseline 5, regresses to 2 when his daughter is threatened.",
  },
  voice: {
    title: "Dialogue voice",
    explanation: "The recognisable cadence, vocabulary, and rhythm that makes this character sound like only them.",
    example: "Cormac McCarthy's Anton Chigurh: clipped, formal, indifferent.",
  },
  subtext: {
    title: "Subtext",
    explanation: "What characters mean but don't say. Reveal character through indirection.",
    example: '"It\'s late." (meaning: "I want you to leave.")',
  },
  treatment: {
    title: "Treatment",
    explanation: "A prose summary of the screenplay's beats — typically 3–15 pages.",
    example: "Used to sell or develop the project before drafting full pages.",
  },
  pitch: {
    title: "Pitch package",
    explanation: "Logline, synopsis, treatment, character bible, comparables, tone — everything needed to sell.",
    example: "What a buyer reads before they ever open your script.",
  },
};

export function WhyThisMatters({ term, className }: { term: string; className?: string }) {
  const t = TERMS[term];
  if (!t) return null;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className={`inline-flex items-center text-muted-foreground/70 hover:text-primary transition ${className ?? ""}`} aria-label={`Why ${t.title} matters`}>
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="font-semibold text-xs mb-1">{t.title}</div>
          <div className="text-xs text-muted-foreground mb-1.5">{t.explanation}</div>
          <div className="text-[11px] italic text-foreground/70">{t.example}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
