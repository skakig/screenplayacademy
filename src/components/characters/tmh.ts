export const TMH_LEVELS = [
  { level: 1, name: "Survival", description: "Acts to survive — instinct overrides ethics." },
  { level: 2, name: "Self-Interest", description: "Maximizes personal gain. Others are tools." },
  { level: 3, name: "Social Contract", description: "Follows rules to stay in the group." },
  { level: 4, name: "Fairness / Justice", description: "Reciprocity, what's owed, what's earned." },
  { level: 5, name: "Empathy", description: "Feels others' stakes; chooses to ease them." },
  { level: 6, name: "Altruism", description: "Acts for others at real personal cost." },
  { level: 7, name: "Integrity", description: "Lives by an internal code regardless of audience." },
  { level: 8, name: "Virtue", description: "Becomes the value — courage, mercy, truth as habit." },
  { level: 9, name: "Transcendence", description: "Acts beyond self-interest for the whole." },
] as const;

export function tmhLabel(level?: number | null): string {
  if (!level) return "—";
  const m = TMH_LEVELS.find((l) => l.level === level);
  return m ? `L${level} ${m.name}` : `L${level}`;
}

export function tmhVar(level?: number | null): string {
  if (!level || level < 1 || level > 9) return "var(--muted)";
  return `var(--tmh-l${level})`;
}

export const GROUPS = [
  "Main Cast",
  "Supporting Cast",
  "Antagonists",
  "Allies",
  "Love Interests",
  "Family",
  "Authority Figures",
  "Comic Relief",
  "Custom",
] as const;

export type GroupName = (typeof GROUPS)[number];

// Fields used to compute "profile completeness"
export const COMPLETENESS_FIELDS = [
  "summary", "role", "archetype", "external_goal", "internal_need", "wound", "fear",
  "secret", "contradiction", "voice_summary", "visual_description", "tmh_baseline",
  "starting_belief", "ending_belief", "childhood", "defining_wound",
] as const;

export function completenessPct(c: any): number {
  if (!c) return 0;
  const filled = COMPLETENESS_FIELDS.filter((k) => {
    const v = c[k];
    return v !== null && v !== undefined && String(v).trim().length > 0;
  }).length;
  return Math.round((filled / COMPLETENESS_FIELDS.length) * 100);
}
