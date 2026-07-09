import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { STORY_BEATS } from "@/components/editor/SceneBeatPicker";

/**
 * Quiet gutter-dot beat picker.
 *
 * Renders a single small dot in the left gutter of a scene-heading line.
 * - No beat set → hollow ring; only visible on row hover / focus / picker open.
 * - Beat set   → filled dot in the beat's color, always visible.
 * Click opens a popover with the full beat list plus "No beat" to clear.
 *
 * The trigger uses onMouseDown={preventDefault} so opening it does not steal
 * focus from the active textarea — matches the caret-preserving pattern used
 * by SceneHeadingChips / RecentCharacterChips.
 */
export function SceneBeatGutterDot({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (beat: string | null) => void;
}) {
  const active = STORY_BEATS.find((b) => b.value === value) ?? null;
  const hasBeat = !!active;

  return (
    <div className="absolute -left-5 top-2 z-10 font-sans">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            aria-label={hasBeat ? `Beat: ${active!.label}. Change` : "Set story beat"}
            title={hasBeat ? active!.label : "Set story beat"}
            className={[
              "flex items-center justify-center h-5 w-5 rounded-full transition-opacity",
              hasBeat
                ? "opacity-90 hover:opacity-100"
                : "opacity-0 group-hover:opacity-60 focus:opacity-100 hover:opacity-100 data-[state=open]:opacity-100",
            ].join(" ")}
          >
            {hasBeat ? (
              <span
                aria-hidden="true"
                className={`${active!.color} text-[13px] leading-none`}
              >
                ●
              </span>
            ) : (
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full border border-muted-foreground/60"
              />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="left"
          align="start"
          sideOffset={8}
          className="w-56 p-1 font-sans"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Story beat
          </div>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange(null)}
            className={`w-full text-left flex items-center gap-2 px-2 py-1.5 text-xs rounded-sm transition-colors ${
              !hasBeat ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <span className="h-2 w-2 rounded-full border border-muted-foreground/60" />
            <span>No beat</span>
          </button>
          {STORY_BEATS.map((b) => {
            const isActive = b.value === value;
            return (
              <button
                key={b.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onChange(b.value)}
                className={`w-full text-left flex items-center gap-2 px-2 py-1.5 text-xs rounded-sm transition-colors ${
                  isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                }`}
              >
                <span className={`${b.color} text-[13px] leading-none`} aria-hidden="true">
                  ●
                </span>
                <span>{b.label}</span>
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
    </div>
  );
}
