import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, X, ChevronDown, ChevronUp } from "lucide-react";
import { useCoachMode } from "@/hooks/use-coach-mode";
import { aiCoachCurrentScene } from "@/lib/academy.functions";

export function CoachPanel({ sceneText }: { sceneText: string }) {
  const { level, enabled } = useCoachMode();
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const coachFn = useServerFn(aiCoachCurrentScene);

  const run = useMutation({
    mutationFn: () =>
      coachFn({
        data: {
          sceneText: sceneText.slice(0, 16000),
          level: level === "off" ? "gentle" : level,
        },
      }),
    onSuccess: (r) => setOutput(r.text),
  });

  // Auto-coach on level=active or teaching when scene changes (debounced via effect)
  useEffect(() => {
    if (!enabled || level === "gentle") return;
    if (!sceneText || sceneText.length < 200) return;
    const t = setTimeout(() => run.mutate(), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneText, level]);

  if (!enabled || dismissed) return null;

  return (
    <Card className="p-3 border-primary/20 bg-primary/5">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">Coach</span>
        <span className="text-[10px] text-muted-foreground capitalize">· {level}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setDismissed(true)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {!collapsed && (
        <>
          {output ? (
            <div className="text-xs whitespace-pre-wrap text-foreground/85">{output}</div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">{run.isPending ? "Thinking…" : "Get a take on this scene."}</p>
              <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={() => run.mutate()} disabled={run.isPending || !sceneText}>
                Coach this scene
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
