import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, Compass, Drama, Type, NotebookPen, Headphones, Users, MicVocal, Copy, History } from "lucide-react";
import { DraftHistoryPanel } from "@/components/editor/DraftHistoryPanel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "@tanstack/react-router";
import { CoachPanel } from "@/components/editor/CoachPanel";
import { WriterInsightsPanel } from "@/components/editor/WriterInsightsPanel";
import { CoachModeToggle } from "@/components/editor/CoachModeToggle";
import { ArcSidebar } from "@/components/arc/ArcSidebar";
import { BLOCK_LABEL } from "@/lib/editor/autoFormat";
import { nextBlockTypeAfter } from "./screenplayKeymap";
import { toast } from "sonner";
import type { Block } from "@/lib/editor/manuscriptAnalyzer";
import { tallyCharacters, buildOutline } from "@/lib/editor/manuscriptAnalyzer";
import { SceneDataCard } from "@/components/editor/coach/SceneDataCard";
import { AskCoachInput } from "@/components/editor/coach/AskCoachInput";
import { StoryBuilderPanel } from "@/components/editor/story-builder/StoryBuilderPanel";
import { LevelIntegrationPanel } from "@/components/editor/LevelIntegrationPanel";

type Props = {
  projectId: string;
  blocks: Block[];
  activeBlockId?: string | null;
  activeBlockType: string | null;
  defaultTab?: string;
  onOpenStoryBuilder: () => void;
  // AI panel wiring (existing flow)
  aiTools: string[];
  aiTool: string;
  setAiTool: (t: string) => void;
  aiPrompt: string;
  setAiPrompt: (p: string) => void;
  aiOutput: string;
  aiLoading: boolean;
  onRunAi: () => void;
};



const FORMAT_TIPS: { type: string; tip: string }[] = [
  { type: "scene_heading", tip: "Always start with INT. or EXT. Add — DAY/NIGHT to clarify time." },
  { type: "action", tip: "Write in present tense. Describe what we can see and hear, not what characters feel." },
  { type: "character", tip: "ALL CAPS, centered above dialogue. Use (V.O.) for voiceover, (O.S.) for off-screen." },
  { type: "dialogue", tip: "Subtext beats statement. What is the character really saying underneath?" },
  { type: "parenthetical", tip: "Use sparingly. Only when delivery truly matters. (whispering), (firm)." },
  { type: "transition", tip: "CUT TO: / FADE TO: — right-aligned. Most modern scripts skip these except FADE IN/OUT." },
];

export function CoachPane({
  projectId,
  blocks,
  activeBlockId,
  activeBlockType,
  defaultTab = "coach",
  onOpenStoryBuilder,
  aiTools,
  aiTool,
  setAiTool,
  aiPrompt,
  setAiPrompt,
  aiOutput,
  aiLoading,
  onRunAi,
}: Props) {
  const sceneText = useMemo(
    () => blocks.filter((b) => b.block_type !== "note").map((b) => `[${b.block_type}] ${b.content}`).join("\n").slice(-6000),
    [blocks]
  );
  const outlineForScene = useMemo(() => buildOutline(blocks), [blocks]);
  const activeSceneIndex = useMemo(() => {
    if (!activeBlockId) return -1;
    const block = blocks.find((b) => b.id === activeBlockId);
    if (!block) return -1;
    return outlineForScene.findIndex(
      (s) => block.order_index >= s.startOrder && block.order_index <= s.endOrder,
    );
  }, [activeBlockId, blocks, outlineForScene]);

  const characters = useMemo(() => tallyCharacters(blocks), [blocks]);
  const outline = useMemo(() => buildOutline(blocks), [blocks]);
  const currentLabel = activeBlockType ? BLOCK_LABEL[activeBlockType] ?? activeBlockType : "—";
  const nextLabel = activeBlockType ? BLOCK_LABEL[nextBlockTypeAfter(activeBlockType)] ?? "" : "";

  const [notes, setNotes] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(`editor-notes:${projectId}`) ?? "";
  });
  const onNotesChange = (v: string) => {
    setNotes(v);
    if (typeof window !== "undefined") localStorage.setItem(`editor-notes:${projectId}`, v);
  };

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="w-full rounded-none border-b border-border/40 bg-transparent h-10 grid grid-cols-8 px-1 gap-0.5">
        <TabsTrigger value="coach" className="text-[10px] px-1" title="Director's Chair"><Compass className="h-3.5 w-3.5" /></TabsTrigger>
        <TabsTrigger value="builder" className="text-[10px] px-1" title="Story Builder"><Sparkles className="h-3.5 w-3.5" /></TabsTrigger>
        <TabsTrigger value="arc" className="text-[10px] px-1" title="Story Spine"><Drama className="h-3.5 w-3.5" /></TabsTrigger>
        <TabsTrigger value="cast" className="text-[10px] px-1" title="Casting Wall"><Users className="h-3.5 w-3.5" /></TabsTrigger>
        <TabsTrigger value="takes" className="text-[10px] px-1" title="Takes & Revisions"><History className="h-3.5 w-3.5" /></TabsTrigger>
        <TabsTrigger value="format" className="text-[10px] px-1" title="Format"><Type className="h-3.5 w-3.5" /></TabsTrigger>
        <TabsTrigger value="notes" className="text-[10px] px-1" title="Notes"><NotebookPen className="h-3.5 w-3.5" /></TabsTrigger>
        <TabsTrigger value="tableread" className="text-[10px] px-1" title="Rehearsal Room"><Headphones className="h-3.5 w-3.5" /></TabsTrigger>
      </TabsList>

      {/* DIRECTOR'S CHAIR */}
      <TabsContent value="coach" className="m-0 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold flex items-center gap-1.5 text-sm"><Compass className="h-4 w-4 text-primary" />Director's Chair</h3>
          <CoachModeToggle />
        </div>
        <CoachPanel sceneText={sceneText} blockCount={blocks.length} />
        <SceneDataCard projectId={projectId} activeSceneIndex={activeSceneIndex} />
        <WriterInsightsPanel projectId={projectId} />
        {aiOutput && (
          <div className="border-t border-border/40 pt-3 mt-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Last AI Response</p>
            <ScrollArea className="h-[220px] rounded-md border border-border/60 bg-background/50 p-3">
              <p className="text-xs whitespace-pre-wrap text-foreground/90 font-mono">{aiOutput}</p>
            </ScrollArea>
            <Button variant="outline" size="sm" className="w-full" onClick={() => { navigator.clipboard.writeText(aiOutput); toast.success("Copied"); }}>
              <Copy className="h-3.5 w-3.5 mr-1.5" />Copy
            </Button>
          </div>
        )}
        <details className="border-t border-border/40 pt-3 mt-3">
          <summary className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold cursor-pointer hover:text-foreground">
            Studio Tools
          </summary>
          <div className="mt-2 space-y-2">
            <Select value={aiTool} onValueChange={setAiTool}>
              <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>{aiTools.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Specific instructions (optional)…"
              className="text-xs min-h-[60px]"
            />
            <Button className="w-full" size="sm" onClick={onRunAi} disabled={aiLoading}>
              {aiLoading ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Thinking…</> : <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Run tool</>}
            </Button>
          </div>
        </details>
        <AskCoachInput
          onAsk={(prompt) => { setAiPrompt(prompt); onRunAi(); }}
          loading={aiLoading}
        />
      </TabsContent>

      {/* STORY BUILDER */}
      <TabsContent value="builder" className="m-0 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold flex items-center gap-1.5 text-sm"><Sparkles className="h-4 w-4 text-primary" />Story Builder</h3>
          <Button onClick={onOpenStoryBuilder} size="sm" variant="outline" className="h-7 text-[11px]">
            <Sparkles className="h-3 w-3 mr-1" />AI draft
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Build your story spine section by section. Each step you complete unlocks the next.
        </p>
        <StoryBuilderPanel projectId={projectId} blocks={blocks} onOpenStoryBuilder={onOpenStoryBuilder} />
      </TabsContent>


      {/* ARC */}
      <TabsContent value="arc" className="m-0">
        <ArcSidebar projectId={projectId} />
      </TabsContent>

      {/* CHARACTERS — script-derived speakers, not the saved cast table. */}
      <TabsContent value="cast" className="m-0 p-4 space-y-3">
        <div>
          <h3 className="font-semibold flex items-center gap-1.5 text-sm">
            <Users className="h-4 w-4 text-primary" />Detected Speakers
          </h3>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono mt-1">
            From your script · saved cast lives in the workshop
          </p>
        </div>
        {characters.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No speakers yet. They appear here as you write dialogue.</p>
        ) : (
          <ul className="space-y-1.5">
            {characters.map((c) => (
              <li key={c.name} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-md bg-muted/30 border border-border/40">
                <span className="font-medium">{c.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{c.lineCount} line{c.lineCount === 1 ? "" : "s"}</span>
              </li>
            ))}
          </ul>
        )}
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link to="/characters/$projectId" params={{ projectId }}>Open Casting Wall</Link>
        </Button>
      </TabsContent>

      {/* TAKES & REVISIONS */}
      <TabsContent value="takes" className="m-0 p-4 space-y-3">
        <div>
          <h3 className="font-semibold flex items-center gap-1.5 text-sm">
            <History className="h-4 w-4 text-primary" />Takes &amp; Revisions
          </h3>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono mt-1">
            Roll cameras · slate · roll back
          </p>
        </div>
        <DraftHistoryPanel projectId={projectId} />
      </TabsContent>

      {/* FORMAT */}
      <TabsContent value="format" className="m-0 p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-1.5 text-sm"><Type className="h-4 w-4 text-primary" />Format</h3>
        <div className="rounded-md border border-border/60 bg-card/50 p-3 text-xs space-y-1.5">
          <p className="flex justify-between"><span className="text-muted-foreground">Current block:</span> <strong>{currentLabel}</strong></p>
          {nextLabel && <p className="flex justify-between"><span className="text-muted-foreground">After Enter:</span> <strong>{nextLabel}</strong></p>}
        </div>
        <div className="space-y-2">
          {FORMAT_TIPS.map((t) => (
            <div
              key={t.type}
              className={`rounded-md p-2 text-xs ${
                activeBlockType === t.type ? "border border-primary/40 bg-primary/5" : "border border-border/40 bg-card/30"
              }`}
            >
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">{BLOCK_LABEL[t.type]}</p>
              <p className="text-foreground/85">{t.tip}</p>
            </div>
          ))}
        </div>
      </TabsContent>

      {/* NOTES */}
      <TabsContent value="notes" className="m-0 p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-1.5 text-sm"><NotebookPen className="h-4 w-4 text-primary" />Notes</h3>
        <p className="text-xs text-muted-foreground">
          Free notepad for ideas, research, or reminders. Saved on this device.
        </p>
        <Textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Jot ideas, research notes, scene fixes to revisit…"
          className="text-xs min-h-[280px] font-mono"
        />
      </TabsContent>

      {/* TABLE READ */}
      <TabsContent value="tableread" className="m-0 p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-1.5 text-sm"><MicVocal className="h-4 w-4 text-primary" />Table Read</h3>
        <p className="text-xs text-muted-foreground">
          Hear your dialogue performed by AI voices. Cast characters with ElevenLabs voices in the Table Read workspace.
        </p>
        <Button asChild className="w-full" size="sm">
          <Link to="/tableread/$projectId" params={{ projectId }}>
            <Headphones className="h-3.5 w-3.5 mr-1.5" />Open Table Read
          </Link>
        </Button>
      </TabsContent>
    </Tabs>
  );
}

function SectionStatus({ label, done, hint }: { label: string; done: boolean; hint?: string }) {
  return (
    <div className={`flex items-center justify-between px-2 py-1.5 rounded-md border ${done ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/60 bg-card/30"}`}>
      <span className="text-foreground/85">{label}</span>
      <span className="text-[10px] text-muted-foreground">{hint ?? (done ? "Started" : "Not yet")}</span>
    </div>
  );
}
