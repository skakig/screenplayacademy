import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getCharacterBibleEditable,
  addCharacterAlias,
  removeCharacterAlias,
  updateEvidence,
  deleteEvidence,
  EVIDENCE_TYPE_OPTIONS,
  EVIDENCE_MODE_OPTIONS,
} from "@/lib/importation/character-bible-edit.functions";

type EvidenceRow = {
  id: string;
  excerpt: string;
  evidence_type: string;
  direct_or_inferred: string;
  confidence: number;
  heading: string | null;
  sequence: number | null;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  universeId: string;
  characterId: string;
  characterName: string;
  onSaved?: () => void;
}

export function CharacterBibleEditor({
  open,
  onOpenChange,
  projectId,
  universeId,
  characterId,
  characterName,
  onSaved,
}: Props) {
  const qc = useQueryClient();
  const getFn = useServerFn(getCharacterBibleEditable);
  const addAliasFn = useServerFn(addCharacterAlias);
  const removeAliasFn = useServerFn(removeCharacterAlias);
  const updateEvFn = useServerFn(updateEvidence);
  const deleteEvFn = useServerFn(deleteEvidence);

  const queryKey = ["bible-editor", characterId, universeId] as const;
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      getFn({
        data: {
          project_id: projectId,
          universe_id: universeId,
          character_id: characterId,
        },
      }),
    enabled: open,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey });
    onSaved?.();
  };

  const [newAlias, setNewAlias] = useState("");
  const addAlias = useMutation({
    mutationFn: (alias_text: string) =>
      addAliasFn({
        data: { project_id: projectId, character_id: characterId, alias_text },
      }),
    onSuccess: () => {
      setNewAlias("");
      invalidate();
      toast.success("Alias added");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const removeAlias = useMutation({
    mutationFn: (alias_id: string) => removeAliasFn({ data: { alias_id } }),
    onSuccess: () => invalidate(),
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    excerpt: string;
    evidence_type: string;
    direct_or_inferred: string;
  }>({ excerpt: "", evidence_type: "mention", direct_or_inferred: "direct" });

  const startEdit = (e: EvidenceRow) => {
    setEditingId(e.id);
    setDraft({
      excerpt: e.excerpt,
      evidence_type: e.evidence_type,
      direct_or_inferred: e.direct_or_inferred,
    });
  };

  const saveEdit = useMutation({
    mutationFn: () =>
      updateEvFn({
        data: {
          evidence_id: editingId!,
          excerpt: draft.excerpt,
          evidence_type:
            draft.evidence_type as (typeof EVIDENCE_TYPE_OPTIONS)[number],
          direct_or_inferred:
            draft.direct_or_inferred as (typeof EVIDENCE_MODE_OPTIONS)[number],
        },
      }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
      toast.success("Evidence updated");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const removeEv = useMutation({
    mutationFn: (evidence_id: string) => deleteEvFn({ data: { evidence_id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Evidence removed");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit bible entry — {characterName}</DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="flex items-center gap-2 text-muted-foreground py-8">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <Tabs defaultValue="aliases" className="w-full">
            <TabsList>
              <TabsTrigger value="aliases">
                Aliases ({data.aliases.length})
              </TabsTrigger>
              <TabsTrigger value="evidence">
                Evidence ({data.evidence.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="aliases" className="space-y-3 pt-4">
              <div className="flex gap-2">
                <Input
                  value={newAlias}
                  onChange={(e) => setNewAlias(e.target.value)}
                  placeholder="Add alias (e.g. The Commander)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newAlias.trim()) {
                      e.preventDefault();
                      addAlias.mutate(newAlias.trim());
                    }
                  }}
                />
                <Button
                  onClick={() => addAlias.mutate(newAlias.trim())}
                  disabled={!newAlias.trim() || addAlias.isPending}
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
              {data.aliases.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No aliases yet.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {data.aliases.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center gap-2 border rounded-md px-3 py-2"
                    >
                      <span className="flex-1">{a.alias_text}</span>
                      <Badge variant="outline" className="text-xs">
                        {a.alias_kind}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {a.source}
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeAlias.mutate(a.id)}
                        disabled={removeAlias.isPending}
                        aria-label="Remove alias"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="evidence" className="space-y-3 pt-4">
              {data.evidence.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No evidence recorded for this character.
                </p>
              ) : (
                <ul className="space-y-2">
                  {data.evidence.map((e) => {
                    const isEditing = editingId === e.id;
                    return (
                      <li
                        key={e.id}
                        className="border rounded-md p-3 space-y-2"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">{e.evidence_type}</Badge>
                          <Badge variant="secondary">
                            {e.direct_or_inferred}
                          </Badge>
                          <span>conf {(e.confidence * 100).toFixed(0)}%</span>
                          {e.heading && (
                            <span className="truncate max-w-[220px]">
                              · {e.heading}
                            </span>
                          )}
                          {typeof e.sequence === "number" && (
                            <span>· seq {e.sequence}</span>
                          )}
                          <div className="ml-auto flex gap-1">
                            {isEditing ? (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => saveEdit.mutate()}
                                  disabled={saveEdit.isPending}
                                  aria-label="Save"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setEditingId(null)}
                                  aria-label="Cancel"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => startEdit(e)}
                                  aria-label="Edit"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => removeEv.mutate(e.id)}
                                  disabled={removeEv.isPending}
                                  aria-label="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="space-y-2">
                            <Textarea
                              value={draft.excerpt}
                              onChange={(ev) =>
                                setDraft((d) => ({
                                  ...d,
                                  excerpt: ev.target.value,
                                }))
                              }
                              rows={3}
                              maxLength={1000}
                            />
                            <div className="flex gap-2">
                              <Select
                                value={draft.evidence_type}
                                onValueChange={(v) =>
                                  setDraft((d) => ({ ...d, evidence_type: v }))
                                }
                              >
                                <SelectTrigger className="w-[160px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {EVIDENCE_TYPE_OPTIONS.map((t) => (
                                    <SelectItem key={t} value={t}>
                                      {t}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select
                                value={draft.direct_or_inferred}
                                onValueChange={(v) =>
                                  setDraft((d) => ({
                                    ...d,
                                    direct_or_inferred: v,
                                  }))
                                }
                              >
                                <SelectTrigger className="w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {EVIDENCE_MODE_OPTIONS.map((t) => (
                                    <SelectItem key={t} value={t}>
                                      {t}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm italic border-l-2 border-primary/30 pl-2">
                            "{e.excerpt}"
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
