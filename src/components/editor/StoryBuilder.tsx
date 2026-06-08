import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { generateStoryStarter } from "@/lib/editor/storyBuilder.functions";

type Props = {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function StoryBuilder({ projectId, open, onOpenChange, onSuccess }: Props) {
  const [genre, setGenre] = useState("");
  const [want, setWant] = useState("");
  const [force, setForce] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ logline: string; outline: { beat: string; summary: string }[]; characters_created: number } | null>(null);

  const qc = useQueryClient();
  const generate = useServerFn(generateStoryStarter);

  const run = async () => {
    if (!genre.trim() || !want.trim() || !force.trim()) {
      toast.error("Fill out all three fields first");
      return;
    }
    setBusy(true);
    try {
      const res = await generate({
        data: {
          projectId,
          genre: genre.trim(),
          protagonistWant: want.trim(),
          antagonistForce: force.trim(),
        },
      });
      setResult(res);
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["characters", projectId] });
      toast.success("Story spine ready");
      onSuccess?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't generate story");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Story Builder
          </DialogTitle>
          <DialogDescription>
            Three answers and SceneSmith will draft your logline, an 8-beat outline, and 3 starter characters. Edit anything after.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4" />
              <span>Your story spine is ready.</span>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Logline</Label>
              <p className="text-sm leading-relaxed">{result.logline}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Outline ({result.outline.length} beats)
              </Label>
              <ol className="text-sm space-y-1.5 list-decimal pl-5 max-h-48 overflow-auto">
                {result.outline.map((b, i) => (
                  <li key={i}><strong>{b.beat}.</strong> {b.summary}</li>
                ))}
              </ol>
            </div>
            <p className="text-xs text-muted-foreground">
              Created {result.characters_created} character{result.characters_created === 1 ? "" : "s"} in your cast.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setResult(null); }}>
                Try again
              </Button>
              <Button onClick={() => { onOpenChange(false); setResult(null); }}>
                Start writing
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sb-genre">Genre</Label>
              <Input
                id="sb-genre"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="Neo-noir thriller, coming-of-age, sci-fi horror…"
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sb-want">What does your protagonist want?</Label>
              <Textarea
                id="sb-want"
                value={want}
                onChange={(e) => setWant(e.target.value)}
                placeholder="To find her missing brother before the cartel does."
                rows={2}
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sb-force">What stands in their way?</Label>
              <Textarea
                id="sb-force"
                value={force}
                onChange={(e) => setForce(e.target.value)}
                placeholder="A corrupt sheriff who knows the truth and will burn the town to bury it."
                rows={2}
                disabled={busy}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={run} disabled={busy}>
                {busy ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Building…</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-1.5" />Build my story</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
