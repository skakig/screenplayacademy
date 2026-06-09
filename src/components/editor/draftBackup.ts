// Local-first draft backup. Mirrors the editor's full local state to
// localStorage so that a reload, network failure, or save-failure never
// destroys typed text. Cheap, synchronous, schema-versioned.

import type { LocalBlock } from "./useScreenplayDocument";

const KEY_PREFIX = "scenesmith.draft.v1.";

export type DraftPayload = {
  savedAt: number;
  blocks: Array<Partial<LocalBlock>>;
};

function key(projectId: string) {
  return KEY_PREFIX + projectId;
}

export function writeDraft(projectId: string, blocks: LocalBlock[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: DraftPayload = {
      savedAt: Date.now(),
      blocks: blocks.map((b) => ({
        id: b.id,
        serverId: b.serverId,
        block_type: b.block_type,
        content: b.content,
        order_index: b.order_index,
        metadata: b.metadata,
        status: b.status,
      })),
    };
    window.localStorage.setItem(key(projectId), JSON.stringify(payload));
  } catch {
    // quota / private mode — silent
  }
}

export function readDraft(projectId: string): DraftPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftPayload;
    if (!parsed?.blocks || !Array.isArray(parsed.blocks)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraft(projectId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(projectId));
  } catch {
    // noop
  }
}
