import { t } from "@/lib/i18n/t";

export function ExperimentalBadge() {
  return (
    <span
      className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400"
      aria-label={t("collab.live.experimental")}
    >
      {t("collab.live.experimental")}
    </span>
  );
}
