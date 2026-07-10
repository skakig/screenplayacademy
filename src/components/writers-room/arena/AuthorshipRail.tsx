/**
 * AuthorshipRail — the visual cue for who wrote an Arena entry.
 *
 * Layout: a 3px colored rail on the left edge of the wrapping card, plus a
 * small avatar/initials chip and a name/role line. The card gets a very
 * light matching tint. Nothing about it competes with the screenplay text.
 *
 * Blind reveal:
 *   - When `blind` is true, we render the neutral slot, a generic silhouette
 *     glyph, and the anonymous label. Hover details are suppressed.
 *   - When results are unlocked (`blind={false}`), the writer's real name,
 *     role, and avatar appear, and the hover popover shows a longer detail
 *     panel.
 */
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserRound } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { I18nKey } from "@/lib/i18n/keys";
import { roleLabel } from "@/components/writers-room/roles";
import type { AuthorshipColor } from "./authorshipPalette";
import { NEUTRAL_AUTHORSHIP_COLOR, initialsFor } from "./authorshipPalette";

export interface AuthorshipRailProps {
  color: AuthorshipColor;
  /** Human-readable writer name. Ignored when `blind`. */
  displayName: string;
  /** Avatar URL from the profile. Ignored when `blind`. */
  avatarUrl?: string | null;
  /** Project role, e.g. "co_writer". Ignored when `blind`. */
  role?: string | null;
  /** Anonymous label shown while blinded (e.g. "Writer #2"). */
  anonymousLabel?: string;
  /** True while identity is redacted (voting on a blind round). */
  blind?: boolean;
  /** True if this row belongs to the current user (shown as "You"). */
  isSelf?: boolean;
  /** Optional right-aligned metadata slot (e.g. status pill). */
  meta?: React.ReactNode;
  children: React.ReactNode;
}

export function AuthorshipRail({
  color,
  displayName,
  avatarUrl,
  role,
  anonymousLabel,
  blind,
  isSelf,
  meta,
  children,
}: AuthorshipRailProps) {
  const effective = blind ? NEUTRAL_AUTHORSHIP_COLOR : color;
  const shownName = blind
    ? (anonymousLabel ?? t("arena.identity.hidden"))
    : isSelf
      ? t("arena.identity.you")
      : displayName || t("arena.identity.unknown");
  const initials = blind ? "" : initialsFor(shownName === t("arena.identity.you") ? displayName || "?" : shownName);

  const chip = (
    <div
      className="flex items-center gap-2.5 min-w-0 rounded-md px-1.5 py-1 -ml-1.5 hover:bg-muted/40 transition-colors"
      aria-label={
        blind
          ? t("arena.identity.hiddenAria")
          : t("arena.identity.byAria", { name: shownName })
      }
    >
      <Avatar className="h-6 w-6 shrink-0 ring-1 ring-border/50">
        {!blind && avatarUrl ? (
          <AvatarImage src={avatarUrl} alt="" />
        ) : null}
        <AvatarFallback
          className="text-[10px] font-semibold"
          style={{ backgroundColor: effective.chip, color: effective.chipFg }}
        >
          {blind ? <UserRound className="h-3 w-3" aria-hidden /> : initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="text-xs font-medium truncate leading-tight">
          {shownName}
        </div>
        {!blind && role ? (
          <div className="text-[10px] text-muted-foreground truncate leading-tight">
            {roleLabel(role)}
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      className="relative rounded-lg border border-border/60 overflow-hidden"
      style={{ backgroundColor: effective.tint }}
    >
      <div
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: effective.rail }}
      />
      <div className="pl-4 pr-3 py-3">
        <div className="flex items-center justify-between gap-3 mb-2">
          {blind ? (
            chip
          ) : (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                >
                  {chip}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="start">
                <AuthorshipDetail
                  color={effective}
                  displayName={displayName}
                  avatarUrl={avatarUrl}
                  role={role}
                  isSelf={isSelf}
                />
              </PopoverContent>
            </Popover>
          )}
          {meta ? <div className="shrink-0">{meta}</div> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

function AuthorshipDetail({
  color,
  displayName,
  avatarUrl,
  role,
  isSelf,
}: {
  color: AuthorshipColor;
  displayName: string;
  avatarUrl?: string | null;
  role?: string | null;
  isSelf?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-10 w-10 ring-1 ring-border/60">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback
          className="text-xs font-semibold"
          style={{ backgroundColor: color.chip, color: color.chipFg }}
        >
          {initialsFor(displayName || "?")}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">
          {displayName || t("arena.identity.unknown")}
          {isSelf ? (
            <span className="ml-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("arena.identity.youChip")}
            </span>
          ) : null}
        </div>
        {role ? (
          <div className="text-xs text-muted-foreground truncate">
            {roleLabel(role)}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            {t("arena.identity.roleUnknown")}
          </div>
        )}
      </div>
    </div>
  );
}

// re-export for I18nKey typing convenience — silences unused-import warnings
// when this file is consumed from lists that don't touch I18nKey directly.
export type { I18nKey };
