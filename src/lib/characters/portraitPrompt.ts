/**
 * Portrait Prompt Composer
 * ------------------------
 * Deterministic builder that fuses every field the Guided Character Builder
 * collects into a single, rich image-generation prompt. Same recipe is used
 * for every character in a project, so the entire cast shares a coherent
 * visual language while individual traits (wound, lie, voice, arc) still
 * make each portrait unique.
 *
 * No AI call — pure string composition. Callable from client tests and from
 * the server-side generatePortrait handler.
 */

export type CharacterProfile = {
  name?: string | null;
  importance?: string | null;
  story_function?: string | null;
  role?: string | null;
  external_goal?: string | null;
  act2_pressure?: string | null;
  fear?: string | null;
  wound?: string | null;
  core_lie?: string | null;
  relationships?: string | null;
  voice_summary?: string | null;
  character_arc?: string | null;
  age?: string | number | null;
  visual_description?: string | null;
  costume_notes?: string | null;
  color_palette?: string | null;
};

export type ProjectStyleContract = {
  medium?: string;          // "cinematic photograph", "graphic novel"…
  era?: string;             // "1943 North Africa", "near-future Lagos"…
  region?: string;
  palette?: string;         // "charcoal, warm gold, dust"
  lighting?: string;        // "Rembrandt", "high-key", "chiaroscuro"
  lens?: string;            // "85mm", "anamorphic"
  grain?: string;
  aspect?: string;          // "3:4"
  negative?: string;
};

const DEFAULT_STYLE: Required<ProjectStyleContract> = {
  medium: "Cinematic photograph",
  era: "contemporary",
  region: "",
  palette: "charcoal, warm gold, dust",
  lighting: "soft Rembrandt lighting, single key from camera left",
  lens: "85mm portrait lens, shallow depth of field",
  grain: "subtle 35mm film grain",
  aspect: "3:4 portrait",
  negative:
    "no text, no logos, no watermark, no captions, no extra limbs, no distortion, no cartoon unless the medium says so",
};

function trim(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** How much of the character profile is filled (0–10, portrait excluded). */
export function profileStrength(c: CharacterProfile): number {
  const fields: (keyof CharacterProfile)[] = [
    "name",
    "importance",
    "role",
    "external_goal",
    "act2_pressure",
    "fear",
    "wound",
    "core_lie",
    "relationships",
    "voice_summary",
    "character_arc",
  ];
  return fields.reduce((n, f) => n + (trim(c[f]).length > 0 ? 1 : 0), 0);
}

/** Recommended minimum strength before generating a portrait. */
export const PORTRAIT_STRENGTH_TARGET = 7;

/** True when the profile has enough substance for a truthful portrait. */
export function isPortraitReady(c: CharacterProfile): boolean {
  return profileStrength(c) >= PORTRAIT_STRENGTH_TARGET && trim(c.name).length > 0;
}

function importanceLine(imp?: string | null): string {
  const v = trim(imp).toLowerCase();
  if (v === "main") return "lead character presence, center-frame gravity";
  if (v === "supporting") return "supporting-role presence, three-quarter framing";
  if (v === "minor") return "background character presence, environmental framing";
  return "";
}

function emotionalTruth(c: CharacterProfile): string {
  const wound = trim(c.wound);
  const lie = trim(c.core_lie);
  const fear = trim(c.fear);
  const bits: string[] = [];
  if (wound) bits.push(`a private history of ${wound.replace(/\.$/, "")}`);
  if (lie) bits.push(`the visible armor of "${lie.replace(/\.$/, "")}"`);
  if (fear) bits.push(`a barely-hidden fear of ${fear.replace(/\.$/, "")}`);
  return bits.length ? `Their face carries ${bits.join(", ")}.` : "";
}

function voiceCue(c: CharacterProfile): string {
  const v = trim(c.voice_summary);
  return v ? `Bearing that reads as: ${v.replace(/\.$/, "")}.` : "";
}

function arcCue(c: CharacterProfile): string {
  const a = trim(c.character_arc);
  return a ? `Caught in the middle of the transformation ${a.replace(/\.$/, "")}.` : "";
}

function roleCue(c: CharacterProfile): string {
  const r = trim(c.role);
  const fn = trim(c.story_function);
  const bits: string[] = [];
  if (r) bits.push(r);
  if (fn && fn !== "custom") bits.push(fn.replace(/_/g, " "));
  return bits.length ? bits.join(" · ") : "";
}

/**
 * Compose a portrait prompt from the character + optional project style.
 * Structure the model responds well to: subject → identity → emotional
 * truth → wardrobe/era → cinematography → negatives.
 */
export function composePortraitPrompt(
  c: CharacterProfile,
  style: ProjectStyleContract = {},
): string {
  const S = { ...DEFAULT_STYLE, ...style };
  const name = trim(c.name) || "the character";
  const age = c.age ? String(c.age) : "adult";
  const role = roleCue(c);
  const importance = importanceLine(c.importance);
  const visual = trim(c.visual_description) || "grounded, watchful, contradictions written into the eyes";
  const wardrobe =
    trim(c.costume_notes) ||
    `wardrobe consistent with ${S.era}${S.region ? `, ${S.region}` : ""}, worn honestly rather than costumed`;
  const palette = trim(c.color_palette) || S.palette;

  const lines = [
    `${S.medium} portrait of ${name}, ${age}${role ? `, ${role}` : ""}.`,
    importance,
    `Physical read: ${visual}.`,
    emotionalTruth(c),
    voiceCue(c),
    arcCue(c),
    `Wardrobe: ${wardrobe}.`,
    `Cinematography: ${S.lens}, ${S.lighting}, ${palette} palette, ${S.grain}, ${S.aspect}.`,
    `Negative: ${S.negative}.`,
  ];
  return lines.filter(Boolean).join(" ");
}
