import { t } from "@/lib/i18n/t";
import type { I18nKey } from "@/lib/i18n/keys";

export const ROLE_ORDER = [
  "owner",
  "co_writer",
  "editor",
  "producer",
  "commenter",
  "viewer",
  "actor_reader",
  "assistant",
] as const;

export type ProjectRole = (typeof ROLE_ORDER)[number];

export const INVITABLE_ROLES: ReadonlyArray<Exclude<ProjectRole, "owner">> =
  ROLE_ORDER.filter((r): r is Exclude<ProjectRole, "owner"> => r !== "owner");

const LABEL_KEY: Record<ProjectRole, I18nKey> = {
  owner: "collab.role.owner",
  co_writer: "collab.role.coWriter",
  editor: "collab.role.editor",
  producer: "collab.role.producer",
  commenter: "collab.role.commenter",
  viewer: "collab.role.viewer",
  actor_reader: "collab.role.actorReader",
  assistant: "collab.role.assistant",
};

const DESC_KEY: Record<ProjectRole, I18nKey> = {
  owner: "collab.role.owner.desc",
  co_writer: "collab.role.coWriter.desc",
  editor: "collab.role.editor.desc",
  producer: "collab.role.producer.desc",
  commenter: "collab.role.commenter.desc",
  viewer: "collab.role.viewer.desc",
  actor_reader: "collab.role.actorReader.desc",
  assistant: "collab.role.assistant.desc",
};

export function roleLabel(role: string): string {
  return (LABEL_KEY as Record<string, I18nKey>)[role]
    ? t(LABEL_KEY[role as ProjectRole])
    : role;
}

export function roleDescription(role: ProjectRole): string {
  return t(DESC_KEY[role]);
}
