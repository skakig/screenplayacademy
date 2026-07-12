/**
 * WorldEntityRelationshipsPanel
 *
 * In-editor UI to view and manage typed relationships (located_in,
 * member_of, ally_of, enemy_of, and custom edges) for a single world
 * entity. Uses server functions from `worldGraph.functions.ts` and is
 * gated by RLS (universe owner).
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowRight, ArrowLeft, Trash2, Plus, Pencil, Check, X } from "lucide-react";
import {
  getWorldEntity,
  listWorldEntities,
  createWorldRelationship,
  updateWorldRelationship,
  deleteWorldRelationship,
} from "@/lib/world/worldGraph.functions";
import {
  WORLD_RELATIONSHIP_TYPES,
  type WorldEntityDetail,
  type WorldRelationshipType,
} from "@/lib/world/worldGraph";

const REL_LABELS: Record<WorldRelationshipType, string> = {
  located_in: "Located in",
  member_of: "Member of",
  ally_of: "Ally of",
  enemy_of: "Enemy of",
  owns: "Owns",
  occurred_at: "Occurred at",
  references: "References",
  related_to: "Related to",
  parent_of: "Parent of",
  child_of: "Child of",
  custom: "Custom",
};

export function WorldEntityRelationshipsPanel({
  entityId,
  universeId,
}: {
  entityId: string;
  universeId: string;
}) {
  const qc = useQueryClient();
  const fetchEntity = useServerFn(getWorldEntity);
  const fetchEntities = useServerFn(listWorldEntities);
  const createRel = useServerFn(createWorldRelationship);
  const updateRel = useServerFn(updateWorldRelationship);
  const deleteRel = useServerFn(deleteWorldRelationship);

  const detailQ = useQuery({
    queryKey: ["world-entity", entityId],
    queryFn: () => fetchEntity({ data: { id: entityId } }),
    staleTime: 15_000,
  });

  const entitiesQ = useQuery({
    queryKey: ["world-entities", universeId],
    queryFn: () => fetchEntities({ data: { universeId, limit: 500 } }),
    staleTime: 30_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["world-entity", entityId] });
  };

  const createM = useMutation({
    mutationFn: (input: {
      toEntityId: string;
      relationshipType: WorldRelationshipType;
      notes?: string;
    }) =>
      createRel({
        data: {
          universeId,
          fromEntityId: entityId,
          toEntityId: input.toEntityId,
          relationshipType: input.relationshipType,
          notes: input.notes || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Relationship added");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateM = useMutation({
    mutationFn: (input: {
      id: string;
      notes?: string | null;
      relationshipType?: WorldRelationshipType;
    }) => updateRel({ data: input }),
    onSuccess: () => {
      toast.success("Relationship updated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteRel({ data: { id } }),
    onSuccess: () => {
      toast.success("Relationship removed");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const otherEntities = useMemo(
    () => (entitiesQ.data ?? []).filter((e) => e.id !== entityId),
    [entitiesQ.data, entityId],
  );

  if (detailQ.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading relationships…
      </div>
    );
  }
  if (detailQ.isError || !detailQ.data) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-destructive">
          Couldn't load entity relationships.
          {(detailQ.error as Error)?.message ? ` ${(detailQ.error as Error).message}` : ""}
          <Button size="sm" variant="outline" className="ml-3" onClick={() => detailQ.refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const detail: WorldEntityDetail = detailQ.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            Relationships for
            <span className="font-display text-base">{detail.entity.name}</span>
            <Badge variant="outline" className="text-[10px] capitalize">
              {detail.entity.entity_kind}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AddRelationshipForm
            others={otherEntities}
            pending={createM.isPending}
            onSubmit={(v) => createM.mutate(v)}
          />

          <RelSection
            title="Outgoing"
            icon={<ArrowRight className="h-3.5 w-3.5" />}
            rows={detail.outgoing.map((r) => ({
              id: r.id,
              relationship_type: r.relationship_type,
              notes: r.notes,
              other: r.other,
              direction: "out" as const,
            }))}
            onUpdate={(v) => updateM.mutate(v)}
            onDelete={(id) => deleteM.mutate(id)}
            savingId={updateM.isPending ? updateM.variables?.id : undefined}
            deletingId={deleteM.isPending ? (deleteM.variables as string | undefined) : undefined}
          />

          <RelSection
            title="Incoming"
            icon={<ArrowLeft className="h-3.5 w-3.5" />}
            rows={detail.incoming.map((r) => ({
              id: r.id,
              relationship_type: r.relationship_type,
              notes: r.notes,
              other: r.other,
              direction: "in" as const,
            }))}
            onUpdate={(v) => updateM.mutate(v)}
            onDelete={(id) => deleteM.mutate(id)}
            savingId={updateM.isPending ? updateM.variables?.id : undefined}
            deletingId={deleteM.isPending ? (deleteM.variables as string | undefined) : undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function AddRelationshipForm({
  others,
  pending,
  onSubmit,
}: {
  others: Array<{ id: string; name: string; entity_kind: string }>;
  pending: boolean;
  onSubmit: (v: {
    toEntityId: string;
    relationshipType: WorldRelationshipType;
    notes?: string;
  }) => void;
}) {
  const [toEntityId, setToEntityId] = useState<string>("");
  const [type, setType] = useState<WorldRelationshipType>("located_in");
  const [notes, setNotes] = useState("");

  const canSubmit = !!toEntityId && !pending;

  return (
    <div className="rounded-md border border-border/50 p-3 space-y-2">
      <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        <Plus className="h-3 w-3" /> Add relationship
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <Select value={type} onValueChange={(v) => setType(v as WorldRelationshipType)}>
          <SelectTrigger>
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {WORLD_RELATIONSHIP_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {REL_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={toEntityId} onValueChange={setToEntityId}>
          <SelectTrigger>
            <SelectValue placeholder="Target entity" />
          </SelectTrigger>
          <SelectContent>
            {others.length === 0 && (
              <div className="px-2 py-1 text-xs text-muted-foreground">
                No other entities in this universe yet.
              </div>
            )}
            {others.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}{" "}
                <span className="text-[10px] text-muted-foreground">({o.entity_kind})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={!canSubmit}
          onClick={() => {
            onSubmit({ toEntityId, relationshipType: type, notes: notes.trim() || undefined });
            setNotes("");
          }}
        >
          {pending && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
          Add
        </Button>
      </div>
    </div>
  );
}

type RelRow = {
  id: string;
  relationship_type: WorldRelationshipType;
  notes: string | null;
  other: { id: string; name: string; entity_kind: string } | null;
  direction: "in" | "out";
};

function RelSection({
  title,
  icon,
  rows,
  onUpdate,
  onDelete,
  savingId,
  deletingId,
}: {
  title: string;
  icon: React.ReactNode;
  rows: RelRow[];
  onUpdate: (v: {
    id: string;
    notes?: string | null;
    relationshipType?: WorldRelationshipType;
  }) => void;
  onDelete: (id: string) => void;
  savingId?: string;
  deletingId?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {icon} {title} · {rows.length}
      </div>
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No {title.toLowerCase()} edges yet.</p>
      )}
      {rows.map((r) => (
        <RelRowEditor
          key={r.id}
          row={r}
          saving={savingId === r.id}
          deleting={deletingId === r.id}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function RelRowEditor({
  row,
  saving,
  deleting,
  onUpdate,
  onDelete,
}: {
  row: RelRow;
  saving: boolean;
  deleting: boolean;
  onUpdate: (v: {
    id: string;
    notes?: string | null;
    relationshipType?: WorldRelationshipType;
  }) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [type, setType] = useState<WorldRelationshipType>(row.relationship_type);
  const [notes, setNotes] = useState(row.notes ?? "");

  const cancel = () => {
    setType(row.relationship_type);
    setNotes(row.notes ?? "");
    setEditing(false);
  };

  return (
    <div className="rounded-md border border-border/40 p-2 space-y-2">
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <Badge variant="secondary" className="text-[10px]">
          {REL_LABELS[row.relationship_type]}
        </Badge>
        {row.direction === "out" ? (
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ArrowLeft className="h-3 w-3 text-muted-foreground" />
        )}
        <span className="font-medium">{row.other?.name ?? "(unknown entity)"}</span>
        {row.other && (
          <Badge variant="outline" className="text-[10px] capitalize">
            {row.other.entity_kind}
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-1">
          {!editing && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {editing && (
            <>
              <Button
                size="sm"
                variant="ghost"
                disabled={saving}
                onClick={() => {
                  onUpdate({
                    id: row.id,
                    relationshipType: type,
                    notes: notes.trim() === "" ? null : notes.trim(),
                  });
                  setEditing(false);
                }}
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button size="sm" variant="ghost" onClick={cancel}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            disabled={deleting}
            onClick={() => onDelete(row.id)}
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
      {editing ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Select value={type} onValueChange={(v) => setType(v as WorldRelationshipType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORLD_RELATIONSHIP_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {REL_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            className="md:col-span-2 min-h-[38px]"
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      ) : (
        row.notes && (
          <p className="text-xs text-muted-foreground pl-1">{row.notes}</p>
        )
      )}
    </div>
  );
}
