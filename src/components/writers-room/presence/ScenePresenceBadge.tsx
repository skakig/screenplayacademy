import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n/t";
import { useOptionalPresence } from "@/lib/presence/PresenceProvider";
import { presenceDisplayName } from "@/lib/presence/displayName";

interface Props {
  sceneId: string;
}

/**
 * Tiny scene-level presence badge. Shows "viewing this scene" /
 * "editing this scene" using debounced, scene-level signals only —
 * never per-keystroke cursor or selection.
 */
export function ScenePresenceBadge({ sceneId }: Props) {
  const presence = useOptionalPresence();

  const { viewers, typers } = useMemo(() => {
    if (!presence) return { viewers: [], typers: [] };
    const others = presence.peers.filter((p) => !p.is_self);
    return {
      viewers: others.filter((p) => p.active_scene_id === sceneId),
      typers: others.filter((p) => p.is_typing_scene_id === sceneId),
    };
  }, [presence, sceneId]);

  if (!presence || (viewers.length === 0 && typers.length === 0)) return null;

  const primary = typers[0] ?? viewers[0];
  const name = presenceDisplayName(primary);
  const isTyping = !!typers[0];
  const extra = viewers.length + typers.length - 1;

  const label = isTyping
    ? t("collab.presence.typingInScene", { name })
    : t("collab.presence.viewingScene", { scene: name });

  return (
    <Badge variant="outline" className="font-normal text-xs text-muted-foreground border-border/60">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {label}
        {extra > 0 && <span className="text-muted-foreground/70">+{extra}</span>}
      </span>
    </Badge>
  );
}
