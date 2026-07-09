import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import { toast } from "sonner";
import {
  createVaultScene,
  updateVaultScene,
} from "@/lib/vault/vaultScenes.functions";
import {
  KIND_LABEL,
  POSITION_LABEL,
  STATUS_LABEL,
  VAULT_KINDS,
  VAULT_POSITIONS,
  VAULT_STATUSES,
  type VaultKind,
  type VaultPosition,
  type VaultStatus,
  type VaultSceneRow,
} from "@/lib/vault/schemas";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  scene?: VaultSceneRow | null;
  defaultKind?: VaultKind;
  characters?: Array<{ id: string; name: string }>;
};

export function VaultSceneDialog({
  open,
  onOpenChange,
  projectId,
  scene,
  defaultKind,
  characters = [],
}: Props) {
  const qc = useQueryClient();
  const createFn = useServerFn(createVaultScene);
  const updateFn = useServerFn(updateVaultScene);

  const [title, setTitle] = useState(scene?.title ?? "");
  const [kind, setKind] = useState<VaultKind>(scene?.kind ?? defaultKind ?? "vault_scene");
  const [content, setContent] = useState(scene?.content ?? "");
  const [notes, setNotes] = useState(scene?.notes ?? "");
  const [location, setLocation] = useState(scene?.location ?? "");
  const [tone, setTone] = useState(scene?.emotional_tone ?? "");
  const [position, setPosition] = useState<VaultPosition>(scene?.estimated_position ?? "unsure");
  const [status, setStatus] = useState<VaultStatus>(scene?.status ?? "vaulted");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(scene?.tags ?? []);
  const [selectedChars, setSelectedChars] = useState<string[]>(scene?.linked_character_ids ?? []);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        projectId,
        kind,
        title: title.trim() || "Untitled",
        content,
        notes,
        location: location || null,
        emotionalTone: tone || null,
        estimatedPosition: position,
        tags,
        status,
        linkedCharacterIds: selectedChars,
      };
      if (scene?.id) {
        await updateFn({ data: { id: scene.id, ...payload } });
      } else {
        await createFn({ data: payload });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vault-scenes", projectId] });
      toast.success(scene ? "Pinned back to the board" : "Pinned to the board");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (!tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {scene ? "Edit Vault Item" : "New Vault Item"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as VaultKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VAULT_KINDS.map((k) => <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as VaultStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VAULT_STATUSES.filter((s) => s !== "integrated").map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A moment worth keeping…" />
          </div>

          <div>
            <Label>Scene / Fragment</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              placeholder="Write the scene, the dialogue snippet, the set piece — however rough."
              className="font-mono text-sm"
            />
          </div>

          <div>
            <Label>Writer's Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              placeholder="Why you love it. What's missing. Where it might live." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Ivy's kitchen" />
            </div>
            <div>
              <Label>Emotional Tone</Label>
              <Input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="e.g. quiet dread" />
            </div>
          </div>

          <div>
            <Label>Estimated Story Position</Label>
            <Select value={position} onValueChange={(v) => setPosition(v as VaultPosition)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VAULT_POSITIONS.map((p) => <SelectItem key={p} value={p}>{POSITION_LABEL[p]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Press Enter to add"
              />
              <Button type="button" variant="outline" onClick={addTag}>Add</Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1">
                    {t}
                    <button onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {characters.length > 0 && (
            <div>
              <Label>Linked Characters</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {characters.map((c) => {
                  const on = selectedChars.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedChars(on ? selectedChars.filter((x) => x !== c.id) : [...selectedChars, c.id])}
                      className={`px-2.5 py-1 rounded-full text-xs border transition ${
                        on ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-border"
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Pinning…" : scene ? "Save" : "Pin to Board"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
