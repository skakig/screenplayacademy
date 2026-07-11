import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { setProjectVisualStyle } from "@/lib/characters.functions";

type Overrides = Partial<{
  medium: string;
  lens: string;
  lighting: string;
  palette: string;
  grain: string;
  era: string;
}>;

export function StyleContractDialog({
  open,
  onOpenChange,
  projectId,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  initial?: Overrides;
  onSaved?: (v: Overrides) => void;
}) {
  const [values, setValues] = useState<Overrides>(initial ?? {});
  const [saving, setSaving] = useState(false);
  const save = useServerFn(setProjectVisualStyle);

  const field = (k: keyof Overrides, label: string, placeholder: string) => (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input
        value={values[k] ?? ""}
        onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
        placeholder={placeholder}
      />
    </div>
  );

  const submit = async () => {
    setSaving(true);
    try {
      // Strip empty strings so the preset baseline shows through per field.
      const clean: Overrides = {};
      (Object.keys(values) as (keyof Overrides)[]).forEach((k) => {
        const val = values[k]?.trim();
        if (val) clean[k] = val;
      });
      await save({ data: { projectId, visualStyle: clean } });
      toast.success("Project visual style saved");
      onSaved?.(clean);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save visual style");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Project visual style</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Overrides fields on the selected cast style preset. Leave blank to keep the preset default.
        </p>
        <div className="grid grid-cols-2 gap-3 mt-2">
          {field("medium", "Medium", "35mm film photograph")}
          {field("lens", "Lens", "85mm portrait lens")}
          {field("lighting", "Lighting", "soft rembrandt key")}
          {field("palette", "Palette", "warm amber + teal")}
          {field("grain", "Grain / texture", "fine 400 ISO grain")}
          {field("era", "Era", "contemporary")}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>Save style</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
