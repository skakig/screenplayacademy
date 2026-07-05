/**
 * Truth Coach — pure TypeScript coaching adapter.
 *
 * Translates a CharacterTruthResult (from characterTruthEngine) into
 * writer-facing guidance shaped by the writer's onboarding profile:
 * mode (basic/advanced), coaching level, and experience.
 *
 * No React, no Supabase, no AI, no UI imports. Deterministic. Never
 * mutates the input result.
 *
 * The engine answers: "Would this character say or do this?"
 * The coach answers:  "What should the writer understand or do next?"
 */

import type {
  CharacterTruthResult,
  MissingCharacterTruthInput,
} from "./characterTruthEngine";
import {
  resolveWriterGuidance,
  type WriterCoachingLevel,
} from "./writerProfileSignals";

// ============================================================================
// Types
// ============================================================================

export type WriterMode = "basic" | "advanced";

export type CoachingLevel = WriterCoachingLevel;

export type WriterProfileForCoach = {
  mode: WriterMode;
  coachingLevel?: CoachingLevel | null;
  writerExperienceLevel?: string | null;
};

export type TruthCoachOutput = {
  headline: string;
  explanation: string;
  nextStep?: string;
  teachingPrompt?: string;
  concept?: string;
  showEvidence: boolean;
  showSuggestedFixes: boolean;
  maxReasons: number;
  maxMissingInputs: number;
  tone: "quiet" | "gentle" | "teaching" | "diagnostic";
};

// ============================================================================
// Priority ordering for the single most useful missing input
// ============================================================================

const PRIMARY_MISSING_PRIORITY = [
  "wound",
  "external_goal",
  "internal_need",
  "fear",
  "core_lie",
  "moral_pressure",
  "scene_goal",
  "scene_turn",
  "tmh_baseline",
  "tmh_stress",
  "voice_style",
  "private_truth",
];

export function selectPrimaryMissingInput(
  result: CharacterTruthResult,
): MissingCharacterTruthInput | undefined {
  if (!result.missingInputs || result.missingInputs.length === 0) return undefined;
  for (const field of PRIMARY_MISSING_PRIORITY) {
    const hit = result.missingInputs.find((m) => m.field === field);
    if (hit) return hit;
  }
  return result.missingInputs[0];
}

// ============================================================================
// Verdict → headline (mode-aware)
// ============================================================================

const HEADLINES_BASIC: Record<CharacterTruthResult["verdict"], string> = {
  fits: "This rings true.",
  strained: "This feels off under pressure.",
  contradicts: "This contradicts who they are.",
  insufficient_data: "Not enough character truth yet.",
};

const HEADLINES_ADVANCED: Record<CharacterTruthResult["verdict"], string> = {
  fits: "Fits the character as written.",
  strained: "Fits under pressure, strains without it.",
  contradicts: "Contradicts the character's core.",
  insufficient_data: "Insufficient character data to evaluate.",
};

export function explainVerdictForWriter(
  result: CharacterTruthResult,
  profile: WriterProfileForCoach,
): { headline: string; explanation: string } {
  const isBasic = profile.mode === "basic";
  const headline = isBasic
    ? HEADLINES_BASIC[result.verdict]
    : HEADLINES_ADVANCED[result.verdict];

  const uncertainty =
    result.confidence === "low"
      ? isBasic
        ? "This is a first-pass check based on what you've told me so far."
        : "Low-confidence, first-pass reading based on the data currently on the character."
      : "";

  let body = "";
  const evidenceFields = new Set(result.evidence.map((e) => e.field));
  const hasTmhEvidence =
    evidenceFields.has("tmh_baseline") || evidenceFields.has("tmh_stress");
  const hasPressure = evidenceFields.has("moral_pressure");
  const hasVoice =
    evidenceFields.has("voice_style") || evidenceFields.has("sentence_rhythm");

  if (result.verdict === "insufficient_data") {
    body = isBasic
      ? "I need a little more about who this character is before I can tell you if this rings true."
      : "The character record is missing the core inputs needed to evaluate behavioral fit.";
  } else if (result.verdict === "fits") {
    body = isBasic
      ? "This lines up with what you've told me about them."
      : "The action aligns with the character's want, need, and behavioral baseline.";
  } else if (result.verdict === "strained") {
    if (isBasic) {
      body = hasPressure
        ? "It works if the pressure in this scene is strong enough. Without that pressure, it feels forced."
        : "It could work, but there isn't enough pressure in the scene yet to justify it.";
    } else {
      body = hasTmhEvidence && hasPressure
        ? "The action reads as a stress-driven regression from the character's moral baseline. Justifiable if the pressure is on the page; otherwise the beat softens."
        : "The action strains the character's baseline. Either raise the visible pressure or reshape the beat.";
    }
  } else if (result.verdict === "contradicts") {
    body = isBasic
      ? "This isn't something they'd do given who they are on the page right now."
      : hasVoice
        ? "The beat contradicts the character's stated voice and behavioral pattern."
        : "The beat contradicts the character's want, need, or moral baseline.";
  }

  const explanation = [body, uncertainty].filter(Boolean).join(" ");
  return { headline, explanation };
}

// ============================================================================
// Verdict → next writer action
// ============================================================================

export function getNextWriterAction(
  result: CharacterTruthResult,
  profile: WriterProfileForCoach,
): string | undefined {
  const isBasic = profile.mode === "basic";
  switch (result.verdict) {
    case "fits":
      if (result.confidence === "high") return "Keep writing — this rings true.";
      return "Trust it, but watch how the next beat lands.";
    case "strained":
      return isBasic
        ? "Make the pressure visible on the page."
        : "Show the pressure that justifies this behavior, or soften the beat.";
    case "contradicts":
      return "Either raise the pressure until this fits, or pick a different action.";
    case "insufficient_data":
      return "Answer the question above, then run Truth Check again.";
  }
}

// ============================================================================
// Main entry point
// ============================================================================

export function createTruthCoachOutput(
  result: CharacterTruthResult,
  profile: WriterProfileForCoach,
): TruthCoachOutput {
  const coachingLevel: CoachingLevel = profile.coachingLevel ?? "gentle";
  const isBasic = profile.mode === "basic";

  // Coaching off — quiet output, verdict-only.
  if (coachingLevel === "off") {
    return {
      headline: HEADLINES_BASIC[result.verdict],
      explanation: "",
      showEvidence: false,
      showSuggestedFixes: false,
      maxReasons: 0,
      tone: "quiet",
    };
  }

  const { headline, explanation } = explainVerdictForWriter(result, profile);
  const nextStep = getNextWriterAction(result, profile);
  const primaryMissing = selectPrimaryMissingInput(result);

  // Teaching prompt: one question, only when it will help right now.
  let teachingPrompt: string | undefined;
  if (isBasic) {
    if (result.verdict === "insufficient_data" && primaryMissing) {
      teachingPrompt = primaryMissing.prompt;
    } else if (result.confidence === "low" && primaryMissing) {
      teachingPrompt = primaryMissing.prompt;
    }
  }

  const concept =
    primaryMissing?.field === "wound"
      ? "Character wound"
      : primaryMissing?.field === "moral_pressure"
        ? "Scene pressure"
        : primaryMissing?.field === "external_goal"
          ? "Want"
          : primaryMissing?.field === "internal_need"
            ? "Need"
            : undefined;

  return {
    headline,
    explanation,
    nextStep,
    teachingPrompt,
    concept,
    showEvidence: !isBasic,
    showSuggestedFixes: !isBasic,
    maxReasons: isBasic ? 1 : result.reasons.length,
    tone: isBasic ? "teaching" : "diagnostic",
  };
}
