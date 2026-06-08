import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ProjectNav } from "@/components/ProjectNav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Plus, Trash2, Loader2, Copy, Command, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArcSidebar } from "@/components/arc/ArcSidebar";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { aiAssist } from "@/lib/ai.functions";
import { CoachPanel } from "@/components/editor/CoachPanel";
import { CoachModeToggle } from "@/components/editor/CoachModeToggle";
import { AutosaveIndicator } from "@/components/editor/AutosaveIndicator";
import type { AutosaveStatus } from "@/hooks/use-autosave";

export const Route = createFileRoute("/_authenticated/editor/$projectId")({
  head: () => ({ meta: [{ title: "Editor — SceneSmith AI" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    from: typeof s.from === "string" ? s.from : undefined,
    step: typeof s.step === "string" ? s.step : undefined,
  }),
  component: Editor,
  errorComponent: ({ error, reset }) => (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-3">
        <h2 className="text-xl font-semibold">The editor hit a snag</h2>
        <p className="text-sm text-muted-foreground break-words">{error?.message ?? "Unknown error"}</p>
        <div className="flex gap-2 justify-center">
          <button onClick={reset} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm">Try again</button>
          <a href="/dashboard" className="px-4 py-2 rounded-md border text-sm">Dashboard</a>
        </div>
      </div>
    </div>
  ),
});

const BLOCK_TYPES = [
  { value: "scene_heading", label: "Scene Heading", shortcut: "/scene", aliases: ["/heading", "/h", "/int", "/ext"] },
  { value: "action", label: "Action", shortcut: "/action", aliases: ["/a", "/desc", "/description"] },
  { value: "character", label: "Character", shortcut: "/character", aliases: ["/char", "/c", "/name"] },
  { value: "dialogue", label: "Dialogue", shortcut: "/dialogue", aliases: ["/dia", "/d", "/line", "/speech"] },
  { value: "parenthetical", label: "Parenthetical", shortcut: "/parenthetical", aliases: ["/parenth", "/p", "/wryly", "/beat"] },
  { value: "transition", label: "Transition", shortcut: "/transition", aliases: ["/trans", "/t", "/cut", "/fade"] },
  { value: "shot", label: "Shot", shortcut: "/shot", aliases: ["/s", "/camera", "/angle"] },
  { value: "note", label: "Note", shortcut: "/note", aliases: ["/n", "/comment", "/reminder"] },
];

const AI_TOOLS = [
  "Generate logline", "Build outline", "Create character",
  "Rewrite selected scene", "Make dialogue sharper", "Add subtext",
  "Make scene more visual", "Reduce exposition", "Increase tension",
  "Find plot holes", "Summarize scene", "Create storyboard prompt",
];

function Editor() {
  const { projectId } = Route.useParams();
  const search = Route.useSearch();
  const fromGuided = search.from === "guided";
  const guidedStep = search.step;
  const qc = useQueryClient();
  const callAi = useServerFn(aiAssist);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: blocks = [], isLoading: blocksLoading } = useQuery({
    queryKey: ["blocks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("script_blocks").select("*").eq("project_id", projectId).order("order_index");
      if (error) throw error;
      return data;
    },
  });

  const [focusBlockId, setFocusBlockId] = useState<string | null>(null);

  // Autosave status (editor-wide, aggregated across block edits)
  const draftKey = `editor-draft:${projectId}`;
  const [saveStatus, setSaveStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const pendingCount = useRef(0);

  const markDirty = useCallback(() => {
    pendingCount.current += 1;
    setSaveStatus("dirty");
  }, []);
  const markSaving = useCallback(() => setSaveStatus("saving"), []);
  const markSaved = useCallback(() => {
    pendingCount.current = Math.max(0, pendingCount.current - 1);
    if (pendingCount.current === 0) {
      setSaveStatus("saved");
      setLastSavedAt(Date.now());
    }
  }, []);
  const markError = useCallback(() => {
    pendingCount.current = Math.max(0, pendingCount.current - 1);
    setSaveStatus("error");
  }, []);

  // Per-block draft persistence in localStorage (cleared on successful save)
  const writeDraft = useCallback((blockId: string, content: string) => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(draftKey);
      const obj = raw ? JSON.parse(raw) : {};
      obj[blockId] = { content, savedAt: Date.now() };
      localStorage.setItem(draftKey, JSON.stringify(obj));
    } catch { /* ignore */ }
  }, [draftKey]);

  const clearDraft = useCallback((blockId: string) => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const obj = JSON.parse(raw);
      delete obj[blockId];
      if (Object.keys(obj).length === 0) localStorage.removeItem(draftKey);
      else localStorage.setItem(draftKey, JSON.stringify(obj));
    } catch { /* ignore */ }
  }, [draftKey]);

  // Recovery banner state
  const [recovery, setRecovery] = useState<Record<string, { content: string; savedAt: number }> | null>(null);
  useEffect(() => {
    if (blocksLoading || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const obj = JSON.parse(raw) as Record<string, { content: string; savedAt: number }>;
      const byId = new Map(blocks.map((b: any) => [b.id, b]));
      const recoverable: Record<string, { content: string; savedAt: number }> = {};
      for (const [id, draft] of Object.entries(obj)) {
        const b = byId.get(id);
        if (!b) continue;
        if ((b.content ?? "") !== (draft.content ?? "") && draft.content?.trim() !== "") {
          recoverable[id] = draft;
        } else {
          // Server already has this content — clean stale draft
          delete obj[id];
        }
      }
      if (Object.keys(recoverable).length > 0) setRecovery(recoverable);
      // Persist cleaned drafts
      if (Object.keys(obj).length === 0) localStorage.removeItem(draftKey);
      else localStorage.setItem(draftKey, JSON.stringify(obj));
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocksLoading, projectId]);

  // beforeunload warning while unsaved
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveStatus === "dirty" || saveStatus === "saving") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveStatus]);

  const addBlock = useMutation({
    mutationFn: async (block_type: string) => {
      const order_index = blocks.length;
      const { data, error } = await supabase.from("script_blocks")
        .insert({ project_id: projectId, block_type, content: "", order_index })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blocks", projectId] }),
  });

  const insertBlockAfter = useMutation({
    mutationFn: async ({ block_type, afterOrder }: { block_type: string; afterOrder: number }) => {
      // Find the next block's order_index to compute midpoint (fractional ordering — no bulk renumber)
      const sorted = [...blocks].sort((a, b) => a.order_index - b.order_index);
      const idx = sorted.findIndex((b) => b.order_index === afterOrder);
      const nextOrder = idx >= 0 && sorted[idx + 1] ? sorted[idx + 1].order_index : afterOrder + 1;
      const newOrder = (afterOrder + nextOrder) / 2;
      const { data, error } = await supabase.from("script_blocks")
        .insert({ project_id: projectId, block_type, content: "", order_index: newOrder })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["blocks", projectId] });
      if (data?.id) setFocusBlockId(data.id);
    },
  });

  const saveBlock = useCallback(async (id: string, patch: { content?: string; block_type?: string }) => {
    markSaving();
    try {
      const update: any = {};
      if (patch.content !== undefined) update.content = patch.content;
      if (patch.block_type) update.block_type = patch.block_type;
      const { error } = await supabase.from("script_blocks").update(update).eq("id", id);
      if (error) throw error;
      if (patch.content !== undefined) clearDraft(id);
      markSaved();
      // Silent refresh — don't refetch while user is typing
    } catch (e: any) {
      markError();
      toast.error("Couldn't save — your work is kept locally and will retry on next edit");
    }
  }, [clearDraft, markError, markSaved, markSaving]);

  const restoreRecovery = useCallback(async () => {
    if (!recovery) return;
    setSaveStatus("saving");
    pendingCount.current = Object.keys(recovery).length;
    for (const [id, draft] of Object.entries(recovery)) {
      try {
        const { error } = await supabase.from("script_blocks").update({ content: draft.content }).eq("id", id);
        if (error) throw error;
        clearDraft(id);
        markSaved();
      } catch {
        markError();
      }
    }
    qc.invalidateQueries({ queryKey: ["blocks", projectId] });
    setRecovery(null);
    toast.success("Restored your unsaved changes");
  }, [recovery, clearDraft, markSaved, markError, qc, projectId]);

  const discardRecovery = useCallback(() => {
    if (!recovery) return;
    for (const id of Object.keys(recovery)) clearDraft(id);
    setRecovery(null);
  }, [recovery, clearDraft]);

  const deleteBlock = useMutation({
    mutationFn: async (id: string) => {
      clearDraft(id);
      const { error } = await supabase.from("script_blocks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blocks", projectId] }),
  });

  const [aiTool, setAiTool] = useState(AI_TOOLS[0]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiOutput, setAiOutput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const runAi = async () => {
    setAiLoading(true);
    setAiOutput("");
    try {
      const screenplay = blocks
        .filter((b) => b.block_type !== "note")
        .map((b) => `[${b.block_type}] ${b.content}`).join("\n");
      const ctx = `Project: ${project?.title}\nGenre: ${project?.genre ?? ""}\nLogline: ${project?.logline ?? ""}\n\nSCRIPT SO FAR:\n${screenplay.slice(-6000)}`;
      const res = await callAi({ data: { projectId, tool: aiTool, prompt: aiPrompt || aiTool, context: ctx } });
      setAiOutput(res.text);
    } catch (e: any) {
      toast.error(e.message ?? "AI request failed");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <AppShell>
      <ProjectNav projectId={projectId} title={project?.title} />
      {fromGuided && (
        <div className="max-w-[1600px] mx-auto px-6 lg:px-10 pt-3">
          <Link
            to="/first-screenplay/$projectId"
            params={{ projectId }}
            hash={guidedStep ? `step-${guidedStep}` : undefined}
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to guided path{guidedStep ? ` · ${guidedStep.replace(/_/g, " ")}` : ""}
          </Link>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_340px] max-w-[1600px] mx-auto">
        {/* Left rail */}
        <aside className="hidden lg:block border-r border-border/60 p-4 min-h-[calc(100vh-104px)]">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Add Block</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {BLOCK_TYPES.map((t) => (
              <Button key={t.value} variant="outline" size="sm" className="h-8 text-xs justify-start" onClick={() => addBlock.mutate(t.value)}>
                <Plus className="h-3 w-3 mr-1" />{t.label}
              </Button>
            ))}
          </div>
          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Project</h3>
            <p className="text-xs text-muted-foreground">{project?.project_type}</p>
            {project?.genre && <p className="text-xs text-muted-foreground mt-1">{project.genre}</p>}
          </div>
          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Shortcuts</h3>
            <div className="text-[10px] text-muted-foreground space-y-1 font-mono">
              <p><span className="text-primary">/</span> — slash commands</p>
              <p><span className="text-primary">Tab</span> — cycle block type</p>
              <p><span className="text-primary">Enter</span> — new block</p>
            </div>
          </div>
        </aside>

        {/* Editor */}
        <section className="min-h-[calc(100vh-104px)] p-6 lg:p-10">
          <div className="screenplay max-w-[680px] mx-auto bg-card/30 border border-border/40 rounded-lg p-8 lg:p-12 shadow-2xl">
            {blocksLoading ? (
              <div className="space-y-3 py-8 font-sans">
                <div className="h-5 w-2/3 bg-muted/50 rounded animate-pulse" />
                <div className="h-4 w-full bg-muted/40 rounded animate-pulse" />
                <div className="h-4 w-5/6 bg-muted/40 rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-muted/40 rounded animate-pulse" />
              </div>
            ) : blocks.length === 0 ? (
              <div className="text-center py-16 font-sans">
                <p className="text-lg font-semibold mb-1">
                  {fromGuided ? "Let's write your opening scene." : "Your blank page awaits."}
                </p>
                <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
                  Start with a scene heading — it tells the reader where and when we are. The rest follows.
                </p>
                <div className="flex gap-2 justify-center flex-wrap">
                  <Button onClick={async () => {
                    await addBlock.mutateAsync("scene_heading");
                    await addBlock.mutateAsync("action");
                  }}>
                    <Plus className="h-4 w-4 mr-2" />Start my scene
                  </Button>
                  <Button variant="outline" onClick={() => addBlock.mutate("scene_heading")}>
                    Just a heading
                  </Button>
                </div>
              </div>
            ) : (
              blocks.map((b) => (
                <BlockEditor
                  key={b.id}
                  block={b}
                  onSave={(patch) => saveBlock(b.id, patch)}
                  onDirty={(content) => { writeDraft(b.id, content); markDirty(); }}
                  onDelete={() => deleteBlock.mutate(b.id)}
                  onInsertAfter={(block_type) => insertBlockAfter.mutate({ block_type, afterOrder: b.order_index })}
                  focusBlockId={focusBlockId}
                  onFocusDone={() => setFocusBlockId(null)}
                />
              ))
            )}
            {blocks.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-1.5 font-sans">
                {BLOCK_TYPES.map((t) => (
                  <Button key={t.value} variant="ghost" size="sm" className="h-7 text-xs" onClick={() => addBlock.mutate(t.value)}>
                    + {t.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
          {blocks.length > 0 && (
            <div className="max-w-[680px] mx-auto mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                const text = blocks.filter((b) => b.block_type !== "note").map(formatExport).join("\n\n");
                navigator.clipboard.writeText(text);
                toast.success("Screenplay copied to clipboard");
              }}><Copy className="h-3.5 w-3.5 mr-1.5" />Copy</Button>
              <Button variant="outline" size="sm" onClick={() => {
                const text = blocks.filter((b) => b.block_type !== "note").map(formatExport).join("\n\n");
                const blob = new Blob([text], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${(project?.title || "screenplay").replace(/[^a-z0-9]+/gi, "_")}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}>Download .txt</Button>
            </div>
          )}
        </section>

        {/* Right sidebar */}
        <aside className="hidden lg:block border-l border-border/60 min-h-[calc(100vh-104px)] bg-card/20">
          <Tabs defaultValue="arc" className="w-full">
            <TabsList className="w-full rounded-none border-b border-border/40 bg-transparent h-10">
              <TabsTrigger value="arc" className="text-xs flex-1">Arc</TabsTrigger>
              <TabsTrigger value="ai" className="text-xs flex-1">AI</TabsTrigger>
            </TabsList>
            <TabsContent value="arc" className="m-0">
              <ArcSidebar projectId={projectId} />
            </TabsContent>
            <TabsContent value="ai" className="m-0 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">AI Assistant</h3>
                </div>
                <CoachModeToggle />
              </div>
              <CoachPanel
                sceneText={blocks.filter((b) => b.block_type !== "note").map((b) => `[${b.block_type}] ${b.content}`).join("\n").slice(-6000)}
                blockCount={blocks.length}
                activeStep={guidedStep}
              />
              <Select value={aiTool} onValueChange={setAiTool}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{AI_TOOLS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Add specific instructions (optional)..."
                className="mt-2 text-xs min-h-[80px]"
              />
              <Button className="w-full mt-2" size="sm" onClick={runAi} disabled={aiLoading}>
                {aiLoading ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Thinking...</> : <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Run</>}
              </Button>
              {aiOutput && (
                <ScrollArea className="mt-4 h-[400px] rounded-md border border-border/60 bg-background/50 p-3">
                  <p className="text-xs whitespace-pre-wrap text-foreground/90 font-mono">{aiOutput}</p>
                </ScrollArea>
              )}
              {aiOutput && (
                <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => { navigator.clipboard.writeText(aiOutput); toast.success("Copied"); }}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />Copy
                </Button>
              )}
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </AppShell>
  );
}

function BlockEditor({
  block,
  onSave,
  onDirty,
  onDelete,
  onInsertAfter,
  focusBlockId,
  onFocusDone,
}: {
  block: any;
  onSave: (patch: { content?: string; block_type?: string }) => void | Promise<void>;
  onDirty: (content: string) => void;
  onDelete: () => void;
  onInsertAfter: (block_type: string) => void;
  focusBlockId: string | null;
  onFocusDone: () => void;
}) {
  const [val, setVal] = useState<string>(block.content ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    // Don't overwrite local typing with server echo
    if (!dirtyRef.current) setVal(block.content ?? "");
  }, [block.content]);

  // Debounced autosave — 800ms after last keystroke
  const scheduleSave = useCallback((next: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      saveTimer.current = null;
      if (next === (block.content ?? "")) { dirtyRef.current = false; return; }
      await onSave({ content: next });
      dirtyRef.current = false;
    }, 800);
  }, [block.content, onSave]);

  const flush = useCallback(() => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (val !== (block.content ?? "")) {
      void onSave({ content: val });
      dirtyRef.current = false;
    }
  }, [val, block.content, onSave]);

  // Flush on unmount
  useEffect(() => () => { flush(); }, [flush]);

  // auto-resize
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [val]);

  // focus newly inserted blocks
  useEffect(() => {
    if (focusBlockId === block.id && ref.current) {
      ref.current.focus();
      onFocusDone();
    }
  }, [focusBlockId, block.id, onFocusDone]);

  const placeholder: Record<string, string> = {
    scene_heading: "INT. LOCATION - DAY",
    action: "Describe what we see...",
    character: "CHARACTER NAME",
    dialogue: "What they say...",
    parenthetical: "(beat)",
    transition: "CUT TO:",
    shot: "CLOSE ON",
    note: "Note to self...",
  };

  // Slash command state
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashStart, setSlashStart] = useState<number>(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const query = slashOpen && slashStart >= 0
    ? val.slice(slashStart + 1).toLowerCase()
    : "";

  const filtered = BLOCK_TYPES.filter((t) =>
    t.label.toLowerCase().includes(query) ||
    t.value.toLowerCase().includes(query) ||
    t.shortcut.toLowerCase().includes(query) ||
    t.aliases.some((a) => a.toLowerCase().includes(query))
  );

  const closeSlash = useCallback(() => {
    setSlashOpen(false);
    setSlashStart(-1);
    setSelectedIndex(0);
  }, []);

  const executeSlash = useCallback((blockType: string) => {
    // Remove slash text from current block
    const beforeSlash = val.slice(0, slashStart);
    const newVal = beforeSlash;
    setVal(newVal);
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    void onSave({ content: newVal });
    closeSlash();
    onInsertAfter(blockType);
  }, [val, slashStart, closeSlash, onSave, onInsertAfter]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashOpen) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeSlash();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          executeSlash(filtered[selectedIndex].value);
        }
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          executeSlash(filtered[selectedIndex].value);
        }
        return;
      }
    } else {
      if (e.key === "Tab") {
        e.preventDefault();
        const idx = BLOCK_TYPES.findIndex((t) => t.value === block.block_type);
        const next = BLOCK_TYPES[(idx + 1) % BLOCK_TYPES.length];
        void onSave({ block_type: next.value });
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onInsertAfter("action");
        return;
      }
    }

    if (e.key === "/" && !slashOpen) {
      const pos = e.currentTarget.selectionStart;
      setSlashOpen(true);
      setSlashStart(pos);
      setSelectedIndex(0);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setVal(newVal);
    dirtyRef.current = true;
    onDirty(newVal);
    scheduleSave(newVal);

    if (slashOpen) {
      // If the slash was removed (backspace, etc.), close menu
      if (slashStart >= newVal.length || newVal[slashStart] !== "/") {
        closeSlash();
      }
    }
  };

  // Close slash menu on click outside
  useEffect(() => {
    if (!slashOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeSlash();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [slashOpen, closeSlash]);

  const [isFocused, setIsFocused] = useState(false);
  const QUICK_TYPES = ["scene_heading", "action", "character", "dialogue", "parenthetical"] as const;

  return (
    <div className={`group relative blk-${block.block_type}`}>
      <textarea
        ref={ref}
        value={val}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => { flush(); setTimeout(() => setIsFocused(false), 150); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder[block.block_type]}
        rows={1}
        className="w-full bg-transparent border-none outline-none resize-none focus:bg-primary/5 rounded px-1 -mx-1 placeholder:text-muted-foreground/40"
        style={{ fontFamily: "inherit", fontSize: "inherit", color: "inherit", textAlign: "inherit", textTransform: "inherit", fontWeight: "inherit", fontStyle: "inherit" } as any}
      />

      {/* Beginner-friendly inline block-type toolbar (shows on focus) */}
      {isFocused && !slashOpen && (
        <div className="absolute right-0 -top-7 z-10 flex items-center gap-0.5 rounded-md border border-border/60 bg-popover/95 backdrop-blur shadow-sm px-1 py-0.5 font-sans">
          {QUICK_TYPES.map((t) => {
            const meta = BLOCK_TYPES.find((b) => b.value === t)!;
            const active = block.block_type === t;
            return (
              <button
                key={t}
                onMouseDown={(e) => { e.preventDefault(); void onSave({ block_type: t }); }}
                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                title={meta.label}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Slash command menu */}
      {slashOpen && filtered.length > 0 && (
        <div
          ref={menuRef}
          className="absolute left-0 top-full mt-1 z-50 w-56 rounded-md border border-border bg-popover shadow-lg p-1 font-sans"
        >
          <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Command className="h-3 w-3" /> Insert block
          </div>
          {filtered.map((t, i) => (
            <button
              key={t.value}
              className={`w-full text-left flex items-center justify-between px-2 py-1.5 text-xs rounded-sm transition-colors ${
                i === selectedIndex ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
              }`}
              onMouseEnter={() => setSelectedIndex(i)}
              onClick={(e) => {
                e.stopPropagation();
                executeSlash(t.value);
              }}
            >
              <div className="flex flex-col">
                <span>{t.label}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{t.aliases.slice(0, 3).join(" ")}</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono shrink-0">{t.shortcut}</span>
            </button>
          ))}
        </div>
      )}

      {/* Block controls */}
      <div className="absolute -left-12 top-0 opacity-0 group-hover:opacity-100 transition flex flex-col gap-0.5 font-sans">
        <Select value={block.block_type} onValueChange={(v) => void onSave({ block_type: v })}>
          <SelectTrigger className="h-6 w-10 text-[10px] px-1"><span>{(block.block_type || "a")[0].toUpperCase()}</span></SelectTrigger>
          <SelectContent>{BLOCK_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDelete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function formatExport(b: any): string {
  const c = String(b?.content ?? "");
  switch (b?.block_type) {
    case "scene_heading": return c.toUpperCase();
    case "character": return `\t\t\t${c.toUpperCase()}`;
    case "dialogue": return `\t\t${c}`;
    case "parenthetical": return `\t\t\t(${c.replace(/^\(|\)$/g, "")})`;
    case "transition": return `\t\t\t\t\t${c.toUpperCase()}`;
    case "shot": return c.toUpperCase();
    default: return c;
  }
}
