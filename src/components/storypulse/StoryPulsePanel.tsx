import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import { getStoryPulse } from "@/lib/storypulse.functions";
import { STORY_BEATS_KEYS, STORY_BEAT_LABELS, type StoryBeatKey } from "@/lib/storypulse.shared";
import { FileText, MessageSquare, Users, Target, Sparkles } from "lucide-react";

export function StoryPulsePanel({ projectId }: { projectId: string }) {
  const fn = useServerFn(getStoryPulse);
  const { data, isLoading } = useQuery({
    queryKey: ["story-pulse", projectId],
    queryFn: () => fn({ data: { projectId } }),
    refetchOnWindowFocus: false,
  });

  if (isLoading || !data) {
    return (
      <Card className="p-4 bg-card/40 border-border/60">
        <p className="text-xs text-muted-foreground">Reading your script…</p>
      </Card>
    );
  }

  if (data.empty) {
    return (
      <Card className="p-4 bg-card/40 border-dashed border-border/60">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-sm">No script yet. <Link to="/editor/$projectId" params={{ projectId }} className="text-primary underline">Open the editor</Link> to start writing — your StoryPulse fills in as you go.</p>
        </div>
      </Card>
    );
  }

  const { totals, beatDistribution, characterScreenTime } = data;
  const maxBeat = Math.max(1, ...Object.values(beatDistribution));
  const dialoguePct = Math.round(totals.dialogueRatio * 100);

  return (
    <Card className="p-4 bg-card/40 border-border/60 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">From your script</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">
          Live from the editor · refreshes when you save
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat icon={<FileText className="h-3.5 w-3.5" />} label="Pages" value={totals.pages.toString()} hint={`≈ ${Math.round(totals.pages)} min`} />
        <Stat icon={<Target className="h-3.5 w-3.5" />} label="Scenes" value={totals.scenes.toString()} hint={`${totals.scenesWithBeats} with a beat`} />
        <Stat icon={<MessageSquare className="h-3.5 w-3.5" />} label="Dialogue" value={`${dialoguePct}%`} hint={`${totals.dialogueLines} lines`} />
        <Stat icon={<Users className="h-3.5 w-3.5" />} label="Speaking cast" value={characterScreenTime.length.toString()} hint={characterScreenTime[0]?.name ? `top: ${characterScreenTime[0].name}` : "—"} />
      </div>

      {/* Beat coverage */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Beat coverage</p>
          <Link to="/editor/$projectId" params={{ projectId }} className="text-[10px] text-primary hover:underline ml-auto">
            Assign beats in editor →
          </Link>
        </div>
        <div className="flex items-end gap-1.5 h-12">
          {STORY_BEATS_KEYS.map((key: StoryBeatKey) => {
            const count = beatDistribution[key] ?? 0;
            const heightPct = (count / maxBeat) * 100;
            return (
              <div key={key} className="flex-1 flex flex-col items-center gap-1 justify-end h-full" title={`${STORY_BEAT_LABELS[key]}: ${count}`}>
                <div
                  className={`w-full rounded-sm transition-all ${count > 0 ? "bg-primary/60" : "bg-muted/40 border border-dashed border-border/60"}`}
                  style={{ height: count > 0 ? `${Math.max(8, heightPct)}%` : "8%" }}
                />
                <span className="text-[9px] text-muted-foreground truncate w-full text-center leading-tight">
                  {STORY_BEAT_LABELS[key]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Character screen time */}
      {characterScreenTime.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Character screen time (dialogue lines)</p>
          <div className="space-y-1">
            {characterScreenTime.slice(0, 5).map((c) => {
              const max = characterScreenTime[0].lines || 1;
              const pct = Math.max(4, Math.round((c.lines / max) * 100));
              return (
                <div key={c.name} className="flex items-center gap-2 text-[11px]">
                  <span className="w-24 truncate uppercase tracking-wide text-foreground/80">{c.name}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted/60 overflow-hidden">
                    <div className="h-full bg-primary/70 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-10 text-right text-muted-foreground tabular-nums">{c.lines}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-background/40 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-lg font-semibold tabular-nums mt-0.5">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground truncate">{hint}</p>}
    </div>
  );
}
