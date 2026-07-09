import { t } from "@/lib/i18n/t";
import type { LocalBlock } from "./useScreenplayDocument";

/**
 * Walk backward from the active block, collect distinct non-empty
 * uppercased character names in "most recent first" order, cap at max.
 */
export function collectRecentSpeakers(
  blocks: LocalBlock[],
  activeId: string | null,
  max = 5,
): string[] {
  if (!activeId) return [];
  const idx = blocks.findIndex((b) => b.id === activeId);
  if (idx < 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = idx - 1; i >= 0 && out.length < max; i--) {
    const b = blocks[i];
    if (b.block_type !== "character") continue;
    const name = (b.content ?? "").trim().toUpperCase();
    // Exclude blanks and any string that clearly isn't a name (contains
    // sentence punctuation or is longer than 40 chars).
    if (!name) continue;
    if (name.length > 40) continue;
    if (/[.!?]/.test(name.replace(/\((?:V\.O\.|O\.S\.|CONT'D)\)/g, ""))) continue;
    // Strip trailing modifiers like (V.O.) for the chip label but keep unique key by base name.
    const base = name.replace(/\s*\(.*\)\s*$/, "").trim();
    if (!base) continue;
    if (seen.has(base)) continue;
    seen.add(base);
    out.push(base);
  }
  return out;
}

/**
 * Recent Character chip strip.
 *
 * Renders only when the active character block is empty. Tapping a chip
 * fills the current block with the name and triggers Enter semantics
 * (caller advances to a fresh dialogue block).
 */
export function RecentCharacterChips({
  blocks,
  activeId,
  onPick,
}: {
  blocks: LocalBlock[];
  activeId: string | null;
  onPick: (name: string) => void;
}) {
  const names = collectRecentSpeakers(blocks, activeId, 5);
  if (names.length === 0) return null;

  const label = t("editor.chips.character.recentLabel");

  return (
    <div
      className="mt-1 mb-2 font-sans"
      role="toolbar"
      aria-label={label}
      data-character-chip-strip
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 pr-1">
          {label}
        </span>
        {names.map((name) => (
          <button
            key={name}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(name)}
            className="min-h-[32px] px-2.5 py-1 text-[11px] font-mono uppercase rounded-full border border-border/60 bg-background/60 hover:bg-primary/10 hover:border-primary/40 active:scale-[0.97] transition text-foreground"
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
