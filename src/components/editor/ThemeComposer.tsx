import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, Check, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { aiAssist } from "@/lib/ai.functions";
import { toast } from "sonner";

type Props = {
  projectId: string;
  initialTheme: string | null | undefined;
  projectContext: string;
};

export function ThemeComposer({ projectId, initialTheme, projectContext }: Props) {
  const qc = useQueryClient();
  const callAi = useServerFn(aiAssist);
  const [val, setVal] = useState(initialTheme ?? "");
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => { setVal(initialTheme ?? ""); }, [initialTheme]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("projects").update({ theme: val }).eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["first-screenplay", projectId] });
      toast.success("Theme saved");
    },
    onError: (e: any) => toast.error(e.message ?? "Couldn't save theme"),
  });

  const generate = useMutation({
    mutationFn: async () => {
      const res = await callAi({ data: { projectId, tool: "Suggest themes", prompt: "Suggest 5 distinct thematic statements (moral arguments, not topics). Each as one sentence. Return as a numbered list.", context: projectContext } });
      return res.text;
    },
    onSuccess: (text) => {
      const lines = text.split("\n").map((l) => l.replace(/^\s*\d+[\.\)]\s*/, "").trim()).filter(Boolean).slice(0, 5);
      setOptions(lines);
    },
    onError: (e: any) => toast.error(e.message ?? "AI request failed"),
  });

  return (
    <div className="max-w-[680px] mx-auto mb-6 font-sans">
      <div className="rounded-lg border border-border bg-card/50 p-4 lg:p-5 space-y-3">
        <div>
          <h3 className="font-semibold">Choose your theme</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            One sentence — a moral argument, not a topic. Example: "Mercy costs more than vengeance, and is worth it."
          </p>
        </div>
        <Textarea
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="Mercy costs more than vengeance, and is worth it."
          className="min-h-[80px]"
        />
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <Button size="sm" variant="outline" onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
            Suggest 5 themes
          </Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || !val.trim()}>
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            Save theme
          </Button>
        </div>

        {options.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pick one to edit</div>
            {options.map((opt, i) => (
              <button
                key={i}
                onClick={() => setVal(opt)}
                className="w-full text-left rounded-md border border-border bg-background/50 hover:border-primary/50 hover:bg-primary/[0.04] p-3 text-sm transition"
              >
                <Check className="h-3 w-3 text-primary inline mr-2" />
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
