import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { upsertRelationship, deleteRelationship } from "@/lib/characters.functions";

const REL_TYPES = ["Lover","Spouse","Ex","Family","Friend","Mentor","Rival","Enemy","Boss","Subordinate","Ally","Stranger","Other"];

export function RelationshipsTab({ projectId, characterId }: { projectId: string; characterId: string }) {
  const qc = useQueryClient();
  const callUpsert = useServerFn(upsertRelationship);
  const callDel = useServerFn(deleteRelationship);

  const { data: chars = [] } = useQuery({
    queryKey: ["characters", projectId],
    queryFn: async () => (await supabase.from("characters").select("id, name").eq("project_id", projectId)).data ?? [],
  });
  const { data: rels = [], refetch } = useQuery({
    queryKey: ["relationships", characterId],
    queryFn: async () => (await supabase.from("character_relationships").select("*").eq("character_id", characterId)).data ?? [],
  });

  const [draft, setDraft] = useState<any>(null);

  const save = useMutation({
    mutationFn: async (r: any) => callUpsert({ data: { id: r.id, project_id: projectId, character_id: characterId, patch: r } }),
    onSuccess: () => { toast.success("Saved"); setDraft(null); refetch(); },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });
  const del = useMutation({
    mutationFn: async (id: string) => callDel({ data: { id } }),
    onSuccess: () => refetch(),
  });

  const others = (chars as any[]).filter((c) => c.id !== characterId);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{(rels as any[]).length} relationships</div>
        <Button size="sm" variant="outline" onClick={() => setDraft({ trust_level: 5, conflict_level: 5 })} disabled={others.length === 0}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />Add relationship
        </Button>
      </div>

      {others.length === 0 && <p className="text-xs text-muted-foreground italic">Add at least one other character to define relationships.</p>}

      {draft && (
        <Card className="p-4 space-y-3 border-primary/40">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Related character</Label>
              <Select value={draft.related_character_id ?? ""} onValueChange={(v) => setDraft({ ...draft, related_character_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  {others.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={draft.relationship_type ?? ""} onValueChange={(v) => setDraft({ ...draft, relationship_type: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{REL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Field label="Public dynamic" value={draft.public_dynamic} onChange={(v: string) => setDraft({ ...draft, public_dynamic: v })} />
            <Field label="Private truth" value={draft.private_truth} onChange={(v: string) => setDraft({ ...draft, private_truth: v })} />
            <Field label="Power dynamic" value={draft.power_dynamic} onChange={(v: string) => setDraft({ ...draft, power_dynamic: v })} />
            <Field label="Secret between them" value={draft.secret_between} onChange={(v: string) => setDraft({ ...draft, secret_between: v })} />
            <Field label="What they want from the other" value={draft.wants_from_other} onChange={(v: string) => setDraft({ ...draft, wants_from_other: v })} multiline />
            <Field label="What the other wants from them" value={draft.other_wants} onChange={(v: string) => setDraft({ ...draft, other_wants: v })} multiline />
            <Field label="Relationship arc" value={draft.relationship_arc} onChange={(v: string) => setDraft({ ...draft, relationship_arc: v })} multiline />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between"><Label className="text-xs">Trust</Label><span className="text-xs text-muted-foreground">{draft.trust_level ?? 5}/10</span></div>
              <Slider min={1} max={10} step={1} value={[draft.trust_level ?? 5]} onValueChange={(v) => setDraft({ ...draft, trust_level: v[0] })} />
            </div>
            <div>
              <div className="flex justify-between"><Label className="text-xs">Conflict</Label><span className="text-xs text-muted-foreground">{draft.conflict_level ?? 5}/10</span></div>
              <Slider min={1} max={10} step={1} value={[draft.conflict_level ?? 5]} onValueChange={(v) => setDraft({ ...draft, conflict_level: v[0] })} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>Cancel</Button>
            <Button size="sm" disabled={!draft.related_character_id || save.isPending} onClick={() => save.mutate(draft)}>Save</Button>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {(rels as any[]).map((r) => {
          const other = (chars as any[]).find((c) => c.id === r.related_character_id);
          return (
            <Card key={r.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold">{other?.name ?? "?"}</span>
                    {r.relationship_type && <span className="text-xs text-muted-foreground">· {r.relationship_type}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    {r.public_dynamic && <div><span className="text-foreground/70">Public:</span> {r.public_dynamic}</div>}
                    {r.private_truth && <div><span className="text-foreground/70">Private:</span> {r.private_truth}</div>}
                    {r.secret_between && <div><span className="text-foreground/70">Secret:</span> {r.secret_between}</div>}
                  </div>
                  <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
                    <span>Trust {r.trust_level ?? "—"}/10</span>
                    <span>Conflict {r.conflict_level ?? "—"}/10</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setDraft(r)}>Edit</Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => del.mutate(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, multiline }: any) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      {multiline ? (
        <Textarea value={value ?? ""} rows={2} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
