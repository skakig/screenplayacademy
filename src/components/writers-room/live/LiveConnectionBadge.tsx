import { t } from "@/lib/i18n/t";
import type { LiveConnectionState } from "@/lib/live-collab/types";

interface Props {
  state: LiveConnectionState;
}

export function LiveConnectionBadge({ state }: Props) {
  const map: Record<
    LiveConnectionState,
    { label: string; tone: string }
  > = {
    idle: {
      label: t("collab.live.disconnected"),
      tone: "bg-muted text-muted-foreground",
    },
    connecting: {
      label: t("collab.live.reconnecting"),
      tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    },
    connected: {
      label: t("collab.live.connected"),
      tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    },
    reconnecting: {
      label: t("collab.live.reconnecting"),
      tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    },
    disconnected: {
      label: t("collab.live.disconnected"),
      tone: "bg-muted text-muted-foreground",
    },
    paused: {
      label: t("collab.live.paused"),
      tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    },
  };
  const { label, tone } = map[state];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}
