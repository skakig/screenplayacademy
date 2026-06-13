import { t } from "@/lib/i18n/t";
import { Check, Lock } from "lucide-react";

export function AccessRulesPanel() {
  const enabled = [
    t("collab.accessRules.enabled.invite"),
    t("collab.accessRules.enabled.roles"),
    t("collab.accessRules.upcoming.comments"),
  ];
  const upcoming = [
    t("collab.accessRules.upcoming.suggestions"),
    t("collab.accessRules.upcoming.locks"),
    t("collab.accessRules.upcoming.live"),
    t("collab.accessRules.upcoming.presence"),
  ];

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-6">
      <h3 className="font-display text-lg font-semibold mb-4">
        {t("collab.accessRules.title")}
      </h3>
      <div className="grid sm:grid-cols-2 gap-6 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            {t("collab.accessRules.enabled.title")}
          </p>
          <ul className="space-y-1.5">
            {enabled.map((label) => (
              <li key={label} className="flex items-start gap-2">
                <Check className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            {t("collab.accessRules.upcoming.title")}
          </p>
          <ul className="space-y-1.5">
            {upcoming.map((label) => (
              <li
                key={label}
                className="flex items-start gap-2 text-muted-foreground"
              >
                <Lock className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
