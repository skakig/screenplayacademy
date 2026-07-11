// Pass 1 — Pure identity resolution engine.
// No I/O, no Supabase. Consumed by server fns and unit tests.
// Doctrine: docs/CHARACTERS_REBUILD.md, docs/CHARACTERS_PASS1_INVENTORY.md

export type NormalizedName = {
  /** Untouched source form as observed. */
  raw: string;
  /** Fully normalized form used for matching (uppercase, ascii-fold, no titles/labels). */
  normalized: string;
  /** Same as normalized but WITH rank/title still present (used to distinguish `LT. HANS` vs `HANS`). */
  normalizedWithRank: string;
  /** Extracted rank token (untouched from source, in display case). */
  rank: string | null;
  /** Extracted honorific/title. */
  title: string | null;
  /** Numbered role: base + number if present. */
  numberedRole: { base: string; number: number } | null;
  /** Speaker-label parentheticals stripped (V.O., O.S., CONT'D, etc.). */
  strippedLabels: string[];
};

const RANK_TOKENS = new Set([
  "LT", "LT.", "LIEUTENANT",
  "CAPT", "CAPT.", "CAPTAIN",
  "MAJOR",
  "COL", "COL.", "COLONEL",
  "GEN", "GEN.", "GENERAL",
  "SGT", "SGT.", "SERGEANT",
  "CMDR", "CMDR.", "COMMANDER",
  "OBERLEUTNANT", "HAUPTMANN",
  "KING", "QUEEN", "PRINCE", "PRINCESS",
]);

const TITLE_TOKENS = new Set([
  "HERR", "FRAU",
  "DR", "DR.",
  "MR", "MR.", "MRS", "MRS.", "MS", "MS.",
  "SIR", "LADY",
]);

const SPEAKER_LABEL_RE =
  /\((?:V\.?\s*O\.?|O\.?\s*S\.?|CONT'?D|CONTINUED|PRE-?LAP|FILTERED|SUBTITLE|SUBTITLED|WHISPER|WHISPERED)\)/gi;

const WORD_NUMBERS: Record<string, number> = {
  ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
  SIX: 6, SEVEN: 7, EIGHT: 8, NINE: 9, TEN: 10,
};

function foldDiacritics(s: string): string {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeName(input: string): NormalizedName {
  const raw = input ?? "";
  const strippedLabels: string[] = [];
  let s = raw
    .replace(SPEAKER_LABEL_RE, (m) => {
      strippedLabels.push(m.slice(1, -1).toUpperCase().replace(/\s+/g, ""));
      return " ";
    })
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');

  s = foldDiacritics(s)
    .toUpperCase()
    .replace(/[^A-Z0-9#\-'\s.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Numbered role: "SOLDIER #1", "SOLDIER 1", "SOLDIER ONE"
  let numberedRole: NormalizedName["numberedRole"] = null;
  const numMatch = s.match(/^(.*?)\s*(?:#\s*(\d+)|(\d+)|(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN))\s*$/);
  if (numMatch) {
    const base = numMatch[1].trim();
    const n = numMatch[2] ?? numMatch[3] ?? (numMatch[4] ? String(WORD_NUMBERS[numMatch[4]]) : null);
    if (base && n) {
      numberedRole = { base, number: Number(n) };
    }
  }

  // Split into tokens, peel rank/title from the front.
  const tokens = s.split(" ").filter(Boolean);
  let rank: string | null = null;
  let title: string | null = null;

  while (tokens.length > 1) {
    const t = tokens[0].replace(/\.$/, "");
    if (RANK_TOKENS.has(tokens[0]) || RANK_TOKENS.has(t)) {
      rank = (rank ? rank + " " : "") + tokens[0];
      tokens.shift();
      continue;
    }
    if (TITLE_TOKENS.has(tokens[0]) || TITLE_TOKENS.has(t)) {
      title = (title ? title + " " : "") + tokens[0];
      tokens.shift();
      continue;
    }
    break;
  }

  const normalized = tokens.join(" ").trim();
  const normalizedWithRank = [title, rank, normalized].filter(Boolean).join(" ").trim();

  return { raw, normalized, normalizedWithRank, rank, title, numberedRole, strippedLabels };
}

// ---------- Similarity ----------

function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }
  return d[m][n];
}

export type SimilarityResult = {
  score: number;
  auto: boolean; // never true for cross-character auto-merge
  reasons: string[];
};

export type IdentityInput = {
  id: string;
  name: string;
  sceneIds?: string[];
};

/**
 * Compare two identities. Returns a proposal score plus reasons.
 * Never auto-merges established records — `auto` is only true for
 * within-candidate exact formatting collapse (see `collapseCandidateVariants`).
 */
export function similarity(a: IdentityInput, b: IdentityInput): SimilarityResult {
  const na = normalizeName(a.name);
  const nb = normalizeName(b.name);
  const reasons: string[] = [];

  // Numbered roles: never propose #1 vs #2 as duplicates
  if (na.numberedRole && nb.numberedRole) {
    if (na.numberedRole.base === nb.numberedRole.base && na.numberedRole.number !== nb.numberedRole.number) {
      return { score: 0, auto: false, reasons: ["numbered_role_distinct"] };
    }
  }

  // Exact-equal after rank strip
  if (na.normalized && na.normalized === nb.normalized) {
    reasons.push("normalized_equal");
    if (na.rank !== nb.rank || na.title !== nb.title) {
      reasons.push("rank_or_title_differs_kept_as_evidence");
    }
    return applyCoOccurrence({ score: 0.98, auto: false, reasons }, a, b);
  }

  // Damerau-Levenshtein on tokens ≥ 4 chars
  if (na.normalized.length >= 4 && nb.normalized.length >= 4) {
    const dist = damerauLevenshtein(na.normalized, nb.normalized);
    if (dist === 1) {
      reasons.push("damerau_levenshtein_1");
      return applyCoOccurrence({ score: 0.85, auto: false, reasons }, a, b);
    }
  }

  // Token-set inclusion (HANS ⊂ HANS-DIETER VON ZWICK)
  const aTokens = new Set(na.normalized.split(/[\s\-]/).filter((t) => t.length >= 2));
  const bTokens = new Set(nb.normalized.split(/[\s\-]/).filter((t) => t.length >= 2));
  if (aTokens.size && bTokens.size) {
    const [small, big] = aTokens.size <= bTokens.size ? [aTokens, bTokens] : [bTokens, aTokens];
    let all = true;
    for (const t of small) if (!big.has(t)) { all = false; break; }
    if (all && small.size >= 1 && small.size < big.size) {
      reasons.push("token_subset");
      const overlap = sceneOverlap(a.sceneIds, b.sceneIds);
      const boost = overlap > 0 ? Math.min(0.17, overlap * 0.05) : 0;
      const score = Math.min(0.92, 0.75 + boost);
      if (boost > 0) reasons.push(`scene_overlap:${overlap}`);
      return applyCoOccurrence({ score, auto: false, reasons }, a, b);
    }
  }

  return { score: 0, auto: false, reasons: ["no_match"] };
}

function sceneOverlap(a?: string[], b?: string[]): number {
  if (!a?.length || !b?.length) return 0;
  const bs = new Set(b);
  let n = 0;
  for (const s of a) if (bs.has(s)) n++;
  return n;
}

function applyCoOccurrence(r: SimilarityResult, a: IdentityInput, b: IdentityInput): SimilarityResult {
  const overlap = sceneOverlap(a.sceneIds, b.sceneIds);
  if (overlap > 0) {
    return {
      score: Math.max(0, r.score - 0.25),
      auto: false,
      reasons: [...r.reasons, `co_occurrence_warning:${overlap}`],
    };
  }
  return r;
}

// ---------- Candidate-variant collapse (safe pre-persistence auto) ----------

/**
 * Collapse exact formatting variants of a *single detection candidate*
 * (`HANS`, `HANS (V.O.)`, `HANS (CONT'D)`, `HANS (O.S.)`) into one group.
 * Only operates on `character_candidates`, never on `characters`.
 */
export function collapseCandidateVariants<T extends { detected_name: string }>(
  candidates: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const c of candidates) {
    const key = normalizeName(c.detected_name).normalized;
    if (!key) continue;
    const arr = groups.get(key) ?? [];
    arr.push(c);
    groups.set(key, arr);
  }
  return groups;
}

// ---------- Merge proposals across a project ----------

export type MergeProposal = {
  a: IdentityInput;
  b: IdentityInput;
  score: number;
  reasons: string[];
};

/**
 * Given an established cast, propose likely-duplicate pairs.
 * Filters by a `keepSeparate` set from project_alias_memory.
 */
export function proposeMerges(
  identities: IdentityInput[],
  keepSeparate: ReadonlySet<string> = new Set(),
): MergeProposal[] {
  const proposals: MergeProposal[] = [];
  const key = (x: string, y: string) => [x, y].sort().join("|");
  for (let i = 0; i < identities.length; i++) {
    for (let j = i + 1; j < identities.length; j++) {
      const a = identities[i];
      const b = identities[j];
      if (keepSeparate.has(key(a.id, b.id))) continue;
      const s = similarity(a, b);
      if (s.score >= 0.75) proposals.push({ a, b, score: s.score, reasons: s.reasons });
    }
  }
  return proposals.sort((x, y) => y.score - x.score);
}
