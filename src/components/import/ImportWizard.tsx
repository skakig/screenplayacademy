import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Sparkles,
} from "lucide-react";
import { createImportSession, getImportSession } from "@/lib/import/sessions.functions";
import {
  parseScreenplay,
  updateImportCandidate,
  bulkApproveCandidates,
} from "@/lib/import/parse.functions";
import { commitImport } from "@/lib/import/commit.functions";
import { readDraft, writeDraft } from "@/components/editor/draftBackup";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/i18n/t";

const BLOCK_TYPES = [
  "scene_heading",
  "action",
  "character",
  "dialogue",
  "parenthetical",
  "transition",
  "shot",
  "note",
] as const;

const CONFIDENCE_COLOR: Record<string, string> = {
  high: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  low: "bg-rose-500/15 text-rose-200 border-rose-500/30",
};

type Candidate = {
  id: string;
  order_index: number;
  raw_text: string;
  proposed_block_type: string;
  confidence: string;
  reason: string | null;
  needs_review: boolean;
  proposed_character_name: string | null;
  user_override_type: string | null;
  approved: boolean;
  removed: boolean;
};

type Step = "source" | "review" | "commit" | "done";

type SourceType =
  | "paste"
  | "txt"
  | "fountain"
  | "markdown";

const TEXT_EXTS: Record<string, SourceType> = {
  txt: "txt",
  fountain: "fountain",
  md: "markdown",
  markdown: "markdown",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onImported?: () => void;
};

export function ImportWizard({ open, onOpenChange, projectId, onImported }: Props) {
  const [step, setStep] = useState<Step>("source");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [pasted, setPasted] = useState("");
  const [filter, setFilter] = useState<"all" | "needs_review" | "approved">("all");
  const [mode, setMode] = useState<"replace" | "append" | "new_project">("replace");
  const [newTitle, setNewTitle] = useState("");

  const create = useServerFn(createImportSession);
  const parse = useServerFn(parseScreenplay);
  const get = useServerFn(getImportSession);
  const update = useServerFn(updateImportCandidate);
  const bulkApprove = useServerFn(bulkApproveCandidates);
  const commit = useServerFn(commitImport);

  useEffect(() => {
    if (!open) {
      // reset on close
      setTimeout(() => {
        setStep("source");
        setSessionId(null);
        setCandidates([]);
        setPasted("");
        setFilter("all");
        setMode("replace");
        setNewTitle("");
        setBusy(false);
      }, 200);
    }
  }, [open]);

  const reload = useCallback(
    async (sid: string) => {
      const { candidates: rows } = await get({ data: { sessionId: sid } });
      setCandidates(rows as Candidate[]);
    },
    [get],
  );

  const startFromText = async (sourceType: SourceType, rawText: string, fileName?: string) => {
    if (!rawText.trim()) {
      toast.error(t("import.error.empty"));
      return;
    }
    setBusy(true);
    try {
      const session = await create({
        data: { projectId, sourceType, fileName, rawText },
      });
      setSessionId(session.id);
      await parse({ data: { sessionId: session.id } });
      await reload(session.id);
      setStep("review");
    } catch (e: any) {
      toast.error(e?.message ?? t("import.error.start"));
    } finally {
      setBusy(false);
    }
  };

  const onFileChosen = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const sourceType = TEXT_EXTS[ext];
    if (!sourceType) {
      toast.error(t("import.error.unsupportedFormat"));
      return;
    }
    const text = await file.text();
    await startFromText(sourceType, text, file.name);
  };

  const toggleApprove = async (c: Candidate) => {
    const approved = !c.approved;
    setCandidates((prev) => prev.map((x) => (x.id === c.id ? { ...x, approved } : x)));
    try {
      await update({ data: { candidateId: c.id, patch: { approved } } });
    } catch {
      // revert
      setCandidates((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, approved: !approved } : x)),
      );
      toast.error(t("import.error.save"));
    }
  };

  const changeType = async (c: Candidate, type: string) => {
    setCandidates((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, user_override_type: type } : x)),
    );
    try {
      await update({ data: { candidateId: c.id, patch: { user_override_type: type } } });
    } catch {
      toast.error(t("import.error.save"));
    }
  };

  const removeRow = async (c: Candidate) => {
    setCandidates((prev) => prev.map((x) => (x.id === c.id ? { ...x, removed: true } : x)));
    try {
      await update({ data: { candidateId: c.id, patch: { removed: true, approved: false } } });
    } catch {
      toast.error(t("import.error.save"));
    }
  };

  const approveAllHigh = async () => {
    if (!sessionId) return;
    setBusy(true);
    try {
      await bulkApprove({ data: { sessionId, confidence: "high" } });
      await reload(sessionId);
      toast.success("All high-confidence blocks approved");
    } finally {
      setBusy(false);
    }
  };

  const visible = useMemo(() => {
    const rows = candidates.filter((c) => !c.removed);
    if (filter === "needs_review") return rows.filter((c) => c.needs_review && !c.approved);
    if (filter === "approved") return rows.filter((c) => c.approved);
    return rows;
  }, [candidates, filter]);

  const summary = useMemo(() => {
    const live = candidates.filter((c) => !c.removed);
    const approved = live.filter((c) => c.approved);
    const characters = new Set<string>();
    const scenes: string[] = [];
    for (const c of live) {
      const t = c.user_override_type ?? c.proposed_block_type;
      if (t === "character" && c.proposed_character_name) {
        characters.add(c.proposed_character_name.toUpperCase());
      }
      if (t === "scene_heading") scenes.push(c.raw_text);
    }
    return {
      total: live.length,
      approved: approved.length,
      reviewing: live.filter((c) => c.needs_review && !c.approved).length,
      characters: [...characters],
      scenes,
    };
  }, [candidates]);

  const doCommit = async () => {
    if (!sessionId) return;
    if (summary.approved === 0) {
      toast.error("Approve at least one block first.");
      return;
    }
    if (mode === "new_project" && !newTitle.trim()) {
      toast.error("Give the new project a title.");
      return;
    }
    setBusy(true);
    try {
      // Auto-slate current draft for Replace mode (safety net)
      if (mode === "replace" && typeof window !== "undefined") {
        const current = readDraft(projectId);
        if (current && current.blocks.length > 0) {
          try {
            const { data: userRes } = await supabase.auth.getUser();
            const uid = userRes.user?.id;
            if (uid) {
              await supabase.from("draft_takes").insert({
                project_id: projectId,
                user_id: uid,
                name: `Before import — ${new Date().toLocaleString()}`,
                captured_at: new Date().toISOString(),
                block_count: current.blocks.length,
                word_count: current.blocks.reduce(
                  (n, b: any) =>
                    n + ((b.content ?? "").trim().split(/\s+/).filter(Boolean).length),
                  0,
                ),
                payload: current as any,
              });
            }
          } catch {
            /* non-blocking */
          }
        }
      }

      const result = await commit({
        data: {
          sessionId,
          mode,
          newProjectTitle: mode === "new_project" ? newTitle.trim() : undefined,
        },
      });

      // Hydrate editor's local draft for the target project
      const targetProjectId = result.projectId as string;
      const draftBlocks = (result.blocks as any[]).map((r, i) => ({
        id: `local-${Date.now().toString(36)}-${i.toString(36)}`,
        serverId: r.id,
        block_type: r.block_type,
        content: r.content ?? "",
        order_index: r.order_index,
        metadata: r.metadata,
        status: "clean" as const,
      }));

      // If append, merge with existing local draft
      if (mode === "append") {
        const existing = readDraft(targetProjectId);
        const combined = [...(existing?.blocks ?? []), ...draftBlocks];
        writeDraft(targetProjectId, combined as any);
      } else {
        writeDraft(targetProjectId, draftBlocks as any);
      }

      toast.success(`Imported ${result.blockCount} blocks`);
      setStep("done");
      onImported?.();

      // For replace/new_project, full reload of editor route brings everything online cleanly.
      if (mode === "new_project") {
        setTimeout(() => {
          window.location.assign(`/editor/${targetProjectId}`);
        }, 600);
      } else {
        setTimeout(() => window.location.reload(), 600);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't commit import");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            Import existing screenplay
          </DialogTitle>
          <DialogDescription>
            Bring your work in. SceneSmith parses it, shows you exactly what it found, and never
            rewrites a line you didn't approve.
          </DialogDescription>
        </DialogHeader>

        {step === "source" && (
          <SourceStep
            pasted={pasted}
            setPasted={setPasted}
            onPaste={() => startFromText("paste", pasted)}
            onFile={onFileChosen}
            busy={busy}
          />
        )}

        {step === "review" && (
          <ReviewStep
            visible={visible}
            summary={summary}
            filter={filter}
            setFilter={setFilter}
            onToggleApprove={toggleApprove}
            onChangeType={changeType}
            onRemove={removeRow}
            onApproveAllHigh={approveAllHigh}
            busy={busy}
            onBack={() => setStep("source")}
            onNext={() => setStep("commit")}
          />
        )}

        {step === "commit" && (
          <CommitStep
            mode={mode}
            setMode={setMode}
            newTitle={newTitle}
            setNewTitle={setNewTitle}
            summary={summary}
            busy={busy}
            onBack={() => setStep("review")}
            onCommit={doCommit}
          />
        )}

        {step === "done" && (
          <div className="py-12 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <p className="text-lg font-semibold">Import complete</p>
            <p className="text-sm text-muted-foreground">Loading your screenplay…</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SourceStep({
  pasted,
  setPasted,
  onPaste,
  onFile,
  busy,
}: {
  pasted: string;
  setPasted: (v: string) => void;
  onPaste: () => void;
  onFile: (file: File) => void;
  busy: boolean;
}) {
  return (
    <Tabs defaultValue="paste" className="w-full">
      <TabsList>
        <TabsTrigger value="paste">Paste text</TabsTrigger>
        <TabsTrigger value="upload">Upload file</TabsTrigger>
      </TabsList>
      <TabsContent value="paste" className="space-y-3">
        <Textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder="Paste your screenplay, treatment, or rough draft here…"
          className="min-h-[280px] font-mono text-xs"
        />
        <div className="flex justify-end">
          <Button onClick={onPaste} disabled={busy || !pasted.trim()}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Parse text
          </Button>
        </div>
      </TabsContent>
      <TabsContent value="upload" className="space-y-3">
        <label
          htmlFor="import-file"
          className="border-2 border-dashed border-border/60 rounded-md p-10 flex flex-col items-center gap-2 cursor-pointer hover:border-primary/50 transition"
        >
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a file or click to choose</p>
          <p className="text-[11px] text-muted-foreground">
            .txt · .fountain · .md (more formats coming next pass)
          </p>
          <Input
            id="import-file"
            type="file"
            accept=".txt,.fountain,.md,.markdown,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </label>
        {busy && (
          <p className="text-xs text-muted-foreground flex items-center gap-2 justify-center">
            <Loader2 className="h-3 w-3 animate-spin" /> Parsing…
          </p>
        )}
      </TabsContent>
    </Tabs>
  );
}

function ReviewStep({
  visible,
  summary,
  filter,
  setFilter,
  onToggleApprove,
  onChangeType,
  onRemove,
  onApproveAllHigh,
  busy,
  onBack,
  onNext,
}: {
  visible: Candidate[];
  summary: { total: number; approved: number; reviewing: number; characters: string[]; scenes: string[] };
  filter: "all" | "needs_review" | "approved";
  setFilter: (f: "all" | "needs_review" | "approved") => void;
  onToggleApprove: (c: Candidate) => void;
  onChangeType: (c: Candidate, t: string) => void;
  onRemove: (c: Candidate) => void;
  onApproveAllHigh: () => void;
  busy: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_220px] gap-4">
      <div className="space-y-2 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList>
              <TabsTrigger value="all">All ({summary.total})</TabsTrigger>
              <TabsTrigger value="needs_review">
                Needs review ({summary.reviewing})
              </TabsTrigger>
              <TabsTrigger value="approved">Approved ({summary.approved})</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={onApproveAllHigh}
            disabled={busy}
          >
            Approve all high-confidence
          </Button>
        </div>

        <ScrollArea className="h-[420px] border border-border/60 rounded-md">
          <ul className="divide-y divide-border/40">
            {visible.map((c) => (
              <li
                key={c.id}
                className={`flex gap-2 p-2 items-start ${c.approved ? "bg-emerald-500/5" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={c.approved}
                  onChange={() => onToggleApprove(c)}
                  className="mt-1.5 h-4 w-4 rounded border-border accent-primary"
                  aria-label="Approve block"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <Select
                      value={c.user_override_type ?? c.proposed_block_type}
                      onValueChange={(v) => onChangeType(c, v)}
                    >
                      <SelectTrigger className="h-6 w-[140px] text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BLOCK_TYPES.map((t) => (
                          <SelectItem key={t} value={t} className="text-xs">
                            {t.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${CONFIDENCE_COLOR[c.confidence] ?? ""}`}
                      title={c.reason ?? ""}
                    >
                      {c.confidence}
                    </Badge>
                    {c.needs_review && (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-amber-500/10 border-amber-500/30 text-amber-200"
                      >
                        <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                        review
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs font-mono whitespace-pre-wrap break-words">
                    {c.raw_text || <em className="opacity-50">(empty)</em>}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(c)}
                  aria-label="Remove block"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </li>
            ))}
            {visible.length === 0 && (
              <li className="p-10 text-center text-xs text-muted-foreground italic">
                Nothing in this filter.
              </li>
            )}
          </ul>
        </ScrollArea>

        <div className="flex justify-between">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <Button onClick={onNext} disabled={busy}>
            Continue <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      <aside className="space-y-3 text-xs">
        <div className="rounded-md border border-border/50 bg-card/40 p-3 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Detected
          </p>
          <p>
            <strong>{summary.scenes.length}</strong> scenes
          </p>
          <p>
            <strong>{summary.characters.length}</strong> characters
          </p>
          <p>
            <strong>{summary.approved}</strong> / {summary.total} blocks approved
          </p>
        </div>
        {summary.characters.length > 0 && (
          <div className="rounded-md border border-border/50 bg-card/40 p-3 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Cast
            </p>
            <ul className="space-y-0.5">
              {summary.characters.slice(0, 12).map((n) => (
                <li key={n} className="font-mono text-[11px] truncate">
                  {n}
                </li>
              ))}
              {summary.characters.length > 12 && (
                <li className="text-muted-foreground italic">
                  +{summary.characters.length - 12} more
                </li>
              )}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}

function CommitStep({
  mode,
  setMode,
  newTitle,
  setNewTitle,
  summary,
  busy,
  onBack,
  onCommit,
}: {
  mode: "replace" | "append" | "new_project";
  setMode: (m: "replace" | "append" | "new_project") => void;
  newTitle: string;
  setNewTitle: (v: string) => void;
  summary: { approved: number };
  busy: boolean;
  onBack: () => void;
  onCommit: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border/60 bg-card/40 p-3">
        <p className="text-sm">
          Ready to commit <strong>{summary.approved}</strong> blocks.
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Your current draft is automatically slated as a Take before any replace — you can roll
          back any time.
        </p>
      </div>

      <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="space-y-2">
        <Label className="flex gap-3 items-start p-3 border border-border/60 rounded-md cursor-pointer hover:border-primary/40">
          <RadioGroupItem value="replace" className="mt-0.5" />
          <div>
            <p className="font-medium text-sm">Replace current draft</p>
            <p className="text-[11px] text-muted-foreground">
              Swap your current screenplay with the imported one. Current draft is captured as a
              Take first.
            </p>
          </div>
        </Label>
        <Label className="flex gap-3 items-start p-3 border border-border/60 rounded-md cursor-pointer hover:border-primary/40">
          <RadioGroupItem value="append" className="mt-0.5" />
          <div>
            <p className="font-medium text-sm">Append to current draft</p>
            <p className="text-[11px] text-muted-foreground">
              Add the imported blocks at the end of your current screenplay.
            </p>
          </div>
        </Label>
        <Label className="flex gap-3 items-start p-3 border border-border/60 rounded-md cursor-pointer hover:border-primary/40">
          <RadioGroupItem value="new_project" className="mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-sm">Import as a new project</p>
            <p className="text-[11px] text-muted-foreground">
              Create a new project and put the imported screenplay there. Your current project is
              untouched.
            </p>
            {mode === "new_project" && (
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="New project title"
                className="h-8 text-xs mt-2"
              />
            )}
          </div>
        </Label>
      </RadioGroup>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <Button onClick={onCommit} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Commit import
        </Button>
      </div>
    </div>
  );
}
