export type GuidedStepMeta = {
  step_key: string;
  concept: string;
  why: string;
  example: string;
  task: string;
  aiHelper?: "logline" | "protagonist" | "antagonist" | "theme" | "arc" | "scenes" | "diagnose" | "rewrite" | "openingScene" | "act1Beats";
  aiLabel?: string;
  destination?: "editor" | "characters" | "story-arc" | "scenes" | "pitch" | "tableread";
};

export const STEP_META: Record<string, GuidedStepMeta> = {
  create_project: {
    step_key: "create_project",
    concept: "A project is your screenplay's home — title, format, tone, and genre.",
    why: "Every choice you make from here (length, structure, scenes) flexes around these basics.",
    example: "Feature Film · Drama · Grounded · 90–110 pages.",
    task: "You've already created this project. Confirm the basics fit your idea, then mark complete.",
  },
  logline: {
    step_key: "logline",
    concept: "A logline is one sentence: protagonist + goal + obstacle + stakes + hook.",
    why: "If your logline is fuzzy, your story is fuzzy. Nail this first.",
    example: "A grieving paramedic must save the killer she's hunting before sunrise — or lose her last reason to live.",
    task: "Write a logline (25–40 words). Or generate options with AI and pick one.",
    aiHelper: "logline",
    aiLabel: "Generate 5 logline options",
  },
  protagonist: {
    step_key: "protagonist",
    concept: "The protagonist is the character whose internal need drives the story's spine.",
    why: "Without a clear want + need + wound, scenes drift. Your protagonist is the engine.",
    example: "Want: solve the case. Need: forgive herself. Wound: she let her partner die.",
    task: "Build your protagonist. Use AI to draft a starting point, then edit on the Characters page.",
    aiHelper: "protagonist",
    aiLabel: "Draft a protagonist",
    destination: "characters",
  },
  antagonist: {
    step_key: "antagonist",
    concept: "The antagonist mirrors and pressures the protagonist — opposing values, similar wound.",
    why: "A strong antagonist forces real moral choices and reveals who the hero is.",
    example: "Same loss, different choice. He blames the world; she blames herself.",
    task: "Define your antagonist's want, fear, and what makes them dangerous.",
    aiHelper: "antagonist",
    aiLabel: "Draft an antagonist",
    destination: "characters",
  },
  theme: {
    step_key: "theme",
    concept: "Theme is the moral argument your story makes — not the topic.",
    why: "Theme tells you which scenes belong and which to cut. It is your story's compass.",
    example: "Topic: grief. Theme: \"Mercy costs more than vengeance, and is worth it.\"",
    task: "Choose a one-sentence thematic statement. Generate options with AI if helpful.",
    aiHelper: "theme",
    aiLabel: "Suggest 5 themes",
    destination: "story-arc",
  },
  story_arc: {
    step_key: "story_arc",
    concept: "A story arc tracks the protagonist's transformation across 3 acts.",
    why: "Beats give you a spine: opening state, midpoint shift, dark night, climax choice, final state.",
    example: "Opens hardened → midpoint forced to trust → dark night betrayal → chooses mercy → forgiven.",
    task: "Use AI to draft the arc, then refine it in the Story Arc page.",
    aiHelper: "arc",
    aiLabel: "Build a story arc",
    destination: "story-arc",
  },
  scene_cards: {
    step_key: "scene_cards",
    concept: "Scene cards are one-line summaries of every scene, in order.",
    why: "Cards let you see the whole story on one page and fix structure before you write a line.",
    example: "INT. ER — NIGHT — She breaks protocol to save him. Turn: she recognizes the tattoo.",
    task: "Generate a scene list (20–30 cards), then refine on the Scenes page.",
    aiHelper: "scenes",
    aiLabel: "Generate scene cards",
    destination: "scenes",
  },
  opening_scene: {
    step_key: "opening_scene",
    concept: "Your opening scene promises the reader the kind of story this will be.",
    why: "Tone, pace, and stakes are set in the first 3 pages. Get the promise right.",
    example: "Cold open: a 90-second crisis that ends with the protagonist choosing wrong.",
    task: "Draft a 1–2 page opening. Use AI to spark a draft, then refine in the editor.",
    aiHelper: "openingScene",
    aiLabel: "Draft an opening scene",
    destination: "editor",
  },
  act1: {
    step_key: "act1",
    concept: "Act 1 ends when the protagonist crosses a threshold they can't easily come back from.",
    why: "If your hero can still walk away after page 25–30, the story hasn't started.",
    example: "She takes the case off the books — and crosses the line that defines the rest of the film.",
    task: "Outline Act 1 beats, then write them in the editor.",
    aiHelper: "act1Beats",
    aiLabel: "Outline Act 1 beats",
    destination: "editor",
  },
  midpoint: {
    step_key: "midpoint",
    concept: "The midpoint is a shift — false win or false defeat — that changes what the story is about.",
    why: "Without a midpoint, Act 2 sags. The midpoint promises a different second half.",
    example: "She finds him — and learns he's been protecting her the whole time.",
    task: "Define your midpoint shift on the Story Arc page.",
    destination: "story-arc",
  },
  rough_draft: {
    step_key: "rough_draft",
    concept: "A rough draft is a complete pass — bad pages allowed, holes allowed.",
    why: "You can't rewrite what doesn't exist. Finish a full draft before polishing.",
    example: "Aim for FADE OUT. Then you have a screenplay to fix.",
    task: "Finish the draft in the editor. Use AI to diagnose pitfalls when you get stuck.",
    aiHelper: "diagnose",
    aiLabel: "Diagnose pitfalls in current draft",
    destination: "editor",
  },
  table_read: {
    step_key: "table_read",
    concept: "A table read lets you hear what works and what doesn't.",
    why: "Ears catch things eyes miss — clunky dialogue, dead beats, over-explanation.",
    example: "If a line lands flat aloud, it lands flat on screen.",
    task: "Run a table read in the Table Read tab to hear your scenes.",
    destination: "tableread",
  },
  pitch: {
    step_key: "pitch",
    concept: "A pitch package is the calling card you send to readers, reps, and producers.",
    why: "Logline + synopsis + treatment + tone statement = how the industry decides to read it.",
    example: "One page that makes them open page two.",
    task: "Generate your pitch package, then refine it on the Pitch page.",
    destination: "pitch",
  },
};
