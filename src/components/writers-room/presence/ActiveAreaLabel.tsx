import { t } from "@/lib/i18n/t";
import type { PresenceArea, PresencePeer } from "@/lib/presence/types";

export function areaLabel(area: PresenceArea, sceneLabel?: string | null): string {
  switch (area) {
    case "script":
      return t("collab.presence.viewingScript");
    case "writers_room":
      return t("collab.presence.inWritersRoom");
    case "comments":
      return t("collab.presence.reviewingComments");
    case "assignments":
      return t("collab.presence.viewingAssignments");
    case "suggestions":
      return t("collab.presence.reviewingSuggestions");
    case "pitch":
      return t("collab.presence.inWritersRoom");
    case "settings":
      return t("collab.presence.inSettings");
    case "unknown":
    default:
      return t("collab.presence.unknownArea");
  }
}

export function ActiveAreaLabel({ peer }: { peer: PresencePeer }) {
  if (peer.active_scene_label) {
    return (
      <span>
        {t("collab.presence.viewingScene", { scene: peer.active_scene_label })}
      </span>
    );
  }
  return <span>{areaLabel(peer.active_area)}</span>;
}
