// Pure helpers: turn an ordered block list into a structured manuscript outline
// (scenes, characters, line counts). Used by the ManuscriptIndex sidebar and
// the background auto-detect pipeline that proposes new cast/scene records.

export type Block = {
  id: string;
  block_type: string;
  content: string;
  order_index: number;
  metadata?: Record<string, any> | null;
};

export type SceneOutline = {
  // Synthetic id derived from the scene_heading block id, or "intro" when the
  // script opens with material before any scene heading.
  id: string;
  headingBlockId: string | null;
  title: string;
  location: string | null;
  timeOfDay: string | null;
  act: 1 | 2 | 3;
  index: number;
  startOrder: number;
  endOrder: number;
  blockCount: number;
  characters: string[]; // unique uppercase names appearing in this scene
};

export type CharacterTally = {
  name: string;
  lineCount: number;
  firstSceneIndex: number;
};

const HEADING_RE = /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s*(.+?)(?:\s*[-—–]\s*(.+))?$/i;
const CHAR_NAME_RE = /^[A-Z][A-Z0-9 \-\.']{1,38}(?:\s*\([^)]+\))?$/;

export function parseSceneHeading(raw: string): { location: string; timeOfDay: string | null } {
  const m = (raw || "").trim().match(HEADING_RE);
  if (!m) return { location: raw.trim(), timeOfDay: null };
  return { location: (m[2] || "").trim(), timeOfDay: (m[3] || "").trim() || null };
}

export function isLikelyCharacterName(s: string): boolean {
  const t = (s || "").trim();
  if (!t || t.length > 40) return false;
  return CHAR_NAME_RE.test(t);
}

export function normalizeCharacterName(s: string): string {
  return (s || "")
    .replace(/\([^)]*\)/g, "") // strip "(V.O.)", "(O.S.)" etc.
    .trim()
    .toUpperCase();
}

/**
 * Turn an ordered block list into scenes. Three-act split is heuristic:
 * the first 25% of scenes are Act I, the middle 50% Act II, the last 25% Act III.
 */
export function buildOutline(blocks: Block[]): SceneOutline[] {
  const sorted = [...blocks].sort((a, b) => a.order_index - b.order_index);
  const scenes: SceneOutline[] = [];
  let current: SceneOutline | null = null;

  const startScene = (b: Block | null, index: number) => {
    if (b && b.block_type === "scene_heading") {
      const { location, timeOfDay } = parseSceneHeading(b.content);
      current = {
        id: b.id,
        headingBlockId: b.id,
        title: (b.content || "Untitled scene").trim() || "Untitled scene",
        location,
        timeOfDay,
        act: 1,
        index,
        startOrder: b.order_index,
        endOrder: b.order_index,
        blockCount: 1,
        characters: [],
      };
    } else if (b) {
      current = {
        id: `pre-${b.id}`,
        headingBlockId: null,
        title: "Opening",
        location: null,
        timeOfDay: null,
        act: 1,
        index,
        startOrder: b.order_index,
        endOrder: b.order_index,
        blockCount: 1,
        characters: [],
      };
    }
  };

  for (const b of sorted) {
    if (b.block_type === "scene_heading") {
      if (current) scenes.push(current);
      startScene(b, scenes.length);
    } else {
      if (!current) startScene(b, 0);
      const cur: SceneOutline | null = current;
      if (!cur) continue;
      cur.endOrder = b.order_index;
      cur.blockCount += 1;
      if (b.block_type === "character") {
        const n = normalizeCharacterName(b.content);
        if (n && !cur.characters.includes(n)) cur.characters.push(n);
      }
    }
  }
  if (current) scenes.push(current);

  // Assign acts
  const n = scenes.length;
  if (n > 0) {
    const a1End = Math.max(1, Math.floor(n * 0.25));
    const a2End = Math.max(a1End + 1, Math.floor(n * 0.75));
    scenes.forEach((s, i) => {
      s.act = i < a1End ? 1 : i < a2End ? 2 : 3;
    });
  }
  return scenes;
}

export function tallyCharacters(blocks: Block[]): CharacterTally[] {
  const scenes = buildOutline(blocks);
  const sceneByOrder = new Map<number, number>();
  scenes.forEach((s, i) => {
    for (let o = s.startOrder; o <= s.endOrder; o++) sceneByOrder.set(o, i);
  });

  const sorted = [...blocks].sort((a, b) => a.order_index - b.order_index);
  const map = new Map<string, CharacterTally>();
  let lastSpeaker: string | null = null;

  for (const b of sorted) {
    if (b.block_type === "character") {
      const name = normalizeCharacterName(b.content);
      if (!name || !isLikelyCharacterName(b.content)) {
        lastSpeaker = null;
        continue;
      }
      lastSpeaker = name;
      const existing = map.get(name);
      if (!existing) {
        const sIdx = scenes.findIndex((s) => b.order_index >= s.startOrder && b.order_index <= s.endOrder);
        map.set(name, { name, lineCount: 0, firstSceneIndex: sIdx >= 0 ? sIdx : 0 });
      }
    } else if (b.block_type === "dialogue" && lastSpeaker) {
      const t = map.get(lastSpeaker);
      if (t) t.lineCount += 1;
    } else if (b.block_type === "scene_heading") {
      lastSpeaker = null;
    }
  }

  return [...map.values()].sort((a, b) => b.lineCount - a.lineCount);
}

/** Rough page count using the industry rule of ~55 lines per page. */
export function estimatePages(blocks: Block[]): number {
  // 1 page ≈ 55 typed lines; weight dialogue heavier than action.
  let lines = 0;
  for (const b of blocks) {
    const c = (b.content || "").length;
    const base = Math.max(1, Math.ceil(c / 55));
    lines += b.block_type === "dialogue" || b.block_type === "action" ? base : 1;
  }
  return Math.max(1, Math.ceil(lines / 55));
}
