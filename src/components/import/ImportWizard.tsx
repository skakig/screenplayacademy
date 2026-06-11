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
import { extractFileText } from "@/lib/import/extract.functions";
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
  | "markdown"
  | "fdx"
  | "pdf"
  | "docx"
  | "rtf";

const TEXT_EXTS: Record<string, SourceType> = {
  txt: "txt",
  fountain: "fountain",
  md: "markdown",
  markdown: "markdown",
};

const BINARY_EXTS: Record<string, "fdx" | "pdf" | "docx" | "rtf"> = {
  fdx: "fdx",
  pdf: "pdf",
  docx: "docx",
  rtf: "rtf",
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
  const [runDiagnostics, setRunDiagnostics] = useState(true);
  const [reportId, setReportId] = useState<string | null>(null);
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagBusy, setDiagBusy] = useState(false);

  const create = useServerFn(createImportSession);
  const parse = useServerFn(parseScreenplay);
  const get = useServerFn(getImportSession);
  const update = useServerFn(updateImportCandidate);
  const bulkApprove = useServerFn(bulkApproveCandidates);
  const commit = useServerFn(commitImport);
  const extract = useServerFn(extractFileText);
  const diagnose = useServerFn(diagnoseImport);

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
    const textType = TEXT_EXTS[ext];
    if (textType) {
      const text = await file.text();
      await startFromText(textType, text, file.name);
      return;
    }
    const binType = BINARY_EXTS[ext];
    if (binType) {
      setBusy(true);
      try {
        const base64 = await fileToBase64(file);
        const { rawText } = await extract({
          data: { sourceType: binType, fileName: file.name, base64 },
        });
        await startFromText(binType, rawText, file.name);
      } catch (e: any) {
        toast.error(e?.message ?? t("import.error.start"));
        setBusy(false);
      }
      return;
    }
    toast.error(t("import.error.unsupportedFormat"));
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
      toast.success(t("import.review.approveHigh.toast"));
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
      const bt = c.user_override_type ?? c.proposed_block_type;
      if (bt === "character" && c.proposed_character_name) {
        characters.add(c.proposed_character_name.toUpperCase());
      }
      if (bt === "scene_heading") scenes.push(c.raw_text);
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
      toast.error(t("import.error.approveOne"));
      return;
    }
    if (mode === "new_project" && !newTitle.trim()) {
      toast.error(t("import.error.newTitle"));
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
                name: t("import.commit.takeName", { when: new Date().toLocaleString() }),
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

      toast.success(t("import.commit.success", { count: result.blockCount }));
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
      toast.error(e?.message ?? t("import.error.commit"));
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
            {t("import.title")}
          </DialogTitle>
          <DialogDescription>{t("import.description")}</DialogDescription>
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
            <p className="text-lg font-semibold">{t("import.done.title")}</p>
            <p className="text-sm text-muted-foreground">{t("import.done.loading")}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
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
        <TabsTrigger value="paste">{t("import.source.tab.paste")}</TabsTrigger>
        <TabsTrigger value="upload">{t("import.source.tab.upload")}</TabsTrigger>
      </TabsList>
      <TabsContent value="paste" className="space-y-3">
        <Textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder={t("import.source.paste.placeholder")}
          className="min-h-[280px] font-mono text-xs"
        />
        <div className="flex justify-end">
          <Button onClick={onPaste} disabled={busy || !pasted.trim()}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {t("import.source.paste.cta")}
          </Button>
        </div>
      </TabsContent>
      <TabsContent value="upload" className="space-y-3">
        <label
          htmlFor="import-file"
          className="border-2 border-dashed border-border/60 rounded-md p-10 flex flex-col items-center gap-2 cursor-pointer hover:border-primary/50 transition"
        >
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">{t("import.source.upload.cta")}</p>
          <p className="text-[11px] text-muted-foreground">
            {t("import.source.upload.formats")}
          </p>
          <Input
            id="import-file"
            type="file"
            accept=".txt,.fountain,.md,.markdown,.fdx,.docx,.rtf,.pdf,text/plain,application/pdf,application/rtf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </label>
        {busy && (
          <p className="text-xs text-muted-foreground flex items-center gap-2 justify-center">
            <Loader2 className="h-3 w-3 animate-spin" /> {t("import.source.upload.parsing")}
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
  onChangeType: (c: Candidate, type: string) => void;
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
              <TabsTrigger value="all">{t("import.review.filter.all", { count: summary.total })}</TabsTrigger>
              <TabsTrigger value="needs_review">
                {t("import.review.filter.needsReview", { count: summary.reviewing })}
              </TabsTrigger>
              <TabsTrigger value="approved">{t("import.review.filter.approved", { count: summary.approved })}</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={onApproveAllHigh}
            disabled={busy}
          >
            {t("import.review.approveHigh")}
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
                  aria-label={t("import.review.aria.approve")}
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
                        {BLOCK_TYPES.map((bt) => (
                          <SelectItem key={bt} value={bt} className="text-xs">
                            {t(`import.blockType.${bt}` as any)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${CONFIDENCE_COLOR[c.confidence] ?? ""}`}
                      title={c.reason ?? ""}
                    >
                      {t(`import.confidence.${c.confidence}` as any)}
                    </Badge>
                    {c.needs_review && (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-amber-500/10 border-amber-500/30 text-amber-200"
                      >
                        <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                        {t("import.review.badge.review")}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs font-mono whitespace-pre-wrap break-words">
                    {c.raw_text || <em className="opacity-50">{t("import.review.empty.placeholder")}</em>}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(c)}
                  aria-label={t("import.review.aria.remove")}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </li>
            ))}
            {visible.length === 0 && (
              <li className="p-10 text-center text-xs text-muted-foreground italic">
                {t("import.review.empty")}
              </li>
            )}
          </ul>
        </ScrollArea>

        <div className="flex justify-between">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" /> {t("import.nav.back")}
          </Button>
          <Button onClick={onNext} disabled={busy}>
            {t("import.nav.continue")} <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      <aside className="space-y-3 text-xs">
        <div className="rounded-md border border-border/50 bg-card/40 p-3 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            {t("import.review.detected")}
          </p>
          <p>{t("import.review.scenes", { count: summary.scenes.length })}</p>
          <p>{t("import.review.characters", { count: summary.characters.length })}</p>
          <p>
            {t("import.review.approvedCount", {
              approved: summary.approved,
              total: summary.total,
            })}
          </p>
        </div>
        {summary.characters.length > 0 && (
          <div className="rounded-md border border-border/50 bg-card/40 p-3 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {t("import.review.cast")}
            </p>
            <ul className="space-y-0.5">
              {summary.characters.slice(0, 12).map((n) => (
                <li key={n} className="font-mono text-[11px] truncate">
                  {n}
                </li>
              ))}
              {summary.characters.length > 12 && (
                <li className="text-muted-foreground italic">
                  {t("import.review.castMore", { count: summary.characters.length - 12 })}
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
        <p
          className="text-sm"
          dangerouslySetInnerHTML={{
            __html: t("import.commit.ready", {
              count: `<strong>${summary.approved}</strong>`,
            }),
          }}
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          {t("import.commit.safetyNote")}
        </p>
      </div>

      <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="space-y-2">
        <Label className="flex gap-3 items-start p-3 border border-border/60 rounded-md cursor-pointer hover:border-primary/40">
          <RadioGroupItem value="replace" className="mt-0.5" />
          <div>
            <p className="font-medium text-sm">{t("import.commit.mode.replace.title")}</p>
            <p className="text-[11px] text-muted-foreground">
              {t("import.commit.mode.replace.body")}
            </p>
          </div>
        </Label>
        <Label className="flex gap-3 items-start p-3 border border-border/60 rounded-md cursor-pointer hover:border-primary/40">
          <RadioGroupItem value="append" className="mt-0.5" />
          <div>
            <p className="font-medium text-sm">{t("import.commit.mode.append.title")}</p>
            <p className="text-[11px] text-muted-foreground">
              {t("import.commit.mode.append.body")}
            </p>
          </div>
        </Label>
        <Label className="flex gap-3 items-start p-3 border border-border/60 rounded-md cursor-pointer hover:border-primary/40">
          <RadioGroupItem value="new_project" className="mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-sm">{t("import.commit.mode.new.title")}</p>
            <p className="text-[11px] text-muted-foreground">
              {t("import.commit.mode.new.body")}
            </p>
            {mode === "new_project" && (
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t("import.commit.newTitle.placeholder")}
                className="h-8 text-xs mt-2"
              />
            )}
          </div>
        </Label>
      </RadioGroup>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> {t("import.nav.back")}
        </Button>
        <Button onClick={onCommit} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          {t("import.commit.cta")}
        </Button>
      </div>
    </div>
  );
}
