// Pure screenplay text normalization + structural confidence analyzer.
// No React, no DOM, no network. Apply only at safe moments (Enter, blur,
// explicit type change, paste) — never per keystroke.

export type FormatConfidence = "high" | "medium" | "low";

export type FormatDecision = {
  /** Suggested block type for the line (may equal currentBlockType). */
  suggestedType: string;
  /** Confidence the suggestion is correct. */
  confidence: FormatConfidence;
  /** Short, user-facing reason ("Looks like a Character cue", etc.). */
  reason: string;
  /** Text after formatting, when we'd transform it. Equal to input otherwise. */
  transformedText: string;
  /** True when caller should auto-apply without asking. */
  shouldApplyAutomatically: boolean;
};

const TIME_TOKENS = [
  "MOMENTS LATER","SAME TIME","SUNRISE","SUNSET","MORNING","AFTERNOON",
  "EVENING","CONTINUOUS","LATER","NIGHT","DAWN","DUSK","DAY",
];

export const SCENE_PREFIX_CHIPS = ["INT.", "EXT.", "INT./EXT.", "EST."] as const;
export const SCENE_TIME_CHIPS = [
  "DAY", "NIGHT", "CONTINUOUS", "LATER", "MORNING", "EVENING", "MOMENTS LATER",
] as const;

/**
 * Return true when a scene-heading string has all three canonical parts:
 * PREFIX + LOCATION + TIME. Used by the chip strip to auto-hide when
 * the heading is "complete."
 */
export function isSceneHeadingComplete(text: string): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  if (!SCENE_PREFIX.test(t)) return false;
  const upper = t.toUpperCase();
  const hasTime = TIME_TOKENS.some((tok) => {
    const re = new RegExp(`(?:^|-\\s*|\\s)${tok.replace(/ /g, "\\s+")}\\s*$`);
    return re.test(upper);
  });
  if (!hasTime) return false;
  // Ensure there's something between the prefix and the time (a location).
  const prefixMatch = t.match(SCENE_PREFIX);
  if (!prefixMatch) return false;
  const afterPrefix = t.slice(prefixMatch[0].length).trim();
  // Strip trailing "- TIME" to check for location body.
  const body = afterPrefix.replace(/[-\s]+[A-Z ]+$/i, "").trim();
  return body.length > 0;
}

/**
 * Insert or replace a canonical part of a scene heading.
 * - kind="prefix": replace or prepend the INT./EXT./INT./EXT./EST. prefix.
 * - kind="time":  replace or append the trailing "- TIME" token.
 * Idempotent — applying the same part twice yields the same string.
 */
export function applySlugPart(
  currentText: string,
  part: string,
  kind: "prefix" | "time",
): string {
  const raw = currentText ?? "";
  if (kind === "prefix") {
    // Strip any leading prefix (with or without trailing period) and any
    // whitespace after it, then prepend the canonical chip value.
    const stripped = raw.replace(SCENE_PREFIX, "").replace(/^\s+/, "");
    const joined = stripped ? `${part} ${stripped}` : `${part} `;
    // Route through formatSceneHeading so casing/spacing normalizes.
    return formatSceneHeading(joined).replace(/\s+$/, joined.endsWith(" ") ? " " : "");
  }
  // kind === "time"
  const upper = raw.toUpperCase();
  // Strip any existing trailing time token (with optional leading dash).
  let base = raw;
  for (const tok of TIME_TOKENS) {
    const re = new RegExp(`\\s*-?\\s*${tok.replace(/ /g, "\\s+")}\\s*$`, "i");
    if (re.test(upper)) {
      base = raw.replace(re, "");
      break;
    }
  }
  base = base.replace(/[\s-]+$/, "");
  if (!base) return `${part}`;
  return formatSceneHeading(`${base} - ${part}`);
}


const TRANSITION_VERBS =
  /^(CUT TO|FADE IN|FADE OUT|FADE TO BLACK|SMASH CUT(?: TO)?|MATCH CUT(?: TO)?|JUMP CUT(?: TO)?|DISSOLVE TO|HARD CUT TO|TIME CUT)\b/;

const SCENE_PREFIX = /^(int\.?\/ext\.?|i\/e\.?|int\.?|ext\.?|est\.?)\b/i;

function collapseSpaces(s: string): string {
  return s.replace(/[ \t]+/g, " ").trim();
}

// ---------------- Per-type structural formatters ----------------

export function formatSceneHeading(text: string): string {
  let t = collapseSpaces(text);
  if (!t) return text;
  t = t.replace(SCENE_PREFIX, (m) => {
    const k = m.trim().toLowerCase().replace(/\s+/g, "");
    if (k.startsWith("int/ext") || k.startsWith("int./ext") || k === "i/e" || k === "i/e.") return "INT./EXT.";
    if (k.startsWith("int")) return "INT.";
    if (k.startsWith("ext")) return "EXT.";
    if (k.startsWith("est")) return "EST.";
    return m;
  });
  // Ensure exactly one space after the prefix.
  t = t.replace(/^(INT\.|EXT\.|INT\.\/EXT\.|EST\.)\s*/, (_m, p1: string) => p1 + " ");
  t = t.toUpperCase();
  for (const tok of TIME_TOKENS) {
    const re = new RegExp(`(?<![\\-A-Z])\\b${tok.replace(/ /g, "\\s+")}\\s*$`);
    if (re.test(t)) {
      t = t.replace(re, (m) => {
        const idx = t.toUpperCase().lastIndexOf(m);
        const prefix = t.slice(0, idx).replace(/\s+$/, "");
        if (prefix.endsWith("-") || prefix.endsWith("- ")) return m.trim();
        return " - " + m.trim();
      });
      t = collapseSpaces(t);
      break;
    }
  }
  t = t.replace(/\s*-\s*/g, " - ");
  return collapseSpaces(t);
}

export function formatCharacter(text: string): string {
  let t = collapseSpaces(text);
  if (!t) return text;
  const modifierPatterns: Array<{ re: RegExp; out: string }> = [
    { re: /\s*\(?\s*v\.?\s*o\.?\s*\)?\s*$/i, out: "(V.O.)" },
    { re: /\s*\(?\s*o\.?\s*s\.?\s*\)?\s*$/i, out: "(O.S.)" },
    { re: /\s*\(?\s*cont'?d\s*\)?\s*$/i, out: "(CONT'D)" },
  ];
  let modifier = "";
  for (const { re, out } of modifierPatterns) {
    if (re.test(t)) { t = t.replace(re, ""); modifier = out; break; }
  }
  t = collapseSpaces(t).toUpperCase();
  return modifier ? `${t} ${modifier}` : t;
}

export function formatParenthetical(text: string): string {
  let t = collapseSpaces(text);
  if (!t) return text;
  t = t.replace(/^\(+/, "").replace(/\)+$/, "").trim();
  if (!t) return text;
  return `(${t})`;
}

export function formatTransition(text: string): string {
  let t = collapseSpaces(text);
  if (!t) return text;
  const upper = t.toUpperCase().replace(/:+\s*$/, "");
  if (!TRANSITION_VERBS.test(upper)) return text;
  return `${upper}:`;
}

export function formatShot(text: string): string {
  let t = collapseSpaces(text);
  if (!t) return text;
  let upper = t.toUpperCase();
  upper = upper.replace(/^POV\s+(?!-)(.+)$/, "POV - $1");
  return upper;
}

export function capitalizeSentences(text: string): string {
  if (!text) return text;
  let out = text.replace(/^(\s*["'(\[]*\s*)([a-z])/, (_m, p1, p2) => p1 + p2.toUpperCase());
  out = out.replace(/([.!?]\s+["'(\[]*)([a-z])/g, (_m, p1, p2) => p1 + p2.toUpperCase());
  return out;
}

export function formatBlockText(blockType: string, text: string): string {
  if (text == null) return text;
  switch (blockType) {
    case "scene_heading": return formatSceneHeading(text);
    case "character":     return formatCharacter(text);
    case "parenthetical": return formatParenthetical(text);
    case "transition":    return formatTransition(text);
    case "shot":          return formatShot(text);
    case "action":
    case "dialogue":
    case "note":
    default: {
      const trimmed = text.replace(/^[ \t]+/, "").replace(/[ \t]+$/, "");
      return capitalizeSentences(trimmed);
    }
  }
}

// ---------------- Confidence-tiered analyzer ----------------

export type FormatContext = {
  currentBlockType: string;
  prevBlockType?: string;
  /** Lowercased character names — helps disambiguate Character vs Action. */
  characterNames?: Set<string>;
};

const ALL_UPPERCASE_LINE = /^[A-Z][A-Z0-9 .'\-]{1,37}$/;

/**
 * Decide what type a line should be and how confident we are. Used by:
 *   - ScreenplayLine for medium-confidence "convert?" chip
 *   - paste flow for batch detection
 *   - Enter/blur pipeline for high-confidence auto-apply
 */
export function analyzeFormat(text: string, ctx: FormatContext): FormatDecision {
  const raw = (text ?? "").replace(/\s+$/, "");
  const trimmed = raw.trim();
  const current = ctx.currentBlockType;

  // Empty line: low confidence, no-op.
  if (!trimmed) {
    return {
      suggestedType: current,
      confidence: "low",
      reason: "Empty line",
      transformedText: raw,
      shouldApplyAutomatically: false,
    };
  }

  // --------- HIGH-confidence rules ---------

  // 1) Scene heading prefix (INT./EXT./EST.)
  if (SCENE_PREFIX.test(trimmed)) {
    return {
      suggestedType: "scene_heading",
      confidence: "high",
      reason: "Starts with INT./EXT.",
      transformedText: formatSceneHeading(raw),
      shouldApplyAutomatically: true,
    };
  }

  // 2) Transition verbs (CUT TO:, FADE IN, etc.)
  const upper = trimmed.toUpperCase();
  if (TRANSITION_VERBS.test(upper) || /^.+TO:\s*$/.test(upper)) {
    if (TRANSITION_VERBS.test(upper)) {
      return {
        suggestedType: "transition",
        confidence: "high",
        reason: "Recognized transition phrase",
        transformedText: formatTransition(raw),
        shouldApplyAutomatically: true,
      };
    }
  }

  // 3) Fully wrapped parenthetical after character/dialogue
  if (
    /^\(.+\)$/.test(trimmed) &&
    (ctx.prevBlockType === "character" || ctx.prevBlockType === "dialogue") &&
    trimmed.length <= 60
  ) {
    return {
      suggestedType: "parenthetical",
      confidence: "high",
      reason: "Wrapped in parentheses after a Character/Dialogue line",
      transformedText: formatParenthetical(raw),
      shouldApplyAutomatically: true,
    };
  }

  // 4) Short all-uppercase line in non-character context — Character cue
  //    (e.g. typed JANE in Action). High-confidence when matches a known
  //    character name OR when very short (≤3 words, no punctuation).
  const words = trimmed.split(/\s+/);
  const isShortUpper =
    ALL_UPPERCASE_LINE.test(trimmed) &&
    words.length <= 4 &&
    !/[.!?,;:]/.test(trimmed);
  if (
    isShortUpper &&
    current !== "character" &&
    current !== "scene_heading" &&
    current !== "transition" &&
    current !== "shot"
  ) {
    const knownName = ctx.characterNames?.has(trimmed.toLowerCase());
    return {
      suggestedType: "character",
      confidence: knownName ? "high" : (words.length <= 3 ? "high" : "medium"),
      reason: knownName ? "Matches a project character name" : "Short uppercase line",
      transformedText: formatCharacter(raw),
      shouldApplyAutomatically: !!knownName || words.length <= 2,
    };
  }

  // --------- MEDIUM-confidence rules (suggest only) ---------

  // 5) Lowercase line in a Character block → probably Action
  if (current === "character" && /[a-z]/.test(trimmed) && !ALL_UPPERCASE_LINE.test(trimmed)) {
    return {
      suggestedType: "action",
      confidence: "medium",
      reason: "Lowercase text in a Character cue",
      transformedText: capitalizeSentences(raw.trimStart()),
      shouldApplyAutomatically: false,
    };
  }

  // 6) Action line ending in `:` and uppercase tail → maybe Transition
  if (
    current === "action" &&
    /:\s*$/.test(trimmed) &&
    upper === trimmed &&
    words.length <= 4
  ) {
    return {
      suggestedType: "transition",
      confidence: "medium",
      reason: "All-caps line ending in `:`",
      transformedText: formatTransition(raw),
      shouldApplyAutomatically: false,
    };
  }

  // 7) Parenthetical-shaped line that's too long → probably Action
  if (current === "parenthetical" && trimmed.length > 60) {
    return {
      suggestedType: "action",
      confidence: "medium",
      reason: "Long parenthetical — usually Action with parens",
      transformedText: raw,
      shouldApplyAutomatically: false,
    };
  }

  // 8) Short uppercase-ish line in Action that *might* be a character
  if (
    current === "action" &&
    words.length <= 3 &&
    /^[A-Z]/.test(trimmed) &&
    trimmed.length <= 24 &&
    !/[.!?]$/.test(trimmed) &&
    !ALL_UPPERCASE_LINE.test(trimmed)
  ) {
    return {
      suggestedType: "character",
      confidence: "medium",
      reason: "Looks like a Character cue",
      transformedText: formatCharacter(raw),
      shouldApplyAutomatically: false,
    };
  }

  // --------- LOW (default) ---------
  const passThrough = formatBlockText(current, raw);
  return {
    suggestedType: current,
    confidence: "low",
    reason: "No structural change",
    transformedText: passThrough,
    shouldApplyAutomatically: false,
  };
}

export function shouldAutoApply(d: FormatDecision): boolean {
  return d.confidence === "high" && d.shouldApplyAutomatically;
}

// ---------------- Paste-batch parser ----------------

export type ParsedBlock = {
  block_type: string;
  content: string;
  confidence: FormatConfidence;
  reason: string;
};

/**
 * Parse a multi-line pasted script into typed blocks. Heuristic:
 *  - Lines starting with INT./EXT. → scene_heading
 *  - Transition verbs → transition
 *  - Wrapped in ( ) and short → parenthetical (assigned to whatever
 *    follows a character cue)
 *  - Short ALL-CAPS line followed by a non-blank line → character + dialogue
 *  - Everything else → action
 *
 *  Blank lines are treated as block separators, not their own block.
 */
export function formatPastedScript(raw: string, ctx?: FormatContext): ParsedBlock[] {
  if (!raw) return [];
  const rawLines = raw.replace(/\r\n?/g, "\n").split("\n");

  // Collapse runs of blank lines but use blanks as boundary hints.
  const lines: { text: string; blankBefore: boolean }[] = [];
  let blank = false;
  for (const ln of rawLines) {
    const t = ln.replace(/\s+$/, "");
    if (t.trim() === "") { blank = true; continue; }
    lines.push({ text: t, blankBefore: blank });
    blank = false;
  }

  const out: ParsedBlock[] = [];
  let prevType = ctx?.prevBlockType ?? "action";

  for (let i = 0; i < lines.length; i++) {
    const { text } = lines[i];
    const trimmed = text.trim();
    if (!trimmed) continue;

    const decision = analyzeFormat(trimmed, {
      currentBlockType: "action",
      prevBlockType: prevType,
      characterNames: ctx?.characterNames,
    });

    let chosenType = decision.suggestedType;
    let chosenContent = decision.transformedText;
    let chosenConf: FormatConfidence = decision.confidence;
    let reason = decision.reason;

    // Heuristic: a short all-caps line followed by another non-blank line
    // is almost certainly a Character cue.
    if (chosenType !== "character" && chosenType !== "scene_heading" && chosenType !== "transition") {
      if (
        ALL_UPPERCASE_LINE.test(trimmed) &&
        trimmed.split(/\s+/).length <= 4 &&
        !/[.!?,;]/.test(trimmed) &&
        lines[i + 1] &&
        !ALL_UPPERCASE_LINE.test(lines[i + 1].text.trim()) &&
        !SCENE_PREFIX.test(lines[i + 1].text.trim())
      ) {
        chosenType = "character";
        chosenContent = formatCharacter(trimmed);
        chosenConf = "high";
        reason = "Short uppercase line followed by prose";
      }
    }

    // Wrapped parenthetical after a character/dialogue line.
    if (
      /^\(.+\)$/.test(trimmed) &&
      (prevType === "character" || prevType === "dialogue") &&
      trimmed.length <= 60
    ) {
      chosenType = "parenthetical";
      chosenContent = formatParenthetical(trimmed);
      chosenConf = "high";
      reason = "Parenthetical after character/dialogue";
    }

    // Line immediately following a Character cue (or its Parenthetical) is Dialogue.
    if (
      (prevType === "character" || prevType === "parenthetical") &&
      chosenType === "action" &&
      !SCENE_PREFIX.test(trimmed) &&
      !TRANSITION_VERBS.test(trimmed.toUpperCase())
    ) {
      chosenType = "dialogue";
      chosenContent = capitalizeSentences(trimmed);
      chosenConf = "medium";
      reason = "Follows a character cue";
    }

    out.push({
      block_type: chosenType,
      content: chosenContent,
      confidence: chosenConf,
      reason,
    });
    prevType = chosenType;
  }

  return out;
}
