// LocalDraftStore — opt-in localStorage snapshot of the editor.
//
// Pass 2 wires this into /editor-lab so we can prove draft recovery works.
// Production hydration is not changed yet — server data still wins.

import type { LocalBlock } from "../useScreenplayDocument";

const KEY_PREFIX = "scenesmith.draft.";

type Stored = {
  v: 1;
  savedAt: number;
  blocks: LocalBlock[];
};

function storageAvailable() {
  if (typeof window === "undefined") return false;
  try {
    const k = "__sm_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function readDraft(projectId: string): LocalBlock[] | null {
  if (!storageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + projectId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (parsed?.v !== 1 || !Array.isArray(parsed.blocks)) return null;
    return parsed.blocks;
  } catch {
    return null;
  }
}

let writeTimer: ReturnType<typeof setTimeout> | null = null;
let pendingProjectId: string | null = null;
let pendingBlocks: LocalBlock[] | null = null;

export function writeDraft(projectId: string, blocks: LocalBlock[]) {
  if (!storageAvailable()) return;
  pendingProjectId = projectId;
  pendingBlocks = blocks;
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    if (!pendingProjectId || !pendingBlocks) return;
    try {
      const payload: Stored = { v: 1, savedAt: Date.now(), blocks: pendingBlocks };
      window.localStorage.setItem(KEY_PREFIX + pendingProjectId, JSON.stringify(payload));
    } catch {
      // quota or serialization error — drop silently
    }
  }, 1000);
}

export function clearDraft(projectId: string) {
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(KEY_PREFIX + projectId);
  } catch {
    // ignore
  }
}
