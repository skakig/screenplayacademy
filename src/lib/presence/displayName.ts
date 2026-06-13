import { t } from "@/lib/i18n/t";
import type { ProjectPresenceState } from "./types";

/**
 * Name fallback chain. Never leaks raw UUIDs.
 *   display_name → email local-part → t("collab.presence.collaborator")
 */
export function presenceDisplayName(p: Pick<ProjectPresenceState, "display_name" | "email">): string {
  const name = (p.display_name ?? "").trim();
  if (name) return name;
  const email = (p.email ?? "").trim();
  if (email) {
    const local = email.split("@")[0];
    if (local) return local;
  }
  return t("collab.presence.collaborator");
}

export function presenceInitials(p: Pick<ProjectPresenceState, "display_name" | "email">): string {
  const name = presenceDisplayName(p);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
