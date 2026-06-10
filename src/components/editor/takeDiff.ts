// Block-level diff between two screenplay take payloads.
// Uses LCS on a stable per-block fingerprint (type + normalized content).

import type { DraftPayload } from "./draftBackup";

export type DiffOp = "equal" | "added" | "removed" | "changed";

export type DiffRow = {
  op: DiffOp;
  left?: { block_type?: string; content?: string; index: number };
  right?: { block_type?: string; content?: string; index: number };
};

function fingerprint(b: { block_type?: string; content?: string }): string {
  return `${b.block_type ?? ""}\u0001${(b.content ?? "").trim()}`;
}

export function diffTakes(a: DraftPayload, b: DraftPayload): DiffRow[] {
  const A = a.blocks ?? [];
  const B = b.blocks ?? [];
  const n = A.length;
  const m = B.length;

  // LCS DP table on fingerprints.
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  const fpA = A.map(fingerprint);
  const fpB = B.map(fingerprint);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = fpA[i] === fpB[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (fpA[i] === fpB[j]) {
      rows.push({
        op: "equal",
        left: { ...A[i], index: i },
        right: { ...B[j], index: j },
      });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      // Removed from left. Detect "changed" if next-equal pair lines up.
      const next = j < m && A[i].block_type === B[j].block_type;
      if (next && dp[i + 1][j + 1] >= dp[i + 1][j] && dp[i + 1][j + 1] >= dp[i][j + 1]) {
        rows.push({
          op: "changed",
          left: { ...A[i], index: i },
          right: { ...B[j], index: j },
        });
        i++;
        j++;
      } else {
        rows.push({ op: "removed", left: { ...A[i], index: i } });
        i++;
      }
    } else {
      rows.push({ op: "added", right: { ...B[j], index: j } });
      j++;
    }
  }
  while (i < n) rows.push({ op: "removed", left: { ...A[i], index: i++ } });
  while (j < m) rows.push({ op: "added", right: { ...B[j], index: j++ } });
  return rows;
}

export function diffSummary(rows: DiffRow[]) {
  let added = 0;
  let removed = 0;
  let changed = 0;
  let equal = 0;
  for (const r of rows) {
    if (r.op === "added") added++;
    else if (r.op === "removed") removed++;
    else if (r.op === "changed") changed++;
    else equal++;
  }
  return { added, removed, changed, equal, total: rows.length };
}
