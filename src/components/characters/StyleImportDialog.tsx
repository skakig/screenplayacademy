// Reuse portrait + voice settings from another project's character.
// - Optionally applies the source project's Cast Style Preset + Style Contract.
// - Copies portrait fields (visual description/symbol, portrait url/path/seed,
//   movement style) and/or voice fields (ElevenLabs voice, voice summary,
//   voice style/archetype, humor/conflict style) onto the target character.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Import, Palette, Volume2, ImageIcon } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  listStyleSourceProjects,
  listStyleSourceCharacters,
  importProjectStyleSettings,
  importCharacterStyleFromSource,
} from "@/lib/characters.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targetProjectId: string;
  targetCharacterId: string;
};

export function StyleImportDialog({ open, onOpenChange, targetProjectId, targetCharacterId }: Props) {
  const qc = useQueryClient();
  const callListProjects = useServerFn(listStyleSourceProjects);
  const callListChars = useServerFn(listStyleSourceCharacters);
  const callImportProject = useServerFn(importProjectStyleSettings);
  const callImportCharacter = useServerFn(importCharacterStyleFromSource);

  const [sourceProjectId, setSourceProjectId] = useState<string>("");
  const [sourceCharacterId, setSourceCharacterId] = useState<string>("");
  const [includePortrait, setIncludePortrait] = useState(true);
  const [includeVoice, setIncludeVoice] = useState(true);
  const [includePreset, setIncludePreset] = useState(true);
  const [includeVisualStyle, setIncludeVisualStyle] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setSourceProjectId("");
      setSourceCharacterId("");
    }
  }, [open]);

  const { data: projects, isLoading: projectsLoading } = useQuery({
    enabled: open,
    queryKey: ["style-import-projects", targetProjectId],
    queryFn: () => callListProjects({ data: { excludeProjectId: targetProjectId } }),
  });

  const { data: characters, isLoading: charsLoading } = useQuery({
    enabled: open && !!sourceProjectId,
    queryKey: ["style-import-characters", sourceProjectId],
    queryFn: () => callListChars({ data: { sourceProjectId } }),
  });

  const selectedProject = useMemo(
    () => (projects ?? []).find((p) => p.id === sourceProjectId),
    [projects, sourceProjectId],
  );

  const canImport = !!sourceCharacterId && (includePortrait || includeVoice || includePreset || includeVisualStyle);

  async function handleImport() {
    if (!sourceCharacterId) return;
    setBusy(true);
    try {
      let projectApplied = false;
      if ((includePreset && selectedProject?.cast_style_preset) ||
          (includeVisualStyle && selectedProject?.has_visual_style)) {
        await callImportProject({
          data: {
            targetProjectId,
            sourceProjectId,
            includePreset,
            includeVisualStyle,
          },
        });
        projectApplied = true;
      }
      let updated = 0;
      if (includePortrait || includeVoice) {
        const res = await callImportCharacter({
          data: {
            targetCharacterId,
            sourceCharacterId,
            includePortrait,
            includeVoice,
          },
        });
        updated = res.updated ?? 0;
      }
      await qc.invalidateQueries({ queryKey: ["character", targetProjectId, targetCharacterId] });
      await qc.invalidateQueries({ queryKey: ["project-meta", targetProjectId] });
      toast.success(
        projectApplied
          ? `Applied project style and ${updated} character field(s).`
          : `Imported ${updated} field(s) onto this character.`,
      );
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Import className="h-4 w-4" /> Import character style
          </DialogTitle>
          <DialogDescription>
            Reuse portrait and voice settings from a character in another project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Source project</Label>
            <Select value={sourceProjectId} onValueChange={(v) => { setSourceProjectId(v); setSourceCharacterId(""); }}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder={projectsLoading ? "Loading…" : "Select a project"} />
              </SelectTrigger>
              <SelectContent>
                {(projects ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{p.title}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {p.cast_style_preset ? `Preset: ${p.cast_style_preset}` : "No preset"}
                        {p.has_visual_style ? " · Style contract" : ""}
                      </span>
                    </div>
                  </SelectItem>
                ))}
                {(projects ?? []).length === 0 && !projectsLoading && (
                  <div className="px-2 py-3 text-xs text-muted-foreground">No other projects available.</div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Source character</Label>
            <Select value={sourceCharacterId} onValueChange={setSourceCharacterId} disabled={!sourceProjectId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder={
                  !sourceProjectId ? "Pick a project first" :
                  charsLoading ? "Loading…" : "Select a character"
                } />
              </SelectTrigger>
              <SelectContent>
                {(characters ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {[c.role, c.archetype].filter(Boolean).join(" · ") || "—"}
                        {c.has_portrait ? " · portrait" : ""}
                        {c.has_voice ? " · voice" : ""}
                      </span>
                    </div>
                  </SelectItem>
                ))}
                {sourceProjectId && (characters ?? []).length === 0 && !charsLoading && (
                  <div className="px-2 py-3 text-xs text-muted-foreground">No characters in that project.</div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-border/60 bg-secondary/30 p-3 space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">What to import</div>
            <ImportRow
              icon={ImageIcon}
              label="Portrait fields"
              hint="Visual description, symbol, portrait image + seed, movement style."
              checked={includePortrait}
              onChange={setIncludePortrait}
            />
            <ImportRow
              icon={Volume2}
              label="Voice fields"
              hint="ElevenLabs voice, voice summary, voice/humor/conflict style, archetype."
              checked={includeVoice}
              onChange={setIncludeVoice}
            />
            <ImportRow
              icon={Palette}
              label="Cast Style Preset"
              hint={selectedProject?.cast_style_preset
                ? `Apply preset "${selectedProject.cast_style_preset}" to this project.`
                : "Source project has no preset set."}
              checked={includePreset}
              onChange={setIncludePreset}
              disabled={!selectedProject?.cast_style_preset}
            />
            <ImportRow
              icon={Palette}
              label="Style Contract"
              hint={selectedProject?.has_visual_style
                ? "Copy the source project's Style Contract overrides."
                : "Source project has no Style Contract."}
              checked={includeVisualStyle}
              onChange={setIncludeVisualStyle}
              disabled={!selectedProject?.has_visual_style}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={() => void handleImport()} disabled={!canImport || busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Import className="h-4 w-4 mr-1" />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportRow({
  icon: Icon, label, hint, checked, onChange, disabled,
}: {
  icon: any; label: string; hint: string;
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <label className={`flex items-start gap-3 rounded-md px-2 py-1.5 ${disabled ? "opacity-50" : "hover:bg-secondary/50 cursor-pointer"}`}>
      <Checkbox
        checked={checked && !disabled}
        disabled={disabled}
        onCheckedChange={(v) => onChange(!!v)}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>
      </div>
    </label>
  );
}
