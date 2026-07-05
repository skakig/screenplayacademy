/**
 * Writer Profile Signals — pure TypeScript.
 *
 * Resolves the writer's onboarding profile (mode, coachingLevel, experience)
 * into a `ResolvedWriterGuidance` object that tells downstream adapters
 * (like truthCoach) how much depth, jargon, and evidence to surface.
 *
 * No React, no Supabase, no AI, no UI imports. Deterministic. Never mutates
 * the input profile.
 */

export type WriterGuidanceDepth =
  | "minimal"
  | "gentle"
  | "guided"
  | "teaching"
  | "diagnostic";

export type WriterCoachingLevel = "off" | "gentle" | "active" | "teaching";

export type WriterProfileSignals = {
  mode: "basic" | "advanced";
  coachingLevel?: WriterCoachingLevel | null;
  writerExperienceLevel?: string | null;
};

export type ResolvedWriterGuidance = {
  depth: WriterGuidanceDepth;
  maxReasons: number;
  maxMissingInputs: number;
  showEvidence: boolean;
  showSuggestedFixes: boolean;
  preferPlainLanguage: boolean;
  includeConceptLabel: boolean;
  includeNextStep: boolean;
  tone: "quiet" | "gentle" | "teaching" | "diagnostic";
};

const BEGINNER_TOKENS = [
  // SceneSmith native onboarding values
  "first",
  "guided",
  "adapting",
  // Legacy / defensive tokens
  "beginner",
  "new",
  "new_writer",
  "newwriter",
  "first_time",
  "firsttime",
  "first-time",
  "student",
  "novice",
  "learning",
  "hobbyist",
];

const ADVANCED_TOKENS = [
  // SceneSmith native onboarding values
  "experienced",
  "pitching",
  // Legacy / defensive tokens
  "advanced",
  "professional",
  "pro",
  "expert",
  "working_writer",
  "workingwriter",
  "produced",
];

function normalize(level?: string | null): string | null {
  if (!level || typeof level !== "string") return null;
  const trimmed = level.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export function isBeginnerExperience(level?: string | null): boolean {
  const n = normalize(level);
  if (!n) return false;
  return BEGINNER_TOKENS.some((t) => n === t || n.includes(t));
}

export function isAdvancedExperience(level?: string | null): boolean {
  const n = normalize(level);
  if (!n) return false;
  return ADVANCED_TOKENS.some((t) => n === t || n.includes(t));
}

export function resolveWriterGuidance(
  profile: WriterProfileSignals,
): ResolvedWriterGuidance {
  // Coaching off — quiet everything.
  if (profile.coachingLevel === "off") {
    return {
      depth: "minimal",
      maxReasons: 0,
      maxMissingInputs: 0,
      showEvidence: false,
      showSuggestedFixes: false,
      preferPlainLanguage: true,
      includeConceptLabel: false,
      includeNextStep: false,
      tone: "quiet",
    };
  }

  if (profile.mode === "basic") {
    const beginner = isBeginnerExperience(profile.writerExperienceLevel);
    return {
      depth: beginner ? "teaching" : "guided",
      maxReasons: 1,
      maxMissingInputs: 1,
      showEvidence: false,
      showSuggestedFixes: false,
      preferPlainLanguage: true,
      includeConceptLabel: beginner,
      includeNextStep: true,
      tone: "teaching",
    };
  }

  // mode === "advanced"
  const level: WriterCoachingLevel = profile.coachingLevel ?? "gentle";

  if (level === "active") {
    return {
      depth: "diagnostic",
      maxReasons: 4,
      maxMissingInputs: 5,
      showEvidence: true,
      showSuggestedFixes: true,
      preferPlainLanguage: false,
      includeConceptLabel: false,
      includeNextStep: true,
      tone: "diagnostic",
    };
  }

  if (level === "teaching") {
    return {
      depth: "teaching",
      maxReasons: 4,
      maxMissingInputs: 5,
      showEvidence: true,
      showSuggestedFixes: true,
      preferPlainLanguage: false,
      includeConceptLabel: true,
      includeNextStep: true,
      tone: "teaching",
    };
  }

  // Default advanced: gentle (also fallback for unknown values).
  return {
    depth: "gentle",
    maxReasons: 2,
    maxMissingInputs: 3,
    showEvidence: false,
    showSuggestedFixes: true,
    preferPlainLanguage: false,
    includeConceptLabel: false,
    includeNextStep: true,
    tone: "gentle",
  };
}
