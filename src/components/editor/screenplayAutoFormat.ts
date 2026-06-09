// Pure screenplay text normalization. No React, no DOM, no network.
// Rules implement docs/SCREENPLAY_AUTO_FORMATTING.md. Apply only at safe
// moments (Enter, blur, explicit type change) — never per keystroke.

export type FormatConfidence = "high" | "medium" | "low";

export type FormatDecision = {
  blockType: string;
  formattedText: string;
  confidence: FormatConfidence;
  reason: string;
  shouldApplyAutomatically: boolean;
};

const TIME_TOKENS = [
  "MOMENTS LATER",
  "SAME TIME",
  "SUNRISE",
  "SUNSET",
  "MORNING",
  "AFTERNOON",
  "EVENING",
  "CONTINUOUS",
  "LATER",
  "NIGHT",
  "DAWN",
  "DUSK",
  "DAY",
];

const TRANSITION_VERBS =
  /^(CUT TO|FADE IN|FADE OUT|FADE TO BLACK|SMASH CUT(?: TO)?|MATCH CUT(?: TO)?|JUMP CUT(?: TO)?|DISSOLVE TO|HARD CUT TO|TIME CUT)\b/;

function collapseSpaces(s: string): string {
  return s.replace(/[ \t]+/g, " ").trim();
}

/** Format a Scene Heading line. Idempotent. */
export function formatSceneHeading(text: string): string {
  let t = collapseSpaces(text);
  if (!t) return text;

  // Normalize INT/EXT prefix (case-insensitive, with or without trailing dot).
  t = t.replace(
    /^(int\.?\/ext\.?|i\/e\.?|int\.?|ext\.?|est\.?)\b\.?\s*/i,
    (m) => {
      const k = m.trim().toLowerCase().replace(/\s+/g, "");
      if (k.startsWith("int/ext") || k.startsWith("int./ext") || k === "i/e" || k === "i/e.") return "INT./EXT. ";
      if (k.startsWith("int")) return "INT. ";
      if (k.startsWith("ext")) return "EXT. ";
      if (k.startsWith("est")) return "EST. ";
      return m;
    },
  );

  // Uppercase the whole line.
  t = t.toUpperCase();

  // If a recognized time token is present without a preceding " - ", insert one.
  // Preserve existing dashes — only add a separator if missing.
  for (const tok of TIME_TOKENS) {
    const re = new RegExp(`(?<![\\-A-Z])\\b${tok.replace(/ /g, "\\s+")}\\s*$`);
    if (re.test(t)) {
      // ensure " - " before the token
      t = t.replace(re, (m) => {
        const idx = t.toUpperCase().lastIndexOf(m);
        const prefix = t.slice(0, idx).replace(/\s+$/, "");
        if (prefix.endsWith("-") || prefix.endsWith("- ")) return m.trim();
        return " - " + m.trim();
      });
      // rebuild
      t = collapseSpaces(t);
      break;
    }
  }

  // Collapse stray double spaces around dashes.
  t = t.replace(/\s*-\s*/g, " - ");
  return collapseSpaces(t);
}

/** Format a Character cue. Uppercases the name and normalizes voice modifiers. */
export function formatCharacter(text: string): string {
  let t = collapseSpaces(text);
  if (!t) return text;

  // Pull off a trailing modifier like (V.O.), (O.S.), (CONT'D), or raw vo/os/contd at end.
  // Recognize forms: "(vo)", "v.o.", "vo", "(o.s.)", "os", "o.s.", "contd", "cont'd".
  const modifierPatterns: Array<{ re: RegExp; out: string }> = [
    { re: /\s*\(?\s*v\.?\s*o\.?\s*\)?\s*$/i, out: "(V.O.)" },
    { re: /\s*\(?\s*o\.?\s*s\.?\s*\)?\s*$/i, out: "(O.S.)" },
    { re: /\s*\(?\s*cont'?d\s*\)?\s*$/i, out: "(CONT'D)" },
  ];
  let modifier = "";
  for (const { re, out } of modifierPatterns) {
    if (re.test(t)) {
      t = t.replace(re, "");
      modifier = out;
      break;
    }
  }

  t = collapseSpaces(t).toUpperCase();
  return modifier ? `${t} ${modifier}` : t;
}

/** Format a Parenthetical: wrap in (), keep concise lowercase tone. */
export function formatParenthetical(text: string): string {
  let t = collapseSpaces(text);
  if (!t) return text;
  // Strip existing wrapping parens (we'll re-add).
  t = t.replace(/^\(+/, "").replace(/\)+$/, "").trim();
  if (!t) return text;
  // Long-form likely action — caller decides; we still wrap but keep content.
  return `(${t})`;
}

/** Format a Transition line: uppercase + trailing colon, only when verb matches. */
export function formatTransition(text: string): string {
  let t = collapseSpaces(text);
  if (!t) return text;
  const upper = t.toUpperCase().replace(/:+\s*$/, "");
  if (!TRANSITION_VERBS.test(upper)) return text;
  return `${upper}:`;
}

/** Format a Shot line: uppercase, normalize POV pattern. */
export function formatShot(text: string): string {
  let t = collapseSpaces(text);
  if (!t) return text;
  let upper = t.toUpperCase();
  // "POV stephan" → "POV - STEPHAN"
  upper = upper.replace(/^POV\s+(?!-)(.+)$/, "POV - $1");
  return upper;
}

/** Dispatcher. Returns input unchanged for action/dialogue/note (passthrough + trim). */
export function formatBlockText(blockType: string, text: string): string {
  if (text == null) return text;
  switch (blockType) {
    case "scene_heading":
      return formatSceneHeading(text);
    case "character":
      return formatCharacter(text);
    case "parenthetical":
      return formatParenthetical(text);
    case "transition":
      return formatTransition(text);
    case "shot":
      return formatShot(text);
    case "action":
    case "dialogue":
    case "note":
    default:
      // Passthrough — only trim outer whitespace, preserve casing/voice.
      return text.replace(/^[ \t]+/, "").replace(/[ \t]+$/, "");
  }
}

export type FormatContext = {
  currentBlockType: string;
  prevBlockType?: string;
};

/**
 * High-level decision used by paste/import batch flows. Not used in the
 * hot typing path — that calls formatBlockText directly for the current type.
 */
export function analyzeFormat(text: string, ctx: FormatContext): FormatDecision {
  const formatted = formatBlockText(ctx.currentBlockType, text);
  const changed = formatted !== text;
  return {
    blockType: ctx.currentBlockType,
    formattedText: formatted,
    confidence: changed ? "high" : "low",
    reason: changed ? `Applied ${ctx.currentBlockType} formatting` : "No change",
    shouldApplyAutomatically: changed,
  };
}

export function shouldAutoApply(decision: FormatDecision): boolean {
  return decision.confidence === "high" && decision.shouldApplyAutomatically;
}
