// Pure helpers that turn (blocks, project, step) into a checklist of
// concrete sub-tasks. The editor's StepCoach renders these and the
// "Mark complete" button only lights up when allDone is true.

export type Check = { label: string; done: boolean };

export type StepProgress = {
  checks: Check[];
  allDone: boolean;
  primaryAction: { kind: "ai" | "insert" | "navigate" | "mark"; label: string } | null;
};

export type EditorBlock = {
  id: string;
  block_type: string;
  content: string | null;
  metadata?: Record<string, any> | null;
};

export type ProjectLite = {
  title?: string | null;
  logline?: string | null;
  theme?: string | null;
  genre?: string | null;
};

const wc = (s: string | null | undefined) =>
  !s ? 0 : s.trim().split(/\s+/).filter(Boolean).length;

function loglineProgress(p: ProjectLite): StepProgress {
  const words = wc(p.logline);
  const inRange = words >= 25 && words <= 40;
  const checks: Check[] = [
    { label: "Logline saved on the project", done: !!p.logline && p.logline.trim().length > 0 },
    { label: "Between 25 and 40 words", done: inRange },
  ];
  const allDone = checks.every((c) => c.done);
  return {
    checks,
    allDone,
    primaryAction: allDone
      ? { kind: "mark", label: "Logline looks great — mark step complete" }
      : { kind: "ai", label: "Generate 5 logline options" },
  };
}

function openingSceneProgress(blocks: EditorBlock[]): StepProgress {
  const hasHeading = blocks.some((b) => b.block_type === "scene_heading" && (b.content ?? "").trim().length > 0);
  const hasAction = blocks.some((b) => b.block_type === "action" && (b.content ?? "").trim().length > 0);
  const hasDialogue = blocks.some((b) => b.block_type === "dialogue" && (b.content ?? "").trim().length > 0);
  const checks: Check[] = [
    { label: "Scene heading written (INT./EXT.)", done: hasHeading },
    { label: "At least one action line", done: hasAction },
    { label: "At least one line of dialogue", done: hasDialogue },
  ];
  const allDone = checks.every((c) => c.done);
  return {
    checks,
    allDone,
    primaryAction: allDone
      ? { kind: "mark", label: "Opening scene done — mark step complete" }
      : !hasHeading
      ? { kind: "insert", label: "Insert opening scene template" }
      : { kind: "ai", label: "Draft an opening with AI" },
  };
}

function genericNavigateProgress(label: string): StepProgress {
  return {
    checks: [{ label: `Work happens on the ${label} page`, done: false }],
    allDone: false,
    primaryAction: { kind: "navigate", label: `Open ${label}` },
  };
}

export function progressForStep(
  stepKey: string | undefined,
  blocks: EditorBlock[],
  project: ProjectLite,
): StepProgress {
  switch (stepKey) {
    case "logline":
      return loglineProgress(project);
    case "theme":
      return genericNavigateProgress("Story Arc");
    case "opening_scene":
      return openingSceneProgress(blocks);
    case "protagonist":
    case "antagonist":
      return genericNavigateProgress("Characters");
    case "story_arc":
    case "midpoint":
      return genericNavigateProgress("Story Arc");
    case "scene_cards":
      return genericNavigateProgress("Scenes");
    case "table_read":
      return genericNavigateProgress("Table Read");
    case "pitch":
      return genericNavigateProgress("Pitch");
    case "act1": {
      const sceneCount = blocks.filter((b) => b.block_type === "scene_heading").length;
      const total = blocks.length;
      const checks: Check[] = [
        { label: "At least 3 scene headings", done: sceneCount >= 3 },
        { label: "40+ blocks written", done: total >= 40 },
      ];
      const allDone = checks.every((c) => c.done);
      return {
        checks,
        allDone,
        primaryAction: allDone
          ? { kind: "mark", label: "Act 1 done — mark step complete" }
          : { kind: "ai", label: "Outline Act 1 beats" },
      };
    }
    case "rough_draft": {
      const total = blocks.length;
      const checks: Check[] = [{ label: "150+ blocks (rough complete draft)", done: total >= 150 }];
      return {
        checks,
        allDone: total >= 150,
        primaryAction: total >= 150
          ? { kind: "mark", label: "Mark draft complete" }
          : { kind: "ai", label: "Diagnose pitfalls in current draft" },
      };
    }
    default:
      return { checks: [], allDone: false, primaryAction: null };
  }
}

export function shouldUseLoglineComposer(step: string | undefined) {
  return step === "logline";
}
export function shouldRedirectStep(step: string | undefined):
  | { destination: "characters" | "story-arc" | "scenes" | "pitch" | "tableread" }
  | null {
  switch (step) {
    case "protagonist":
    case "antagonist":
      return { destination: "characters" };
    case "story_arc":
    case "midpoint":
    case "theme":
      return { destination: "story-arc" };
    case "scene_cards":
      return { destination: "scenes" };
    case "pitch":
      return { destination: "pitch" };
    case "table_read":
      return { destination: "tableread" };
    default:
      return null;
  }
}
