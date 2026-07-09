import {
  SCENE_PREFIX_CHIPS,
  SCENE_TIME_CHIPS,
  applySlugPart,
  isSceneHeadingComplete,
} from "./screenplayAutoFormat";
import { t } from "@/lib/i18n/t";

const SCENE_PREFIX_RE = /^(int\.?\/ext\.?|i\/e\.?|int\.?|ext\.?|est\.?)\b/i;
const TIME_TAIL_RE =
  /(?:^|-\s*|\s)(DAY|NIGHT|CONTINUOUS|LATER|MORNING|EVENING|MOMENTS LATER|AFTERNOON|SUNRISE|SUNSET|DAWN|DUSK|SAME TIME)\s*$/i;

/**
 * Scene Heading chip strip.
 *
 * Hidden when the heading is already complete (PREFIX + LOCATION + TIME).
 * Renders a prefix row until the line has a valid INT./EXT./EST. prefix,
 * then swaps to a time-of-day row until a time token is present at the tail.
 */
export function SceneHeadingChips({
  value,
  onApply,
}: {
  value: string;
  onApply: (next: string) => void;
}) {
  if (isSceneHeadingComplete(value)) return null;

  const hasPrefix = SCENE_PREFIX_RE.test(value.trim());
  const hasTime = TIME_TAIL_RE.test(value.toUpperCase());

  // If prefix is missing → show prefix row. Otherwise if time missing → show time.
  const mode: "prefix" | "time" | null = !hasPrefix
    ? "prefix"
    : !hasTime
    ? "time"
    : null;
  if (!mode) return null;

  const chips = mode === "prefix" ? SCENE_PREFIX_CHIPS : SCENE_TIME_CHIPS;
  const ariaLabel =
    mode === "prefix"
      ? t("editor.chips.scene.prefixLabel")
      : t("editor.chips.scene.timeLabel");

  return (
    <div
      className="mt-1 mb-2 font-sans"
      role="toolbar"
      aria-label={ariaLabel}
      data-scene-chip-strip
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 pr-1">
          {ariaLabel}
        </span>
        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onApply(applySlugPart(value, chip, mode))}
            className="min-h-[32px] px-2.5 py-1 text-[11px] font-mono uppercase rounded-full border border-border/60 bg-background/60 hover:bg-primary/10 hover:border-primary/40 active:scale-[0.97] transition text-foreground"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
