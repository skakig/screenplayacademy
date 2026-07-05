// Pure-TS screenplay parser. Converts raw text into ordered candidate blocks
// using the heuristics specified in docs/SCREENPLAY_IMPORT_PIPELINE.md §Parsing.
// Non-destructive: unsure lines fall back to `action`, never silently dropped.

export type CandidateType =
  | "scene_heading"
  | "action"
  | "character"
  | "dialogue"
  | "parenthetical"
  | "transition"
  | "shot"
  | "note"
  | "unknown";

export type Confidence = "high" | "medium" | "low";

export type Candidate = {
  order_index: number;
  raw_text: string;
  proposed_block_type: CandidateType;
  confidence: Confidence;
  reason?: string;
  needs_review: boolean;
  proposed_scene_index?: number;
  proposed_character_name?: string;
};

const SCENE_HIGH = /^(INT\.\/EXT\.|I\/E\.|INT\.|EXT\.)\s+/i;
const SCENE_MED = /^(int |ext |inside |outside )/i;
const TRANSITION_HIGH =
  /^(CUT TO:|FADE IN:|FADE OUT:|FADE TO:|SMASH CUT TO:|DISSOLVE TO:|MATCH CUT TO:|JUMP CUT TO:|BACK TO:)\s*$/i;
const PARENTHETICAL = /^\(.*\)\s*$/;
const SHOT = /^(CLOSE ON|ANGLE ON|WIDE ON|POV|INSERT|PAN TO|TRACK)\b/i;
const CHAR_TAG = /\((V\.?O\.?|O\.?S\.?|CONT'D|CONTINUED|PRE-LAP|FILTERED)\)$/i;

// Structural / act / sequence labels that must never become characters.
const STRUCTURAL_LABEL = new RegExp(
  "^(ACT|SCENE|CHAPTER|PART|PROLOGUE|EPILOGUE|TEASER|COLD OPEN|" +
    "OPENING SCENE|MIDPOINT|SEQUENCE|MONTAGE|SERIES OF SHOTS|" +
    "THE END|END( OF)?( ACT| SCENE| MONTAGE)?|FADE (IN|OUT)|EST)\\b",
  "i",
);
// Common time-of-day tail (e.g. "EXT LIBYAN PLATEAU DAY" — no INT/EXT parsed
// but clearly a slug).
const TIME_TAIL =
  /\b(DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|CONTINUOUS|LATER|MOMENTS LATER|SAME|NOON|MIDNIGHT|AFTERNOON)\.?$/i;
const SCENE_NUMBER = /^\d+[A-Z]?\.?$/;
const NUMBERED_SLUG = /^\d+\s+(INT|EXT)\b/i;
const STOPWORD_CHAR = new Set(["THE", "AND", "BUT", "OR", "SO", "A", "AN"]);

function normalizeName(line: string): string {
  // Drop modifiers in parens for the proposed_character_name field.
  return line.replace(/\s*\(.*?\)\s*$/g, "").trim();
}

function isLikelyCharacterLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.length > 50) return false;
  if (trimmed.endsWith(":")) return false;
  if (TRANSITION_HIGH.test(trimmed)) return false;
  if (SCENE_HIGH.test(trimmed)) return false;
  if (SCENE_MED.test(trimmed)) return false;
  if (PARENTHETICAL.test(trimmed)) return false;
  if (SHOT.test(trimmed)) return false;
  if (STRUCTURAL_LABEL.test(trimmed)) return false;
  if (SCENE_NUMBER.test(trimmed)) return false;
  if (NUMBERED_SLUG.test(trimmed)) return false;
  if (TIME_TAIL.test(trimmed)) return false;
  // Strip allowed modifier tags before further tests.
  const base = trimmed.replace(CHAR_TAG, "").trim();
  if (!base) return false;
  // Reject sentence-like punctuation. Allow initials such as "J.T.".
  if (/[!?]/.test(base)) return false;
  if (/\./.test(base) && !/^([A-Z]\.){1,4}[A-Z]?$/.test(base.replace(/\s+/g, ""))) return false;
  if (STOPWORD_CHAR.has(base.toUpperCase())) return false;
  // Character names are short.
  const words = base.split(/\s+/).filter(Boolean);
  if (words.length > 5) return false;
  // Must have at least one letter and be fully uppercase (with allowed punctuation).
  if (!/[A-Z]/.test(base)) return false;
  return base === base.toUpperCase() && /^[A-Z0-9 ()'\-.\u00C0-\u017F]+$/.test(base);
}


function parseSceneHeading(line: string): { location?: string; time?: string } {
  // EXT. BY THE TANK - DAWN  →  { location: "BY THE TANK", time: "DAWN" }
  const stripped = line.replace(SCENE_HIGH, "").trim();
  const [loc, ...rest] = stripped.split(/\s+[-–—]\s+/);
  return { location: loc?.trim() || undefined, time: rest.join(" - ").trim() || undefined };
}

export function parseScreenplayText(raw: string, knownCharacterNames: string[] = []): Candidate[] {
  // Normalize line endings; preserve original line breaks otherwise.
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const known = new Set(knownCharacterNames.map((n) => n.toUpperCase().trim()));

  const candidates: Candidate[] = [];
  let sceneCounter = 0;
  // Holder object so TS doesn't narrow the closure-mutated value to `never`.
  const state: { lastNonBlank: Candidate | null } = { lastNonBlank: null };
  let order = 0;

  const push = (c: Omit<Candidate, "order_index">): Candidate => {
    const next: Candidate = { ...c, order_index: order++ };
    candidates.push(next);
    if (c.raw_text.trim()) state.lastNonBlank = next;
    return next;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Skip pure blank lines but preserve as `unknown` only if surrounded by content;
    // dropping blanks keeps the candidate list focused. The raw_text snapshot in the
    // session row preserves them for recoverability.
    if (!trimmed) continue;

    // Scene Heading
    if (SCENE_HIGH.test(trimmed)) {
      sceneCounter++;
      const { location } = parseSceneHeading(trimmed);
      push({
        raw_text: trimmed,
        proposed_block_type: "scene_heading",
        confidence: "high",
        reason: "Starts with INT./EXT.",
        needs_review: false,
        proposed_scene_index: sceneCounter,
        proposed_character_name: location,
      });
      continue;
    }
    if (SCENE_MED.test(trimmed)) {
      sceneCounter++;
      push({
        raw_text: trimmed,
        proposed_block_type: "scene_heading",
        confidence: "medium",
        reason: "Looks like a scene heading (lowercase int/ext)",
        needs_review: true,
        proposed_scene_index: sceneCounter,
      });
      continue;
    }

    // Transition
    if (TRANSITION_HIGH.test(trimmed)) {
      push({
        raw_text: trimmed,
        proposed_block_type: "transition",
        confidence: "high",
        reason: "Matches a standard transition phrase",
        needs_review: false,
      });
      continue;
    }

    // Shot
    if (SHOT.test(trimmed) && trimmed === trimmed.toUpperCase()) {
      push({
        raw_text: trimmed,
        proposed_block_type: "shot",
        confidence: "medium",
        reason: "Looks like a shot description",
        needs_review: true,
      });
      continue;
    }

    // Parenthetical (between a character/dialogue and dialogue)
    if (
      PARENTHETICAL.test(trimmed) &&
      state.lastNonBlank &&
      (state.lastNonBlank.proposed_block_type === "character" ||
        state.lastNonBlank.proposed_block_type === "dialogue")
    ) {
      push({
        raw_text: trimmed,
        proposed_block_type: "parenthetical",
        confidence: "high",
        reason: "Parenthetical between character and dialogue",
        needs_review: false,
      });
      continue;
    }

    // Character (uppercase short line with following dialogue)
    const nextLine = lines.slice(i + 1).find((l) => l.trim().length > 0);
    const lineLooksLikeCharacter = isLikelyCharacterLine(trimmed);
    const nextLineIsDialogueish =
      nextLine &&
      !SCENE_HIGH.test(nextLine.trim()) &&
      !TRANSITION_HIGH.test(nextLine.trim()) &&
      !SCENE_MED.test(nextLine.trim());

    if (lineLooksLikeCharacter && nextLineIsDialogueish) {
      push({
        raw_text: trimmed,
        proposed_block_type: "character",
        confidence: "high",
        reason: "Short uppercase line followed by dialogue",
        needs_review: false,
        proposed_character_name: normalizeName(trimmed),
      });
      continue;
    }

    // Title-case match against existing character roster
    if (
      nextLineIsDialogueish &&
      known.has(trimmed.toUpperCase().replace(/\s*\(.*?\)\s*$/, ""))
    ) {
      push({
        raw_text: trimmed,
        proposed_block_type: "character",
        confidence: "medium",
        reason: "Matches a known character name",
        needs_review: true,
        proposed_character_name: normalizeName(trimmed),
      });
      continue;
    }

    // Dialogue: previous non-blank is a character or parenthetical
    if (
      state.lastNonBlank &&
      (state.lastNonBlank.proposed_block_type === "character" ||
        state.lastNonBlank.proposed_block_type === "parenthetical" ||
        state.lastNonBlank.proposed_block_type === "dialogue")
    ) {
      // If the prior line was dialogue and there's a blank gap, break out to action.
      const priorWasDialogueWithGap =
        state.lastNonBlank.proposed_block_type === "dialogue" &&
        i > 0 &&
        lines[i - 1].trim() === "";
      if (!priorWasDialogueWithGap) {
        push({
          raw_text: trimmed,
          proposed_block_type: "dialogue",
          confidence: "high",
          reason: "Follows a character or parenthetical",
          needs_review: false,
        });
        continue;
      }
    }

    // Default fallback: action
    push({
      raw_text: trimmed,
      proposed_block_type: "action",
      confidence: "medium",
      reason: "Narrative fallback (no stronger signal)",
      needs_review: false,
    });
  }

  return candidates;
}

export function summarizeCandidates(c: Candidate[]) {
  const counts: Record<string, number> = {};
  const sceneHeadings: string[] = [];
  const characters = new Map<string, number>();
  const locations: string[] = [];
  for (const x of c) {
    counts[x.proposed_block_type] = (counts[x.proposed_block_type] ?? 0) + 1;
    if (x.proposed_block_type === "scene_heading") {
      sceneHeadings.push(x.raw_text);
      if (x.proposed_character_name) locations.push(x.proposed_character_name);
    }
    if (x.proposed_block_type === "character" && x.proposed_character_name) {
      const k = x.proposed_character_name.toUpperCase();
      characters.set(k, (characters.get(k) ?? 0) + 1);
    }
  }
  return {
    counts,
    sceneCount: sceneHeadings.length,
    characters: [...characters.entries()]
      .map(([name, lines]) => ({ name, lines }))
      .sort((a, b) => b.lines - a.lines),
    locations: [...new Set(locations)],
    needsReview: c.filter((x) => x.needs_review).length,
    total: c.length,
  };
}
