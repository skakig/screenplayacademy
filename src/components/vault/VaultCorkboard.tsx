import { useMemo, useState } from "react";
import { VaultSceneCard } from "./VaultSceneCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  KIND_LABEL,
  STATUS_LABEL,
  VAULT_KINDS,
  VAULT_STATUSES,
  type VaultSceneRow,
} from "@/lib/vault/schemas";

type Props = {
  scenes: VaultSceneRow[];
  onEdit: (s: VaultSceneRow) => void;
  onSuggest: (s: VaultSceneRow) => void;
  onIntegrate: (s: VaultSceneRow) => void;
  onDuplicate: (s: VaultSceneRow) => void;
  onArchive: (s: VaultSceneRow) => void;
};

export function VaultCorkboard({ scenes, onEdit, onSuggest, onIntegrate, onDuplicate, onArchive }: Props) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return scenes.filter((s) => {
      if (s.status === "deleted") return false;
      if (kind !== "all" && s.kind !== kind) return false;
      if (status !== "all" && s.status !== status) return false;
      if (needle && !`${s.title} ${s.content} ${s.tags.join(" ")}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [scenes, q, kind, status]);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search titles, content, tags…"
          className="max-w-xs"
        />
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All kinds</SelectItem>
            {VAULT_KINDS.map((k) => <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {VAULT_STATUSES.filter((s) => s !== "deleted").map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="font-display text-xl mb-1">The corkboard is bare.</p>
          <p className="text-sm">Every great scene starts in the vault.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((s) => (
            <VaultSceneCard
              key={s.id}
              scene={s}
              onEdit={() => onEdit(s)}
              onSuggest={() => onSuggest(s)}
              onIntegrate={() => onIntegrate(s)}
              onDuplicate={() => onDuplicate(s)}
              onArchive={() => onArchive(s)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
