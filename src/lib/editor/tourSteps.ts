export type TourPlacement = "top" | "bottom" | "left" | "right" | "center";

export type TourStep = {
  id: string;
  title: string;
  body: string;
  targetSelector?: string; // omit for centered
  placement?: TourPlacement;
};

export const EDITOR_TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to your editor",
    body: "Take 30 seconds — we'll show you the four things you need to know before you start writing.",
    placement: "center",
  },
  {
    id: "step-coach",
    title: "Your coach lives here",
    body: "This card tells you what to do right now and updates as you progress through the 13 guided steps.",
    targetSelector: '[data-tour="step-coach"]',
    placement: "bottom",
  },
  {
    id: "block-toolbar",
    title: "Add screenplay blocks",
    body: "Scene headings, action, character, dialogue — add them from here, or use the empty-state buttons to draft with AI.",
    targetSelector: '[data-tour="block-toolbar"]',
    placement: "right",
  },
  {
    id: "guided-rail",
    title: "Track your progress",
    body: "Your guided-path progress lives up here. Click it any time to jump back to the walkthrough.",
    targetSelector: '[data-tour="guided-rail"]',
    placement: "bottom",
  },
  {
    id: "coach-panel",
    title: "Get AI feedback anytime",
    body: "Use the AI Assistant on the right to diagnose your draft, rewrite scenes, or sharpen dialogue.",
    targetSelector: '[data-tour="coach-panel"]',
    placement: "left",
  },
];
