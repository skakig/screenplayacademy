/**
 * Character Truth Engine — pure TypeScript module.
 *
 * No React, no Supabase, no AI, no UI. Deterministic. Reusable by
 * Character Profile, Director's Chair, Dramatic Pulse and future coaches.
 *
 * The engine answers: would this character say/do this, hide this, betray
 * this person, sacrifice here, or regress under this pressure?
 *
 * It combines: character core + TMH moral behavior under pressure +
 * relationship pressure + scene context + arc position + voice/dialogue fit.
 *
 * Every rule that fires pushes an `evidence` entry so the app can show what
 * was actually used and never pretend to know things it does not.
 */

// ============================================================================
// Types
// ============================================================================

export type CharacterTruthVerdict =
  | "fits"
  | "strained"
  | "contradicts"
  | "insufficient_data";

export type EvidenceItem = {
  source: "character" | "tmh" | "relationship" | "scene" | "arc" | "script";
  field: string;
  value?: string | number | null;
};

export type MissingCharacterTruthInput = {
  field: string;
  prompt: string;
};

export type CharacterTruthResult = {
  verdict: CharacterTruthVerdict;
  confidence: "low" | "medium" | "high";
  reasons: string[];
  suggestedFixes: string[];
  missingInputs: MissingCharacterTruthInput[];
  evidence: EvidenceItem[];
};

/** Plain character shape — mirrors the `characters` table but every field is optional. */
export type CharacterLike = Record<string, unknown> & {
  id?: string;
  name?: string | null;
  external_goal?: string | null;
  internal_need?: string | null;
  wound?: string | null;
  fear?: string | null;
  core_lie?: string | null;
  secret?: string | null;
  contradiction?: string | null;
  voice_style?: string | null;
  voice_summary?: string | null;
  sentence_rhythm?: string | null;
  directness_level?: string | null;
  emotional_openness?: string | null;
  humor_style?: string | null;
  subtext_pattern?: string | null;
  silence_pattern?: string | null;
  tmh_baseline?: number | null;
  tmh_stress?: number | null;
  tmh_aspirational?: number | null;
  tmh_shadow?: number | null;
};

export type SceneStateLike = Record<string, unknown> & {
  character_id?: string;
  scene_id?: string;
  moral_pressure?: string | null;
  scene_goal?: string | null;
  scene_turn?: string | null;
  character_choice?: string | null;
  stakes_change?: string | null;
  tactic?: string | null;
  tmh_level?: number | null;
};

export type RelationshipLike = Record<string, unknown> & {
  character_id?: string;
  related_character_id?: string;
  related_name?: string | null;
  trust_level?: number | null;
  conflict_level?: number | null;
  private_truth?: string | null;
  relationship_type?: string | null;
};

export type CharacterArcLike = Record<string, unknown> & {
  starting_belief?: string | null;
  ending_belief?: string | null;
  arc_direction?: "ascent" | "descent" | "flat" | "regression" | string | null;
};

export type EvaluationContext = {
  sceneState?: SceneStateLike | null;
  relationships?: RelationshipLike[] | null;
  arc?: CharacterArcLike | null;
};

// ============================================================================
// Constants
// ============================================================================

const TMH_NAMES: Record<number, string> = {
  1: "Survival",
  2: "Self-Interest",
  3: "Social Contract",
  4: "Fairness / Justice",
  5: "Empathy",
  6: "Altruism",
  7: "Integrity",
  8: "Virtue",
  9: "Transcendence",
};

const BETRAYAL_KEYWORDS = ["betray", "sell out", "rat out", "turn in", "double-cross", "double cross"];
const VIOLENCE_KEYWORDS = ["kill", "murder", "attack", "beat", "strike", "shoot", "stab"];
const SACRIFICE_KEYWORDS = ["sacrifice", "give up", "risks his life", "risks her life", "risks their life", "dies for"];
const LIE_KEYWORDS = ["lie", "lies", "lied", "deceive", "cover up", "hide the truth"];

// ============================================================================
// Small helpers (not exported)
// ============================================================================

function nonEmpty(v: unknown): boolean {
  return v !== null && v !== undefined && String(v).trim().length > 0;
}

function containsAny(haystack: string, needles: string[]): string | null {
  const lower = haystack.toLowerCase();
  for (const n of needles) if (lower.includes(n)) return n;
  return null;
}

function scoreToConfidence(evidenceCount: number): "low" | "medium" | "high" {
  if (evidenceCount <= 2) return "low";
  if (evidenceCount <= 5) return "medium";
  return "high";
}

function tmhLabel(level?: number | null): string {
  if (!level || !TMH_NAMES[level]) return "—";
  return `L${level} ${TMH_NAMES[level]}`;
}

// ============================================================================
// summarizeMoralProfile
// ============================================================================

export function summarizeMoralProfile(character: CharacterLike) {
  const baseline = character.tmh_baseline ?? null;
  const stress = character.tmh_stress ?? null;
  const aspirational = character.tmh_aspirational ?? null;
  const shadow = character.tmh_shadow ?? null;
  const gap =
    baseline != null && stress != null ? Math.abs(baseline - stress) : null;
  let drift: "ascending" | "descending" | "regressing" | "flat" | "unknown" = "unknown";
  if (baseline != null && aspirational != null) {
    if (aspirational > baseline) drift = "ascending";
    else if (aspirational < baseline) drift = "descending";
    else drift = "flat";
  }
  if (gap != null && gap >= 3) drift = "regressing";
  return {
    baseline,
    stress,
    aspirational,
    shadow,
    gap,
    drift,
    label: baseline != null ? tmhLabel(baseline) : "—",
  };
}

// ============================================================================
// predictStressResponse
// ============================================================================

export function predictStressResponse(
  character: CharacterLike,
  sceneState?: SceneStateLike | null,
) {
  const baseline = character.tmh_baseline ?? null;
  const stress = character.tmh_stress ?? null;
  const pressure = nonEmpty(sceneState?.moral_pressure);
  if (baseline == null) {
    return {
      predictedLevel: null as number | null,
      rationale: "No TMH baseline recorded — cannot predict regression.",
      evidence: [] as EvidenceItem[],
    };
  }
  const evidence: EvidenceItem[] = [
    { source: "tmh", field: "tmh_baseline", value: baseline },
  ];
  if (stress != null) evidence.push({ source: "tmh", field: "tmh_stress", value: stress });
  if (pressure) {
    evidence.push({
      source: "scene",
      field: "moral_pressure",
      value: String(sceneState!.moral_pressure).slice(0, 80),
    });
  }
  const predicted = pressure && stress != null ? stress : baseline;
  const rationale = pressure && stress != null
    ? `Under active moral pressure, likely drops from ${tmhLabel(baseline)} toward ${tmhLabel(stress)}.`
    : `No active pressure in this scene — expect baseline ${tmhLabel(baseline)}.`;
  return { predictedLevel: predicted, rationale, evidence };
}

// ============================================================================
// findMissingCharacterTruthInputs
// ============================================================================

const MISSING_PROMPTS: Record<string, string> = {
  external_goal: "What does this character want in the outside world right now?",
  internal_need: "What do they need to learn or accept to become whole?",
  wound: "What past hurt makes this character overreact under pressure?",
  fear: "What are they most afraid other people will discover?",
  core_lie: "What lie do they tell themselves to keep going?",
  voice_style: "How do they speak when nothing is at stake?",
  tmh_baseline: "How do they behave morally when unpressured (TMH 1-9)?",
  tmh_stress: "How low do they fall when cornered (TMH 1-9)?",
  moral_pressure: "What in this scene forces a moral choice?",
  scene_goal: "What is the character trying to accomplish in this scene?",
  scene_turn: "How does the scene turn — what changes by the end?",
  private_truth: "What is the unspoken truth between these two characters?",
};

export function findMissingCharacterTruthInputs(
  character: CharacterLike,
  relationships?: RelationshipLike[] | null,
  sceneStates?: SceneStateLike[] | null,
): MissingCharacterTruthInput[] {
  const out: MissingCharacterTruthInput[] = [];
  const push = (field: string) => {
    const prompt = MISSING_PROMPTS[field] ?? `Missing: ${field}`;
    out.push({ field, prompt });
  };
  if (!nonEmpty(character.external_goal)) push("external_goal");
  if (!nonEmpty(character.internal_need)) push("internal_need");
  if (!nonEmpty(character.wound)) push("wound");
  if (!nonEmpty(character.fear)) push("fear");
  if (!nonEmpty(character.core_lie)) push("core_lie");
  if (!nonEmpty(character.voice_style) && !nonEmpty(character.voice_summary)) push("voice_style");
  if (character.tmh_baseline == null) push("tmh_baseline");
  if (character.tmh_stress == null) push("tmh_stress");
  if (relationships?.length) {
    const anyPrivate = relationships.some((r) => nonEmpty(r.private_truth));
    if (!anyPrivate) push("private_truth");
  }
  if (sceneStates?.length) {
    const anyPressure = sceneStates.some((s) => nonEmpty(s.moral_pressure));
    if (!anyPressure) push("moral_pressure");
  }
  return out;
}

// ============================================================================
// Shared verdict assembly
// ============================================================================

function buildResult(input: {
  fitScore: number;
  strainScore: number;
  contradictScore: number;
  reasons: string[];
  suggestedFixes: string[];
  missingInputs: MissingCharacterTruthInput[];
  evidence: EvidenceItem[];
  insufficient?: boolean;
}): CharacterTruthResult {
  const { reasons, suggestedFixes, missingInputs, evidence, insufficient } = input;
  if (insufficient) {
    return {
      verdict: "insufficient_data",
      confidence: "low",
      reasons,
      suggestedFixes,
      missingInputs,
      evidence,
    };
  }
  const { fitScore, strainScore, contradictScore } = input;
  let verdict: CharacterTruthVerdict = "fits";
  if (contradictScore >= 2 && contradictScore > strainScore) verdict = "contradicts";
  else if (strainScore >= 1 || contradictScore >= 1) verdict = "strained";
  else if (fitScore >= 1) verdict = "fits";
  // Confidence is capped by evidence count.
  const confidence = scoreToConfidence(evidence.length);
  return { verdict, confidence, reasons, suggestedFixes, missingInputs, evidence };
}

// ============================================================================
// evaluateActionFit
// ============================================================================

export function evaluateActionFit(
  character: CharacterLike,
  actionText: string,
  ctx: EvaluationContext = {},
): CharacterTruthResult {
  const reasons: string[] = [];
  const suggestedFixes: string[] = [];
  const evidence: EvidenceItem[] = [];
  let fitScore = 0;
  let strainScore = 0;
  let contradictScore = 0;

  const missing = findMissingCharacterTruthInputs(character, ctx.relationships, ctx.sceneState ? [ctx.sceneState] : null);
  const coreMissing = !nonEmpty(character.external_goal) && !nonEmpty(character.internal_need) && !nonEmpty(character.wound);
  if (coreMissing) {
    return buildResult({
      fitScore: 0,
      strainScore: 0,
      contradictScore: 0,
      reasons: ["Not enough character truth recorded to evaluate this action."],
      suggestedFixes: ["Fill in the character's want, need, and wound first."],
      missingInputs: missing,
      evidence,
      insufficient: true,
    });
  }

  const text = actionText.trim();
  if (!text) {
    return buildResult({
      fitScore: 0,
      strainScore: 0,
      contradictScore: 0,
      reasons: ["No action text provided."],
      suggestedFixes: [],
      missingInputs: missing,
      evidence,
      insufficient: true,
    });
  }

  const betrayal = containsAny(text, BETRAYAL_KEYWORDS);
  const violence = containsAny(text, VIOLENCE_KEYWORDS);
  const sacrifice = containsAny(text, SACRIFICE_KEYWORDS);
  const lying = containsAny(text, LIE_KEYWORDS);

  const baseline = character.tmh_baseline ?? null;
  const stress = character.tmh_stress ?? null;
  const aspirational = character.tmh_aspirational ?? null;

  // Character-level evidence.
  if (nonEmpty(character.external_goal)) evidence.push({ source: "character", field: "external_goal", value: String(character.external_goal) });
  if (nonEmpty(character.internal_need)) evidence.push({ source: "character", field: "internal_need", value: String(character.internal_need) });
  if (nonEmpty(character.wound)) evidence.push({ source: "character", field: "wound", value: String(character.wound) });
  if (nonEmpty(character.fear)) evidence.push({ source: "character", field: "fear" });
  if (nonEmpty(character.core_lie)) evidence.push({ source: "character", field: "core_lie" });
  if (baseline != null) evidence.push({ source: "tmh", field: "tmh_baseline", value: baseline });
  if (stress != null) evidence.push({ source: "tmh", field: "tmh_stress", value: stress });
  if (aspirational != null) evidence.push({ source: "tmh", field: "tmh_aspirational", value: aspirational });

  // Scene pressure.
  const pressureText = nonEmpty(ctx.sceneState?.moral_pressure) ? String(ctx.sceneState!.moral_pressure) : "";
  if (pressureText) evidence.push({ source: "scene", field: "moral_pressure", value: pressureText.slice(0, 80) });

  // Wound-based sensitivity — betrayal wound + betrayal action = high pressure.
  const woundText = String(character.wound ?? "").toLowerCase();
  if (betrayal && woundText.includes("betray")) {
    reasons.push("This action touches an old betrayal wound — expect volatile behavior.");
    strainScore += 1;
    fitScore += 0; // pressure only, not fit
  }

  // TMH regression logic.
  if (betrayal || violence || lying) {
    if (baseline != null && baseline >= 6 && stress != null && stress <= 3 && pressureText) {
      reasons.push(
        `Under active pressure, ${tmhLabel(baseline)} character can regress toward ${tmhLabel(stress)} — this action fits the stress profile, not the baseline.`,
      );
      strainScore += 1;
    } else if (baseline != null && baseline >= 6 && !pressureText) {
      reasons.push(
        `At baseline ${tmhLabel(baseline)}, this behavior contradicts the character's ordinary moral floor.`,
      );
      contradictScore += 1;
      suggestedFixes.push("If they must do this, show what forces them here.");
    } else if (baseline != null && baseline <= 3) {
      reasons.push(`Baseline ${tmhLabel(baseline)} makes this action plausible.`);
      fitScore += 1;
    }

    // Aspirational conflict.
    if (aspirational != null && aspirational >= 7) {
      reasons.push(`This works against their aspirational arc toward ${tmhLabel(aspirational)}.`);
      if (contradictScore === 0) strainScore += 1;
      suggestedFixes.push("Frame the choice as protection, duty, or necessity — not cruelty — so the arc can still be earned.");
    }
  }

  if (sacrifice) {
    if (aspirational != null && aspirational >= 6) {
      reasons.push("A sacrificial move fits the aspirational arc.");
      fitScore += 1;
    } else if (baseline != null && baseline <= 2) {
      reasons.push("Sacrifice contradicts a survival-first baseline unless pressure explains it.");
      contradictScore += 1;
      suggestedFixes.push("Show why survival is worth risking here.");
    }
  }

  // Relationship pressure.
  if (ctx.relationships?.length) {
    for (const r of ctx.relationships) {
      if (r.trust_level != null || r.conflict_level != null) {
        evidence.push({
          source: "relationship",
          field: "trust_conflict",
          value: `trust=${r.trust_level ?? "?"} conflict=${r.conflict_level ?? "?"}`,
        });
      }
      if ((r.conflict_level ?? 0) >= 3 && (r.trust_level ?? 0) >= 3) {
        reasons.push(`High-trust, high-conflict relationship with ${r.related_name ?? "another character"} intensifies this moment.`);
        strainScore += 1;
      }
      if (nonEmpty(r.private_truth)) {
        evidence.push({ source: "relationship", field: "private_truth" });
      }
    }
  }

  // Arc position.
  if (ctx.arc?.arc_direction) {
    evidence.push({ source: "arc", field: "arc_direction", value: String(ctx.arc.arc_direction) });
    if (ctx.arc.arc_direction === "ascent" && (betrayal || lying)) {
      reasons.push("Occurs during an ascending arc — a fall here should carry consequence.");
      strainScore += 1;
    }
  }

  // No keyword hit + no pressure + nothing about the action stands out → default fit.
  if (!betrayal && !violence && !sacrifice && !lying) {
    reasons.push("Nothing in the action contradicts the character's core.");
    fitScore += 1;
  }

  return buildResult({
    fitScore,
    strainScore,
    contradictScore,
    reasons,
    suggestedFixes,
    missingInputs: missing,
    evidence,
  });
}

// ============================================================================
// evaluateDialogueFit
// ============================================================================

const VOICE_FIELDS: Array<keyof CharacterLike> = [
  "voice_style",
  "voice_summary",
  "sentence_rhythm",
  "directness_level",
  "emotional_openness",
  "humor_style",
  "subtext_pattern",
  "silence_pattern",
];

export function evaluateDialogueFit(
  character: CharacterLike,
  dialogueText: string,
  ctx: EvaluationContext = {},
): CharacterTruthResult {
  const reasons: string[] = [];
  const suggestedFixes: string[] = [];
  const evidence: EvidenceItem[] = [];
  let fitScore = 0;
  let strainScore = 0;
  const contradictScore = 0; // dialogue is never "contradicts" alone — it's strained.

  const voicePresent = VOICE_FIELDS.some((f) => nonEmpty(character[f]));
  const missing = findMissingCharacterTruthInputs(character, ctx.relationships, ctx.sceneState ? [ctx.sceneState] : null);

  if (!voicePresent) {
    return buildResult({
      fitScore: 0,
      strainScore: 0,
      contradictScore: 0,
      reasons: ["No voice fingerprint recorded for this character yet."],
      suggestedFixes: ["Fill in voice style or sentence rhythm to enable dialogue fit checks."],
      missingInputs: missing,
      evidence,
      insufficient: true,
    });
  }

  const text = dialogueText.trim();
  if (!text) {
    return buildResult({
      fitScore: 0,
      strainScore: 0,
      contradictScore: 0,
      reasons: ["No dialogue provided."],
      suggestedFixes: [],
      missingInputs: missing,
      evidence,
      insufficient: true,
    });
  }

  for (const f of VOICE_FIELDS) {
    if (nonEmpty(character[f])) evidence.push({ source: "character", field: String(f) });
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const avgWordLen = text.replace(/[^a-zA-Z]/g, "").length / Math.max(1, wordCount);
  const exclaims = (text.match(/[!?]/g) ?? []).length;
  const style = String(character.voice_style ?? "").toLowerCase();
  const rhythm = String(character.sentence_rhythm ?? "").toLowerCase();

  const wantsClipped = /clipped|dry|spare|short|terse|minimal/.test(style + " " + rhythm);
  const isFlorid = wordCount > 25 || avgWordLen > 5.5 || exclaims >= 2;

  if (wantsClipped && isFlorid) {
    reasons.push("Voice profile calls for clipped, spare lines — this reads florid.");
    suggestedFixes.push("Try one short sentence; let silence do the second beat.");
    strainScore += 1;
  }

  const openness = String(character.emotional_openness ?? "").toLowerCase();
  if (/closed|guarded|reserved/.test(openness) && /i love|i feel|i need you|i'?m scared/i.test(text)) {
    reasons.push("Line is emotionally open but the character defaults to guarded.");
    suggestedFixes.push("Under pressure this could work — show what breaks the guard.");
    strainScore += 1;
  }

  const directness = String(character.directness_level ?? "").toLowerCase();
  if (/indirect|low|evasive/.test(directness) && /\?/.test(text) === false && wordCount <= 12 && !isFlorid) {
    fitScore += 1;
  }

  if (fitScore === 0 && strainScore === 0) {
    reasons.push("Line broadly fits the recorded voice fingerprint.");
    fitScore += 1;
  }

  return buildResult({
    fitScore,
    strainScore,
    contradictScore,
    reasons,
    suggestedFixes,
    missingInputs: missing,
    evidence,
  });
}

// ============================================================================
// evaluateScenePressure
// ============================================================================

export function evaluateScenePressure(
  character: CharacterLike,
  sceneState: SceneStateLike,
  _relCtx?: RelationshipLike[] | null,
): CharacterTruthResult {
  const reasons: string[] = [];
  const suggestedFixes: string[] = [];
  const evidence: EvidenceItem[] = [];
  let fitScore = 0;
  let strainScore = 0;
  const contradictScore = 0;

  const hasPressure = nonEmpty(sceneState.moral_pressure);
  const hasChoice = nonEmpty(sceneState.character_choice);
  const hasTurn = nonEmpty(sceneState.scene_turn);
  const hasStakes = nonEmpty(sceneState.stakes_change);
  const hasGoal = nonEmpty(sceneState.scene_goal);

  if (hasPressure) evidence.push({ source: "scene", field: "moral_pressure" });
  if (hasChoice) evidence.push({ source: "scene", field: "character_choice" });
  if (hasTurn) evidence.push({ source: "scene", field: "scene_turn" });
  if (hasStakes) evidence.push({ source: "scene", field: "stakes_change" });
  if (hasGoal) evidence.push({ source: "scene", field: "scene_goal" });

  const missing: MissingCharacterTruthInput[] = [];
  if (!hasGoal) missing.push({ field: "scene_goal", prompt: MISSING_PROMPTS.scene_goal });
  if (!hasPressure) missing.push({ field: "moral_pressure", prompt: MISSING_PROMPTS.moral_pressure });
  if (!hasTurn) missing.push({ field: "scene_turn", prompt: MISSING_PROMPTS.scene_turn });

  if (!hasGoal && !hasPressure) {
    return buildResult({
      fitScore: 0,
      strainScore: 0,
      contradictScore: 0,
      reasons: ["Scene has no recorded goal or moral pressure."],
      suggestedFixes: ["Note what the character wants and what forces the moral choice."],
      missingInputs: missing,
      evidence,
      insufficient: true,
    });
  }

  if (hasPressure && !hasChoice && !hasTurn) {
    reasons.push("Moral pressure is present but no character choice or scene turn is recorded — pressure without decision.");
    suggestedFixes.push("Give the character a concrete choice this scene forces them to make.");
    strainScore += 1;
  }

  if (hasStakes) {
    reasons.push("Stakes change — the scene moves the story.");
    fitScore += 1;
  }

  if (character.tmh_baseline != null && hasPressure) {
    evidence.push({ source: "tmh", field: "tmh_baseline", value: character.tmh_baseline });
  }

  return buildResult({
    fitScore,
    strainScore,
    contradictScore,
    reasons,
    suggestedFixes,
    missingInputs: missing,
    evidence,
  });
}

// ============================================================================
// detectCharacterContradictions
// ============================================================================

export function detectCharacterContradictions(
  character: CharacterLike,
  arc?: CharacterArcLike | null,
  relationships?: RelationshipLike[] | null,
): CharacterTruthResult {
  const reasons: string[] = [];
  const suggestedFixes: string[] = [];
  const evidence: EvidenceItem[] = [];
  let contradictScore = 0;
  let strainScore = 0;

  const baseline = character.tmh_baseline ?? null;
  const aspirational = character.tmh_aspirational ?? null;
  if (baseline != null && aspirational != null) {
    evidence.push({ source: "tmh", field: "tmh_baseline", value: baseline });
    evidence.push({ source: "tmh", field: "tmh_aspirational", value: aspirational });
    if (aspirational < baseline) {
      reasons.push("Aspirational moral level is below the baseline — arc is written as a fall.");
      strainScore += 1;
    }
  }
  if (arc?.arc_direction === "ascent" && baseline != null && aspirational != null && aspirational <= baseline) {
    reasons.push("Arc direction is 'ascent' but aspirational TMH does not exceed baseline.");
    contradictScore += 1;
    suggestedFixes.push("Either raise the aspirational level, or reframe the arc as a stability/regression arc.");
  }
  if (relationships?.length) {
    for (const r of relationships) {
      if ((r.trust_level ?? 0) >= 4 && (r.conflict_level ?? 0) >= 4) {
        reasons.push(`High trust and high conflict with ${r.related_name ?? "another character"} — rich but combustible.`);
        strainScore += 1;
        evidence.push({ source: "relationship", field: "trust_conflict" });
      }
    }
  }

  const missing = findMissingCharacterTruthInputs(character, relationships);
  if (evidence.length === 0) {
    return buildResult({
      fitScore: 0,
      strainScore: 0,
      contradictScore: 0,
      reasons: ["Not enough moral or relationship data to detect contradictions."],
      suggestedFixes: [],
      missingInputs: missing,
      evidence,
      insufficient: true,
    });
  }

  return buildResult({
    fitScore: 0,
    strainScore,
    contradictScore,
    reasons,
    suggestedFixes,
    missingInputs: missing,
    evidence,
  });
}

// ============================================================================
// summarizeMoralTrajectory
// ============================================================================

export type MoralTrajectory =
  | "ascent"
  | "descent"
  | "regression"
  | "flat"
  | "unearned"
  | "unknown";

export function summarizeMoralTrajectory(
  characterArc?: CharacterArcLike | null,
  sceneStates?: SceneStateLike[] | null,
): { trajectory: MoralTrajectory; warning?: string; evidence: EvidenceItem[] } {
  const evidence: EvidenceItem[] = [];
  const levels = (sceneStates ?? [])
    .map((s) => (typeof s.tmh_level === "number" ? s.tmh_level : null))
    .filter((n): n is number => n != null);
  if (levels.length >= 4) {
    evidence.push({ source: "scene", field: "tmh_level_series", value: levels.join(",") });
    const first = levels[0];
    const last = levels[levels.length - 1];
    const spread = Math.max(...levels) - Math.min(...levels);
    if (spread <= 1) {
      return { trajectory: "flat", warning: "TMH is essentially flat across scenes — the character is not being tested.", evidence };
    }
    if (last > first + 2 && spread >= 3) {
      return { trajectory: "ascent", evidence };
    }
    if (last < first - 2 && spread >= 3) {
      return { trajectory: "descent", evidence };
    }
    if (Math.abs(last - first) <= 1 && spread >= 3) {
      return { trajectory: "regression", warning: "Character keeps dipping under pressure but ends where they started.", evidence };
    }
  }
  if (characterArc?.arc_direction) {
    evidence.push({ source: "arc", field: "arc_direction", value: String(characterArc.arc_direction) });
    const d = characterArc.arc_direction;
    if (d === "ascent" || d === "descent" || d === "flat" || d === "regression") {
      return { trajectory: d, evidence };
    }
  }
  return { trajectory: "unknown", evidence };
}
