import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target } from "lucide-react";

export const STORY_BEATS = [
  { value: "setup", label: "Setup", color: "text-blue-500" },
  { value: "inciting", label: "Inciting Incident", color: "text-amber-500" },
  { value: "rising", label: "Rising Action", color: "text-orange-500" },
  { value: "midpoint", label: "Midpoint", color: "text-purple-500" },
  { value: "crisis", label: "Crisis / Dark Night", color: "text-red-500" },
  { value: "climax", label: "Climax", color: "text-rose-500" },
  { value: "resolution", label: "Resolution", color: "text-emerald-500" },
] as const;

export function SceneBeatPicker({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (beat: string | null) => void;
}) {
  return (
    <Select
      value={value ?? "__none"}
      onValueChange={(v) => onChange(v === "__none" ? null : v)}
    >
      <SelectTrigger className="h-6 px-2 text-[10px] gap-1 border-dashed bg-background/40 hover:bg-background w-auto min-w-[100px] font-sans">
        <Target className="h-3 w-3 text-muted-foreground" />
        <SelectValue placeholder="Beat" />
      </SelectTrigger>
      <SelectContent className="font-sans">
        <SelectItem value="__none" className="text-xs text-muted-foreground">No beat</SelectItem>
        {STORY_BEATS.map((b) => (
          <SelectItem key={b.value} value={b.value} className="text-xs">
            <span className={b.color}>●</span> <span className="ml-1">{b.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
