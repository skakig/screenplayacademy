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
import { Sparkles, Plus, Trash2, Loader2, Copy, Command } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArcSidebar } from "@/components/arc/ArcSidebar";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { aiAssist } from "@/lib/ai.functions";
import { CoachPanel } from "@/components/editor/CoachPanel";
import { CoachModeToggle } from "@/components/editor/CoachModeToggle";

export const Route = createFileRoute("/_authenticated/editor/$projectId")({
  head: () => ({ meta: [{ title: "Editor — SceneSmith AI" }] }),
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

  const { data: blocks = [] } = useQuery({
    queryKey: ["blocks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("script_blocks").select("*").eq("project_id", projectId).order("order_index");
      if (error) throw error;
      return data;
    },
  });

  const [focusBlockId, setFocusBlockId] = useState<string | null>(null);

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
      // Insert with fractional order to place it right after
      const { data, error } = await supabase.from("script_blocks")
        .insert({ project_id: projectId, block_type, content: "", order_index: afterOrder + 0.5 })
        .select().single();
      if (error) throw error;
      // Re-normalize order indices
      const { data: all } = await supabase.from("script_blocks")
        .select("id, order_index")
        .eq("project_id", projectId)
        .order("order_index");
      if (all) {
        for (let i = 0; i < all.length; i++) {
          await supabase.from("script_blocks").update({ order_index: i }).eq("id", all[i].id);
        }
      }
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["blocks", projectId] });
      if (data?.id) setFocusBlockId(data.id);
    },
  });

  const updateBlock = useMutation({
    mutationFn: async ({ id, content, block_type }: { id: string; content?: string; block_type?: string }) => {
      const patch: any = {};
      if (content !== undefined) patch.content = content;
      if (block_type) patch.block_type = block_type;
      const { error } = await supabase.from("script_blocks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blocks", projectId] }),
  });

  const deleteBlock = useMutation({
    mutationFn: async (id: string) => {
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
            {blocks.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground mb-4 font-sans">Your blank page awaits.</p>
                <Button onClick={() => addBlock.mutate("scene_heading")}><Plus className="h-4 w-4 mr-2" />Add Scene Heading</Button>
              </div>
            ) : (
              blocks.map((b) => (
                <BlockEditor
                  key={b.id}
                  block={b}
                  onUpdate={(patch) => updateBlock.mutate({ id: b.id, ...patch })}
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
              <CoachPanel sceneText={blocks.filter((b) => b.block_type !== "note").map((b) => `[${b.block_type}] ${b.content}`).join("\n").slice(-6000)} />
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
  onUpdate,
  onDelete,
  onInsertAfter,
  focusBlockId,
  onFocusDone,
}: {
  block: any;
  onUpdate: (patch: { content?: string; block_type?: string }) => void;
  onDelete: () => void;
  onInsertAfter: (block_type: string) => void;
  focusBlockId: string | null;
  onFocusDone: () => void;
}) {
  const [val, setVal] = useState<string>(block.content ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setVal(block.content ?? ""); }, [block.content]);

  const flush = () => { if (val !== block.content) onUpdate({ content: val }); };

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
    onUpdate({ content: newVal });
    closeSlash();
    onInsertAfter(blockType);
  }, [val, slashStart, closeSlash, onUpdate, onInsertAfter]);

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
        onUpdate({ block_type: next.value });
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

  return (
    <div className={`group relative blk-${block.block_type}`}>
      <textarea
        ref={ref}
        value={val}
        onChange={handleChange}
        onBlur={flush}
        onKeyDown={handleKeyDown}
        placeholder={placeholder[block.block_type]}
        rows={1}
        className="w-full bg-transparent border-none outline-none resize-none focus:bg-primary/5 rounded px-1 -mx-1 placeholder:text-muted-foreground/40"
        style={{ fontFamily: "inherit", fontSize: "inherit", color: "inherit", textAlign: "inherit", textTransform: "inherit", fontWeight: "inherit", fontStyle: "inherit" } as any}
      />

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
        <Select value={block.block_type} onValueChange={(v) => onUpdate({ block_type: v })}>
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
