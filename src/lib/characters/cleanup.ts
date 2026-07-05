// Cast-cleanup helpers. Uses the same structural detectors the manuscript
// analyzer uses so the "junk character" rules stay in one place.
import { looksLikeSuspiciousCharacterName } from "@/lib/editor/manuscriptAnalyzer";

export type CharacterRow = {
  id: string;
  name: string | null;
  role?: string | null;
  summary?: string | null;
  portrait_url?: string | null;
};

export type CleanupCandidate = {
  id: string;
  name: string;
  reason: "structural" | "low_signal";
  confidence: "high" | "low";
  relCount: number;
  sceneCount: number;
};

/**
 * High-confidence junk: name looks like a scene heading, transition or act
 * label. Low-confidence: valid-looking name but no completeness, no
 * relationships, no scene usage — likely accidental stub.
 */
export function detectCleanupCandidates(
  rows: CharacterRow[],
  opts: {
    relCounts: Record<string, number>;
    sceneCounts: Record<string, number>;
    completeness: (row: CharacterRow) => number;
  },
): CleanupCandidate[] {
  const out: CleanupCandidate[] = [];
  for (const r of rows) {
    const name = (r.name ?? "").trim();
    if (!name) continue;
    const rels = opts.relCounts[r.id] ?? 0;
    const scenes = opts.sceneCounts[r.id] ?? 0;
    if (looksLikeSuspiciousCharacterName(name)) {
      out.push({ id: r.id, name, reason: "structural", confidence: "high", relCount: rels, sceneCount: scenes });
      continue;
    }
    const pct = opts.completeness(r);
    if (pct === 0 && rels === 0 && scenes === 0) {
      out.push({ id: r.id, name, reason: "low_signal", confidence: "low", relCount: rels, sceneCount: scenes });
    }
  }
  return out;
}
