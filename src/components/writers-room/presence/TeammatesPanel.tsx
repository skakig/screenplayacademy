import { useMemo, useState } from "react";
import { Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n/t";
import { useOptionalPresence } from "@/lib/presence/PresenceProvider";
import { presenceDisplayName } from "@/lib/presence/displayName";
import type { PresencePeer } from "@/lib/presence/types";
import { BLOCK_LABEL } from "@/lib/editor/autoFormat";
import { buildAuthorshipPalette } from "@/components/writers-room/arena/authorshipPalette";

import { PresenceAvatar } from "./PresenceAvatar";
import { ActiveAreaLabel } from "./ActiveAreaLabel";

interface Block {
  id: string;
  serverId?: string;
  block_type?: string;
  content?: string;
}

interface Props {
  projectId: string;
  /** Local editor blocks — used to resolve the block type each peer is on. */
  blocks: Block[];
  /** Optional externally controlled open state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** When true, renders its own trigger button. Set false to control externally. */
  withTrigger?: boolean;
}

/**
 * Right-side drawer listing every teammate currently connected to the
 * project, with the scene and block each one is editing. Pulls from the
 * presence channel; never fetches script text from peers.
 */
export function TeammatesPanel({
  projectId,
  blocks,
  open,
  onOpenChange,
  withTrigger = true,
}: Props) {
  const presence = useOptionalPresence();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const peers = presence?.peers ?? [];
  const others = useMemo(() => peers.filter((p) => !p.is_self), [peers]);
  const self = useMemo(() => peers.find((p) => p.is_self) ?? null, [peers]);
  const remoteCount = others.length;

  // Deterministic per-project palette shared with the caret rails so the
  // color for a given teammate matches across the two surfaces.
  const palette = useMemo(() => {
    const ids = others.map((p) => p.user_id).sort();
    return buildAuthorshipPalette(projectId, ids);
  }, [projectId, others]);

  // Index blocks by both stable local id and server id for O(1) lookup.
  const blockIndex = useMemo(() => {
    const m = new Map<string, Block>();
    for (const b of blocks) {
      if (b.id) m.set(b.id, b);
      if (b.serverId) m.set(b.serverId, b);
    }
    return m;
  }, [blocks]);

  const ordered = useMemo(() => {
    // Self first, then peers sorted by name.
    const rest = [...others].sort((a, b) =>
      presenceDisplayName(a).localeCompare(presenceDisplayName(b)),
    );
    return self ? [self, ...rest] : rest;
  }, [others, self]);

  const trigger = withTrigger ? (
    <SheetTrigger asChild>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        aria-label={t("collab.presence.teammates")}
      >
        <Users className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t("collab.presence.teammates")}</span>
        {remoteCount > 0 ? (
          <Badge
            variant="secondary"
            className="ml-0.5 h-4 min-w-4 px-1 text-[10px] leading-none rounded-full"
          >
            {remoteCount}
          </Badge>
        ) : null}
      </Button>
    </SheetTrigger>
  ) : null;

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      {trigger}
      <SheetContent side="right" className="w-[340px] p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border/50">
          <SheetTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            {t("collab.presence.teammatesTitle")}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {t("collab.presence.teammatesSubtitle")}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <ul className="divide-y divide-border/40">
            {ordered.length === 0 ? (
              <li className="px-4 py-6 text-sm text-muted-foreground italic text-center">
                {t("collab.presence.noOneOnline")}
              </li>
            ) : (
              ordered.map((peer) => (
                <TeammateRow
                  key={peer.user_id}
                  peer={peer}
                  block={peer.active_block_id ? blockIndex.get(peer.active_block_id) ?? null : null}
                  color={palette.get(peer.user_id)?.rail}
                />
              ))
            )}
          </ul>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function TeammateRow({
  peer,
  block,
  color,
}: {
  peer: PresencePeer;
  block: Block | null;
  color: string | undefined;
}) {
  const name = presenceDisplayName(peer);
  const typing = !!peer.is_typing_scene_id;
  const idle = !!peer.is_idle && !typing;
  const inScript = peer.active_area === "script";
  const blockLabel =
    block?.block_type && BLOCK_LABEL[block.block_type as keyof typeof BLOCK_LABEL]
      ? BLOCK_LABEL[block.block_type as keyof typeof BLOCK_LABEL]
      : block?.block_type ?? null;

  return (
    <li className={cn("flex items-start gap-3 px-4 py-3 transition-opacity", idle && "opacity-70")}>
      <div className="relative shrink-0">
        <PresenceAvatar peer={peer} size="md" ring={false} />
        {color && !peer.is_self ? (
          <span
            aria-hidden
            className="absolute -left-2 top-1 bottom-1 w-[3px] rounded-full"
            style={{ background: color, opacity: idle ? 0.5 : 1 }}
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium truncate">{name}</span>
          {peer.is_self ? (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("collab.presence.selfSuffix")}
            </span>
          ) : null}
          {typing ? (
            <Badge
              variant="secondary"
              className={cn("h-4 px-1.5 text-[10px] font-normal", "bg-primary/10 text-primary")}
            >
              {t("collab.presence.typingNow")}
            </Badge>
          ) : idle ? (
            <Badge
              variant="outline"
              className="h-4 px-1.5 text-[10px] font-normal text-muted-foreground border-border/60"
            >
              {t("collab.presence.idle")}
            </Badge>
          ) : null}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground truncate">
          <ActiveAreaLabel peer={peer} />
        </div>
        {inScript && blockLabel ? (
          <div className="mt-1 flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/70" aria-hidden />
            <span className="text-[11px] text-foreground/80">
              {t("collab.presence.onBlock", { blockLabel })}
            </span>
            {block?.content ? (
              <span className="text-[11px] text-muted-foreground truncate italic">
                — {block.content.slice(0, 48)}
                {block.content.length > 48 ? "…" : ""}
              </span>
            ) : null}
          </div>
        ) : peer.active_area !== "script" ? (
          <div className="mt-1 text-[11px] text-muted-foreground italic">
            {t("collab.presence.notOnScript")}
          </div>
        ) : null}
      </div>
    </li>
  );
}
