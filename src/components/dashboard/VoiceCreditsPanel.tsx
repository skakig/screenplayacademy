import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic2, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { openCreditsDialog } from "@/hooks/useCreditsUpsell";

interface UsageRow {
  feature: string;
  used: number;
  monthly_limit: number;
  tier: string;
  credits_remaining: number;
}

function nextMonthlyResetUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

function formatResetDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(d: Date): number {
  return Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86_400_000));
}

const ROWS: Array<{ feature: string; label: string; unit: string }> = [
  { feature: "tts_characters", label: "Table read characters", unit: "chars" },
  { feature: "tableread_minutes", label: "Table read minutes", unit: "min" },
];

export function VoiceCreditsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["usage-snapshot", "voice"],
    queryFn: async (): Promise<UsageRow[]> => {
      const { data, error } = await supabase.rpc("get_usage_snapshot", { _environment: "live" });
      if (error) throw error;
      return (data ?? []) as UsageRow[];
    },
    staleTime: 30_000,
  });

  const reset = nextMonthlyResetUtc();
  const rows = ROWS.map((r) => ({
    ...r,
    row: (data ?? []).find((d) => d.feature === r.feature),
  }));

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Mic2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold leading-tight">Voice &amp; table read credits</h2>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
              <CalendarClock className="h-3 w-3" />
              Resets {formatResetDate(reset)} · in {daysUntil(reset)} day{daysUntil(reset) === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => openCreditsDialog("tts_characters")}>
          Top up
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading credits…</p>
      ) : (
        <div className="space-y-3">
          {rows.map(({ feature, label, unit, row }) => {
            const used = row?.used ?? 0;
            const limit = row?.monthly_limit ?? 0;
            const credits = row?.credits_remaining ?? 0;
            const planRemaining = Math.max(0, limit - used);
            const totalRemaining = planRemaining + credits;
            const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
            const depleted = planRemaining === 0 && credits === 0 && limit > 0;
            const notIncluded = limit === 0 && credits === 0;
            return (
              <div key={feature} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-foreground/80">{label}</span>
                  <span className={depleted ? "text-amber-500 font-medium" : "text-muted-foreground"}>
                    {notIncluded
                      ? "Not on current plan"
                      : `${totalRemaining.toLocaleString()} ${unit} left`}
                  </span>
                </div>
                {!notIncluded && (
                  <>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={"h-full transition-all " + (depleted ? "bg-amber-500" : "bg-primary")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>
                        {used.toLocaleString()} / {limit.toLocaleString()} plan
                      </span>
                      {credits > 0 && <span>+{credits.toLocaleString()} top-up credits</span>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Top-up credits kick in automatically once your monthly plan cap is reached and never expire.
      </p>
    </Card>
  );
}
