import { Badge } from "@/components/ui/badge";

const COLORS: Record<string, string> = {
  Strong: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  "Needs Work": "bg-amber-500/15 text-amber-300 border-amber-500/40",
  "Missing Turn": "bg-orange-500/15 text-orange-300 border-orange-500/40",
  "No Stakes Change": "bg-orange-500/15 text-orange-300 border-orange-500/40",
  "No Character Movement": "bg-orange-500/15 text-orange-300 border-orange-500/40",
  Unreviewed: "bg-muted text-muted-foreground border-border",
};

export function ArcStatusBadge({ status, score }: { status?: string | null; score?: number | null }) {
  const s = status || "Unreviewed";
  return (
    <Badge variant="outline" className={`${COLORS[s] || COLORS.Unreviewed} font-sans text-[10px] uppercase tracking-wider`}>
      {s}{typeof score === "number" ? ` · ${score}` : ""}
    </Badge>
  );
}
