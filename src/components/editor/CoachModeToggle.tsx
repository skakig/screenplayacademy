import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOnboarding } from "@/hooks/use-onboarding";
import { upsertOnboarding } from "@/lib/onboarding.functions";
import { Sparkles } from "lucide-react";

export function CoachModeToggle() {
  const qc = useQueryClient();
  const { data } = useOnboarding();
  const upsertFn = useServerFn(upsertOnboarding);
  const mutate = useMutation({
    mutationFn: (v: "off" | "gentle" | "active" | "teaching") => upsertFn({ data: { coaching_level: v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding"] }),
  });
  const value = (data?.coaching_level ?? "gentle") as "off" | "gentle" | "active" | "teaching";
  return (
    <div className="flex items-center gap-1.5">
      <Sparkles className="h-3.5 w-3.5 text-primary" />
      <span className="text-xs text-muted-foreground">Director</span>
      <Select value={value} onValueChange={(v: "off" | "gentle" | "active" | "teaching") => mutate.mutate(v)}>
        <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="off">Off</SelectItem>
          <SelectItem value="gentle">Gentle</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="teaching">Teaching</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
