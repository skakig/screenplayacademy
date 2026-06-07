import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowRight, Activity } from "lucide-react";
import { toast } from "sonner";
import { upsertCharacterArc } from "@/lib/arc.functions";
import { useAutosave } from "@/hooks/use-autosave";
import { SaveStatus } from "./SaveStatus";
import { TMHBadge } from "./TMHBadge";
import { tmhLabel, tmhVar } from "./tmh";

const ARC_TYPES = [
  "Transformation",
  "Fall",
  "Flat / Tested",
  "Redemption",
  "Corruption",
  "Tragedy",
  "Coming of Age",
];

const TEXT_FIELDS: { key: string; label: string; placeholder?: string }[] = [
  { key: "starting_belief", label: "Starting belief", placeholder: "What they believe to be true at the start" },
  { key: "ending_belief", label: "Ending belief", placeholder: "What they believe to be true at the end" },
  { key: "core_lie", label: "Core lie", placeholder: "The lie they live by" },
  { key: "truth_learned", label: "Truth learned", placeholder: "The truth they finally see" },
  { key: "temptation", label: "Temptation", placeholder: "The easy / corrupt path offered" },
  { key: "moral_test", label: "Moral test", placeholder: "The choice that exposes their character" },
  { key: "climax_choice", label: "Climax choice", placeholder: "The decisive act in the climax" },
  { key: "final_image", label: "Final image", placeholder: "The closing image that proves the arc" },
];

const TMH_SLIDERS: { key: string; label: string }[] = [
  { key: "starting_tmh_level", label: "Start" },
  { key: "midpoint_tmh_level", label: "Midpoint" },
  { key: "ending_tmh_level", label: "End" },
  { key: "regression_level", label: "Regression (lowest dip)" },
];

export function CharacterArcSection({
  projectId,
  characterId,
}: {
  projectId: string;
  characterId: string;
}) {
  const qc = useQueryClient();
  const callUpsert = useServerFn(upsertCharacterArc);

  const { data: arc, isLoading } = useQuery({
    queryKey: ["character-arc", characterId],
    refetchOnMount: "always",
    queryFn: async (): Promise<any> => {
      const { data } = await supabase
        .from("character_arcs")
        .select("*")
        .eq("character_id", characterId)
        .maybeSingle();
      return data ?? {};
    },
  });

  const [local, setLocal] = useState<any>({});
  useEffect(() => { setLocal(arc ?? {}); }, [arc]);

  const autosave = useAutosave<any>({
    local,
    remote: arc,
    enabled: !isLoading,
    onSave: async (patch) => {
      await callUpsert({ data: { project_id: projectId, character_id: characterId, patch } });
      qc.invalidateQueries({ queryKey: ["character-arc", characterId] });
    },
  });

  const set = (patch: any) => setLocal((l: any) => ({ ...l, ...patch }));

  const start = local.starting_tmh_level as number | undefined;
  const mid = local.midpoint_tmh_level as number | undefined;
  const end = local.ending_tmh_level as number | undefined;
  const regress = local.regression_level as number | undefined;
  const anyTmh = !!(start || mid || end);

  return (
    <Card className="p-4 space-y-5">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h3 className="font-display text-base">Character Arc</h3>
        {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        <div className="ml-auto"><SaveStatus status={autosave.status} lastSavedAt={autosave.lastSavedAt} onRetry={() => void autosave.saveNow()} /></div>
      </div>

      {/* Arc type */}
      <div>
        <Label className="text-xs">Arc type</Label>
        <Select
          value={local.arc_type ?? ""}
          onValueChange={(v) => { set({ arc_type: v }); }}
        >
          <SelectTrigger><SelectValue placeholder="Choose an arc shape" /></SelectTrigger>
          <SelectContent>
            {ARC_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* TMH movement preview */}
      <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-3 space-y-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">TMH movement</div>
        {anyTmh ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <ArcPoint label="Start" level={start} />
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <ArcPoint label="Midpoint" level={mid} />
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <ArcPoint label="End" level={end} />
              {regress ? (
                <span className="ml-2 text-[10px] text-muted-foreground">
                  regress dip: <TMHBadge level={regress} />
                </span>
              ) : null}
            </div>
            <TmhSparkline start={start} mid={mid} end={end} />
            <p className="text-[11px] text-muted-foreground">
              {summarizeMovement(start, end)}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Set TMH levels below to preview the moral arc.</p>
        )}
      </div>

      {/* TMH sliders */}
      <div className="grid grid-cols-2 gap-4">
        {TMH_SLIDERS.map(({ key, label }) => (
          <div key={key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{label}</Label>
              <TMHBadge level={local[key]} />
            </div>
            <Slider
              min={1} max={9} step={1}
              value={[local[key] ?? 5]}
              onValueChange={(v) => set({ [key]: v[0] })}
              onValueCommit={() => { void autosave.saveNow(); }}
              disabled={isLoading}
            />
            <p className="text-[10px] text-muted-foreground">{tmhLabel(local[key])}</p>
          </div>
        ))}
      </div>

      {/* Text fields */}
      <div className="grid grid-cols-2 gap-3">
        {TEXT_FIELDS.map(({ key, label, placeholder }) => (
          <div key={key}>
            <Label className="text-xs">{label}</Label>
            <Textarea
              value={local[key] ?? ""}
              rows={2}
              placeholder={placeholder}
              onChange={(e) => set({ [key]: e.target.value })}
              onBlur={() => { void autosave.saveNow(); }}
              disabled={isLoading}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

function ArcPoint({ label, level }: { label: string; level?: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <TMHBadge level={level} />
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}

function summarizeMovement(start?: number, end?: number): string {
  if (!start || !end) return "Add a start and end level to score the arc shape.";
  const delta = end - start;
  if (delta >= 3) return `Strong ascent (+${delta}). Transformation / Redemption shape.`;
  if (delta <= -3) return `Strong descent (${delta}). Fall / Corruption shape.`;
  if (delta > 0) return `Subtle rise (+${delta}). Tested but moving toward integrity.`;
  if (delta < 0) return `Subtle slip (${delta}). Pressure is winning.`;
  return "Flat arc — character is tested but does not move morally.";
}

function TmhSparkline({ start, mid, end }: { start?: number; mid?: number; end?: number }) {
  const W = 240, H = 64, PAD = 8;
  const points = [
    { x: PAD, level: start, label: "S" },
    { x: W / 2, level: mid, label: "M" },
    { x: W - PAD, level: end, label: "E" },
  ].filter((p) => !!p.level) as { x: number; level: number; label: string }[];
  if (points.length === 0) return null;
  const y = (level: number) => H - PAD - ((level - 1) / 8) * (H - PAD * 2);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${y(p.level)}`).join(" ");
  const endLevel = end ?? points[points.length - 1].level;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16">
      {/* baseline grid for L1, L5, L9 */}
      {[1, 5, 9].map((l) => (
        <line key={l} x1={0} x2={W} y1={y(l)} y2={y(l)} stroke="var(--border)" strokeDasharray="2 3" opacity={0.6} />
      ))}
      <path d={path} fill="none" stroke={tmhVar(endLevel)} strokeWidth={2} />
      {points.map((p) => (
        <g key={p.label}>
          <circle cx={p.x} cy={y(p.level)} r={4} fill={tmhVar(p.level)} stroke="var(--background)" strokeWidth={1.5} />
        </g>
      ))}
    </svg>
  );
}
