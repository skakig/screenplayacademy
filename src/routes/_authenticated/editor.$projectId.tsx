import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ProjectNav } from "@/components/ProjectNav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Plus, Trash2, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { aiAssist } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/editor/$projectId")({
  head: () => ({ meta: [{ title: "Editor — SceneSmith AI" }] }),
  component: Editor,
});

const BLOCK_TYPES = [
  { value: "scene_heading", label: "Scene Heading" },
  { value: "action", label: "Action" },
  { value: "character", label: "Character" },
  { value: "dialogue", label: "Dialogue" },
  { value: "parenthetical", label: "Parenthetical" },
  { value: "transition", label: "Transition" },
  { value: "shot", label: "Shot" },
  { value: "note", label: "Note" },
];

const AI_TOOLS = [
  "Generate logline", "Build outline", "Create character",
  "Rewrite selected scene", "Make dialogue sharper", "Add subtext",
  "Make scene more visual", "Reduce exposition", "Increase tension",
  "Find plot holes", "Summarize scene",
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
            <div className="max-w-[680px] mx-auto mt-4 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => {
                const text = blocks.filter((b) => b.block_type !== "note").map(formatExport).join("\n\n");
                navigator.clipboard.writeText(text);
                toast.success("Screenplay copied to clipboard");
              }}><Copy className="h-3.5 w-3.5 mr-1.5" />Copy Screenplay</Button>
            </div>
          )}
        </section>

        {/* AI Sidebar */}
        <aside className="hidden lg:block border-l border-border/60 p-4 min-h-[calc(100vh-104px)] bg-card/20">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">AI Assistant</h3>
          </div>
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
        </aside>
      </div>
    </AppShell>
  );
}

function BlockEditor({ block, onUpdate, onDelete }: { block: any; onUpdate: (patch: { content?: string; block_type?: string }) => void; onDelete: () => void }) {
  const [val, setVal] = useState(block.content);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setVal(block.content); }, [block.content]);

  const flush = () => { if (val !== block.content) onUpdate({ content: val }); };

  // auto-resize
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [val]);

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

  return (
    <div className={`group relative blk-${block.block_type}`}>
      <textarea
        ref={ref}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={flush}
        placeholder={placeholder[block.block_type]}
        rows={1}
        className="w-full bg-transparent border-none outline-none resize-none focus:bg-primary/5 rounded px-1 -mx-1 placeholder:text-muted-foreground/40"
        style={{ fontFamily: "inherit", fontSize: "inherit", color: "inherit", textAlign: "inherit", textTransform: "inherit", fontWeight: "inherit", fontStyle: "inherit" } as any}
      />
      <div className="absolute -left-12 top-0 opacity-0 group-hover:opacity-100 transition flex flex-col gap-0.5 font-sans">
        <Select value={block.block_type} onValueChange={(v) => onUpdate({ block_type: v })}>
          <SelectTrigger className="h-6 w-10 text-[10px] px-1"><span>{block.block_type[0].toUpperCase()}</span></SelectTrigger>
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
  const c = b.content;
  switch (b.block_type) {
    case "scene_heading": return c.toUpperCase();
    case "character": return `\t\t\t${c.toUpperCase()}`;
    case "dialogue": return `\t\t${c}`;
    case "parenthetical": return `\t\t\t(${c.replace(/^\(|\)$/g, "")})`;
    case "transition": return `\t\t\t\t\t${c.toUpperCase()}`;
    case "shot": return c.toUpperCase();
    default: return c;
  }
}
