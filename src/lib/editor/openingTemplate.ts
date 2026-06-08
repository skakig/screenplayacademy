// Template blocks inserted when a beginner picks
// "Use the opening scene template" on the empty editor.

export type TemplateBlock = { block_type: string; content: string };

export const OPENING_SCENE_TEMPLATE: TemplateBlock[] = [
  { block_type: "transition", content: "FADE IN:" },
  { block_type: "scene_heading", content: "INT. LOCATION - DAY" },
  { block_type: "action", content: "Describe what we see. Who is here, what are they doing, and why does it matter right now?" },
  { block_type: "character", content: "PROTAGONIST" },
  { block_type: "dialogue", content: "Their first line — make it land." },
  { block_type: "action", content: "Their first decision tells us who they are." },
];
