/**
 * Cast Style Presets
 * ------------------
 * A curated set of project-wide visual contracts. Selecting one from the
 * character builder pins every portrait in the project to the same visual
 * language (medium, palette, lens, lighting) so the cast reads as one film.
 */
import type { ProjectStyleContract } from "./portraitPrompt";

export type CastStylePresetKey =
  | "ultra_realistic"
  | "cinematic_noir"
  | "painterly_art"
  | "concept_art"
  | "graphic_comic"
  | "anime_illustration"
  | "watercolor";

export type CastStylePreset = {
  key: CastStylePresetKey;
  label: string;
  description: string;
  contract: ProjectStyleContract;
};

export const CAST_STYLE_PRESETS: CastStylePreset[] = [
  {
    key: "ultra_realistic",
    label: "Ultra-Realistic",
    description: "Photographic 85mm portrait, natural skin, cinematic key light.",
    contract: {
      medium: "Ultra-realistic cinematic photograph",
      lens: "85mm portrait lens, shallow depth of field, sharp focus on eyes",
      lighting: "soft Rembrandt key light from camera left, subtle fill",
      palette: "true-to-life color, cinematic warmth in shadows",
      grain: "subtle 35mm film grain, natural skin texture, no plastic smoothing",
      aspect: "3:4 portrait",
      negative:
        "no text, no logos, no watermark, no cartoon, no illustration, no cgi doll skin, no distortion, no extra limbs",
    },
  },
  {
    key: "cinematic_noir",
    label: "Cinematic Noir",
    description: "High-contrast black-and-shadow, chiaroscuro key.",
    contract: {
      medium: "Cinematic black-and-white portrait, film noir",
      lens: "50mm anamorphic, shallow depth of field",
      lighting: "hard chiaroscuro key, single source, deep shadows across half the face",
      palette: "monochrome silver, ink black, bone white",
      grain: "coarse silver-halide film grain",
      aspect: "3:4 portrait",
      negative: "no text, no logos, no color, no cartoon, no distortion, no watermark",
    },
  },
  {
    key: "painterly_art",
    label: "Painterly Art",
    description: "Oil-painted portrait, brushwork visible, gallery lighting.",
    contract: {
      medium: "Oil-painted character portrait, painterly brushwork",
      lens: "portrait composition, gallery framing",
      lighting: "warm gallery light, chiaroscuro modeling",
      palette: "earthy oil pigments, burnt sienna, ivory, deep umber",
      grain: "visible brushstrokes and canvas weave",
      aspect: "3:4 portrait",
      negative: "no text, no logos, no photograph, no 3d render, no distortion",
    },
  },
  {
    key: "concept_art",
    label: "Concept Art",
    description: "Cinematic key-art rendering, painterly digital, moody.",
    contract: {
      medium: "Cinematic concept-art character key frame, painterly digital rendering",
      lens: "medium-close composition, hero framing",
      lighting: "moody rim light, atmospheric haze, filmic contrast",
      palette: "muted teal shadows, warm amber highlights, desaturated mid-tones",
      grain: "subtle digital-paint texture",
      aspect: "3:4 portrait",
      negative: "no text, no logos, no watermark, no photograph, no anime, no distortion",
    },
  },
  {
    key: "graphic_comic",
    label: "Graphic Comic",
    description: "Inked comic-book panel, bold linework, flat shading.",
    contract: {
      medium: "Inked graphic-novel character panel",
      lens: "medium-close hero shot",
      lighting: "flat comic shading, bold cast shadows, halftone dots",
      palette: "saturated ink colors, high-contrast fills, black outlines",
      grain: "printed halftone dot texture",
      aspect: "3:4 portrait",
      negative:
        "no text, no speech bubbles, no logos, no photograph, no watermark, no distortion",
    },
  },
  {
    key: "anime_illustration",
    label: "Anime Illustration",
    description: "Modern anime key visual, clean linework, cel-shaded.",
    contract: {
      medium: "Modern anime key visual, cel-shaded illustration",
      lens: "portrait composition, expressive eyes",
      lighting: "clean cel shading, soft rim light",
      palette: "vibrant but harmonized anime palette",
      grain: "smooth digital cel texture",
      aspect: "3:4 portrait",
      negative: "no text, no logos, no photograph, no distortion, no extra limbs",
    },
  },
  {
    key: "watercolor",
    label: "Watercolor",
    description: "Soft watercolor portrait, paper texture, gentle bleeds.",
    contract: {
      medium: "Watercolor character portrait on cold-press paper",
      lens: "portrait composition",
      lighting: "soft natural light, gentle shadow washes",
      palette: "translucent watercolor pigments, muted and airy",
      grain: "paper texture and edge bleeds",
      aspect: "3:4 portrait",
      negative: "no text, no logos, no photograph, no distortion, no heavy black lines",
    },
  },
];

export const DEFAULT_CAST_STYLE_PRESET: CastStylePresetKey = "ultra_realistic";

export function getCastStylePreset(key: string | null | undefined): CastStylePreset {
  const found = CAST_STYLE_PRESETS.find((p) => p.key === key);
  return found ?? CAST_STYLE_PRESETS[0];
}
