import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ProjectNav } from "@/components/ProjectNav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Plus, Trash2, Loader2, Copy, Command, ArrowLeft, HelpCircle, PanelLeft, PanelRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { aiAssist } from "@/lib/ai.functions";
import { listProjectCharacters, upsertCharacter } from "@/lib/characters.functions";
import { updateGuidedStep } from "@/lib/academy.functions";
import { AutosaveIndicator } from "@/components/editor/AutosaveIndicator";
import type { AutosaveStatus } from "@/hooks/use-autosave";
import { GuidedRail } from "@/components/guided/GuidedRail";
import { CharacterAutocomplete, type CharacterHit } from "@/components/editor/CharacterAutocomplete";
import { SceneBeatPicker } from "@/components/editor/SceneBeatPicker";
import { StepCoach } from "@/components/editor/StepCoach";
import { EmptyEditorTeacher } from "@/components/editor/EmptyEditorTeacher";
import { LoglineComposer } from "@/components/editor/LoglineComposer";
import { progressForStep, shouldUseLoglineComposer, shouldRedirectStep } from "@/lib/editor/stepCompletion";
import { OPENING_SCENE_TEMPLATE } from "@/lib/editor/openingTemplate";
import { ArrowRight } from "lucide-react";
import { EditorTour } from "@/components/editor/EditorTour";
import { useEditorTour } from "@/hooks/useEditorTour";
import { EditorCommandBar } from "@/components/editor/EditorCommandBar";
import { nextBlockTypeAfter, cycleType } from "@/lib/editor/nextBlockType";
import { detectBlockType, BLOCK_LABEL } from "@/lib/editor/autoFormat";
import { StoryNavigatorPane } from "@/components/editor/StoryNavigatorPane";
import { CoachPane } from "@/components/editor/CoachPane";
import { StoryBuilder } from "@/components/editor/StoryBuilder";
import { StudioModeToggle } from "@/components/editor/StudioModeToggle";
import { FeatureDock } from "@/components/editor/FeatureDock";
import { GuidedStepStrip } from "@/components/editor/GuidedStepStrip";
import { CanvasToolbar } from "@/components/editor/CanvasToolbar";
import { useManuscriptAnalyzer } from "@/hooks/useManuscriptAnalyzer";
import { useOnboarding } from "@/hooks/use-onboarding";
import { buildOutline, estimatePages } from "@/lib/editor/manuscriptAnalyzer";
import { BookOpen } from "lucide-react";
import { useWriterEvents } from "@/hooks/useWriterEvents";
import { useWriteMode } from "@/hooks/use-write-mode";
import { PencilLine } from "lucide-react";

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
  const listChars = useServerFn(listProjectCharacters);
  const createChar = useServerFn(upsertCharacter);
  const { data: characters = [] } = useQuery({
    queryKey: ["characters", projectId],
    queryFn: () => listChars({ data: { projectId } }) as Promise<CharacterHit[]>,
  });
  const createCharacter = useMutation({
    mutationFn: (name: string) => createChar({ data: { project_id: projectId, patch: { name } } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["characters", projectId] }),
  });

  const [focusBlockId, setFocusBlockId] = useState<string | null>(null);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

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

  const emitEvent = useWriterEvents();

  const addBlock = useMutation({
    mutationFn: async (block_type: string) => {
      const order_index = blocks.length;
      const { data, error } = await supabase.from("script_blocks")
        .insert({ project_id: projectId, block_type, content: "", order_index })
        .select().single();
      if (error) throw error;
      return data;
    },
    onMutate: async (block_type: string) => {
      await qc.cancelQueries({ queryKey: ["blocks", projectId] });
      const prev = qc.getQueryData<any[]>(["blocks", projectId]) ?? [];
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const temp = { id: tempId, project_id: projectId, block_type, content: "", order_index: prev.length, metadata: null };
      qc.setQueryData<any[]>(["blocks", projectId], [...prev, temp]);
      setFocusBlockId(tempId);
      return { tempId, prev };
    },
    onSuccess: (data, block_type, ctx: any) => {
      qc.setQueryData<any[]>(["blocks", projectId], (old) =>
        (old ?? []).map((b) => (b.id === ctx?.tempId ? data : b))
      );
      if (data?.id) setFocusBlockId(data.id);
      emitEvent({ event_type: "block_created", project_id: projectId, context: { block_type } });
      if (block_type === "scene_heading") {
        emitEvent({ event_type: "scene_created", project_id: projectId, context: { has_turn: false } });
      }
    },
    onError: (_e, _v, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(["blocks", projectId], ctx.prev);
    },
  });

  const insertBlockAfter = useMutation({
    mutationFn: async ({ block_type, afterOrder }: { block_type: string; afterOrder: number }) => {
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
    onMutate: async ({ block_type, afterOrder }) => {
      await qc.cancelQueries({ queryKey: ["blocks", projectId] });
      const prev = qc.getQueryData<any[]>(["blocks", projectId]) ?? [];
      const sorted = [...prev].sort((a, b) => a.order_index - b.order_index);
      const idx = sorted.findIndex((b) => b.order_index === afterOrder);
      const nextOrder = idx >= 0 && sorted[idx + 1] ? sorted[idx + 1].order_index : afterOrder + 1;
      const newOrder = (afterOrder + nextOrder) / 2;
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const temp = { id: tempId, project_id: projectId, block_type, content: "", order_index: newOrder, metadata: null };
      qc.setQueryData<any[]>(["blocks", projectId], [...prev, temp].sort((a, b) => a.order_index - b.order_index));
      setFocusBlockId(tempId);
      return { tempId, prev };
    },
    onSuccess: (data, _vars, ctx: any) => {
      qc.setQueryData<any[]>(["blocks", projectId], (old) =>
        (old ?? []).map((b) => (b.id === ctx?.tempId ? data : b))
      );
      if (data?.id) setFocusBlockId(data.id);
    },
    onError: (_e, _v, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(["blocks", projectId], ctx.prev);
      toast.error("Couldn't insert line");
    },
  });

  const saveBlock = useCallback(async (id: string, patch: { content?: string; block_type?: string; metadata?: Record<string, any> }) => {
    if (id.startsWith("temp-")) return; // optimistic row; ignore until server returns real id
    markSaving();
    try {
      const update: any = {};
      if (patch.content !== undefined) update.content = patch.content;
      if (patch.block_type) update.block_type = patch.block_type;
      if (patch.metadata !== undefined) update.metadata = patch.metadata;
      const { error } = await supabase.from("script_blocks").update(update).eq("id", id);
      if (error) throw error;
      if (patch.content !== undefined) clearDraft(id);
      markSaved();
      if (patch.metadata !== undefined) qc.invalidateQueries({ queryKey: ["blocks", projectId] });
      // Silent refresh — don't refetch while user is typing
    } catch (e: any) {
      markError();
      toast.error("Couldn't save — your work is kept locally and will retry on next edit");
    }
  }, [clearDraft, markError, markSaved, markSaving, qc, projectId]);

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

  // Bulk insert template / starter blocks
  const insertTemplate = useMutation({
    mutationFn: async (template: { block_type: string; content: string }[]) => {
      const startOrder = blocks.length;
      const rows = template.map((t, i) => ({
        project_id: projectId,
        block_type: t.block_type,
        content: t.content,
        order_index: startOrder + i,
      }));
      const { error } = await supabase.from("script_blocks").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blocks", projectId] }),
  });

  // Guided step: mark complete + advance
  const updateStep = useServerFn(updateGuidedStep);
  const markStepComplete = useMutation({
    mutationFn: async (stepKey: string) => {
      await updateStep({ data: { projectId, stepKey, status: "complete" } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guided-rail", projectId] });
      qc.invalidateQueries({ queryKey: ["first-screenplay", projectId] });
      toast.success("Step complete — onward!");
    },
    onError: (e: any) => toast.error(e.message ?? "Couldn't update step"),
  });

  const [aiTool, setAiTool] = useState(AI_TOOLS[0]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiOutput, setAiOutput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const runAi = async () => {
    setAiLoading(true);
    setAiOutput("");
    emitEvent({ event_type: "ai_request", project_id: projectId, context: { tool: aiTool } });
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

  // ====== Guided-step coach wiring ======
  const projectCtx = `Title: ${project?.title ?? ""}\nType: ${project?.project_type ?? ""}\nGenre: ${project?.genre ?? ""}\nTone: ${project?.tone ?? ""}\nLogline: ${project?.logline ?? ""}`;
  const stepProgress = progressForStep(guidedStep, blocks as any, project as any);
  const redirect = shouldRedirectStep(guidedStep);
  const isLoglineStep = shouldUseLoglineComposer(guidedStep);

  const [primaryBusy, setPrimaryBusy] = useState(false);

  const draftOpeningWithAi = useCallback(async () => {
    setPrimaryBusy(true);
    try {
      const res = await callAi({
        data: {
          projectId,
          tool: "openingScene",
          prompt: "Draft a 1-2 page opening scene as screenplay blocks. Use FADE IN, scene heading (INT./EXT.), action, character, dialogue. Keep it tight and visual.",
          context: projectCtx,
        },
      });
      // Parse simple [block_type] content lines if present; otherwise fall back to action lines
      const parsed: { block_type: string; content: string }[] = [];
      const lines = res.text.split("\n").map((l: string) => l.trim()).filter(Boolean);
      const tagRe = /^\[(scene_heading|action|character|dialogue|parenthetical|transition|shot|note)\]\s*(.*)$/i;
      for (const l of lines) {
        const m = l.match(tagRe);
        if (m) parsed.push({ block_type: m[1].toLowerCase(), content: m[2] });
        else if (/^(INT\.|EXT\.)/i.test(l)) parsed.push({ block_type: "scene_heading", content: l });
        else if (/^FADE (IN|OUT)/i.test(l) || /^CUT TO:/i.test(l)) parsed.push({ block_type: "transition", content: l });
        else if (/^[A-Z][A-Z\s\-\.']{2,}$/.test(l) && l.length < 40) parsed.push({ block_type: "character", content: l });
        else parsed.push({ block_type: "action", content: l });
      }
      await insertTemplate.mutateAsync(parsed.length > 0 ? parsed : OPENING_SCENE_TEMPLATE);
      toast.success("Drafted an opening — refine it from here");
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't draft scene");
    } finally {
      setPrimaryBusy(false);
    }
  }, [callAi, projectId, projectCtx, insertTemplate]);

  const handleCoachPrimary = useCallback(async () => {
    if (!stepProgress.primaryAction) return;
    const kind = stepProgress.primaryAction.kind;
    if (kind === "insert") {
      await insertTemplate.mutateAsync(OPENING_SCENE_TEMPLATE);
      toast.success("Opening template inserted");
      return;
    }
    if (kind === "ai") {
      if (guidedStep === "opening_scene") return draftOpeningWithAi();
      const tool = guidedStep === "rough_draft" ? "Find plot holes" : guidedStep === "act1" ? "Build outline" : "Build outline";
      setPrimaryBusy(true);
      try {
        const res = await callAi({ data: { projectId, tool, prompt: stepProgress.primaryAction.label, context: projectCtx } });
        setAiOutput(res.text);
        setAiTool(tool);
        toast.success("AI response ready in the right panel");
      } catch (e: any) {
        toast.error(e.message ?? "AI request failed");
      } finally {
        setPrimaryBusy(false);
      }
      return;
    }
  }, [stepProgress, guidedStep, insertTemplate, draftOpeningWithAi, callAi, projectId, projectCtx]);

  const handleMarkComplete = useCallback(async () => {
    if (!guidedStep) return;
    await markStepComplete.mutateAsync(guidedStep);
  }, [guidedStep, markStepComplete]);

  const startFromScratch = useCallback(async () => {
    await addBlock.mutateAsync("scene_heading");
  }, [addBlock]);

  const tour = useEditorTour();
  const [storyBuilderOpen, setStoryBuilderOpen] = useState(false);
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const writeMode = useWriteMode();

  // Default right pane tab follows the user's preferred mode (Guided → Builder, Studio → Coach).
  const { data: onboarding } = useOnboarding();
  const coachDefaultTab = onboarding?.preferred_mode === "guided" ? "builder" : "coach";

  // Global Cmd/Ctrl+1–7 → set active block's type
  const setActiveBlockType = useCallback((type: string) => {
    const activeId = activeBlockId;
    if (!activeId) return;
    void saveBlock(activeId, { block_type: type });
    toast.success(`→ ${BLOCK_LABEL[type] ?? type}`, { duration: 1000 });
  }, [activeBlockId, saveBlock]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const map: Record<string, string> = {
        "1": "scene_heading",
        "2": "action",
        "3": "character",
        "4": "dialogue",
        "5": "parenthetical",
        "6": "transition",
        "7": "shot",
      };
      const t = map[e.key];
      if (t) {
        e.preventDefault();
        setActiveBlockType(t);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setActiveBlockType]);

  // Background auto-analyzer: detect new characters + sync scenes table.
  useManuscriptAnalyzer({
    projectId,
    blocks: blocks as any,
    existingCharacterNames: (characters as any[]).map((c) => c.name),
  });

  // Auto-seed: if the editor is opened on a writing step with no blocks and no
  // step-specific composer in front of it, drop a single scene heading and
  // park focus there so the writer can just start typing.
  const autoSeededRef = useRef(false);
  useEffect(() => {
    if (autoSeededRef.current) return;
    if (blocksLoading) return;
    if (blocks.length > 0) return;
    if (isLoglineStep || redirect) return;
    // Only auto-seed when arriving from the guided path on a writing step,
    // or when the user has no logline-style work pending. Skip if step is set
    // and not a writing step.
    if (guidedStep && !["opening_scene", "act1", "act2", "act3", "rough_draft", "first_scene", "write_first_scene"].includes(guidedStep)) return;
    autoSeededRef.current = true;
    // Wait one tick so the dialog/empty-state animations don't fight the focus.
    setTimeout(() => {
      addBlock.mutate("scene_heading");
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocksLoading, blocks.length, isLoglineStep, redirect, guidedStep]);

  // After auto-seed, focus the new (single) empty block.
  useEffect(() => {
    if (blocks.length === 1 && !blocks[0].content && focusBlockId !== blocks[0].id) {
      setFocusBlockId(blocks[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks.length]);

  // Derived: outline + page count for the manuscript header.
  const outline = buildOutline(blocks as any);
  const pageCount = estimatePages(blocks as any);
  const activeSceneIdx = (() => {
    if (!activeBlockId) return -1;
    const b = blocks.find((x: any) => x.id === activeBlockId);
    if (!b) return -1;
    return outline.findIndex((s) => b.order_index >= s.startOrder && b.order_index <= s.endOrder);
  })();
  const activeScene = activeSceneIdx >= 0 ? outline[activeSceneIdx] : null;

  const jumpToBlock = useCallback((blockId: string) => {
    setFocusBlockId(blockId);
    if (typeof document !== "undefined") {
      // Scroll into view if rendered.
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement | null;
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }, []);

  const addSceneAtEnd = useCallback(() => {
    addBlock.mutate("scene_heading");
  }, [addBlock]);

  const activeBlock = blocks.find((b: any) => b.id === activeBlockId) ?? null;
  const activeIndex = activeBlock ? blocks.findIndex((b: any) => b.id === activeBlock.id) : -1;
  const prevType = activeIndex > 0 ? blocks[activeIndex - 1]?.block_type : undefined;

  const cmdCycleType = useCallback(() => {
    if (!activeBlock) return;
    const next = cycleType(activeBlock.block_type);
    void saveBlock(activeBlock.id, { block_type: next });
    toast.success(`→ ${BLOCK_LABEL[next] ?? next}`, { duration: 1200 });
  }, [activeBlock, saveBlock]);

  const cmdNewLine = useCallback(() => {
    if (activeBlock) {
      const nextType = nextBlockTypeAfter(activeBlock.block_type, prevType);
      insertBlockAfter.mutate({ block_type: nextType, afterOrder: activeBlock.order_index });
    } else if (blocks.length === 0) {
      addBlock.mutate("scene_heading");
    } else {
      const last = blocks[blocks.length - 1];
      const nextType = nextBlockTypeAfter(last.block_type);
      insertBlockAfter.mutate({ block_type: nextType, afterOrder: last.order_index });
    }
  }, [activeBlock, prevType, blocks, insertBlockAfter, addBlock]);

  const [aiContinueBusy, setAiContinueBusy] = useState(false);
  const cmdAiContinue = useCallback(async () => {
    setAiContinueBusy(true);
    try {
      const tail = blocks
        .slice(-20)
        .filter((b: any) => b.block_type !== "note")
        .map((b: any) => `[${b.block_type}] ${b.content}`)
        .join("\n");
      const res = await callAi({
        data: {
          projectId,
          tool: "continueScene",
          prompt:
            "Continue the screenplay from where it stops. Reply with one or more lines, each prefixed with [scene_heading]/[action]/[character]/[dialogue]/[parenthetical]/[transition]. Keep it tight and visual.",
          context: `${projectCtx}\n\nSCRIPT SO FAR:\n${tail.slice(-4000)}`,
        },
      });
      const lines = res.text.split("\n").map((l: string) => l.trim()).filter(Boolean);
      const tagRe = /^\[(scene_heading|action|character|dialogue|parenthetical|transition|shot|note)\]\s*(.*)$/i;
      const parsed: { block_type: string; content: string }[] = [];
      for (const l of lines) {
        const m = l.match(tagRe);
        if (m) parsed.push({ block_type: m[1].toLowerCase(), content: m[2] });
        else parsed.push({ block_type: "action", content: l });
      }
      if (parsed.length > 0) {
        await insertTemplate.mutateAsync(parsed);
        toast.success(`Added ${parsed.length} line${parsed.length === 1 ? "" : "s"}`);
      }
    } catch (e: any) {
      toast.error(e.message ?? "AI request failed");
    } finally {
      setAiContinueBusy(false);
    }
  }, [blocks, callAi, projectId, projectCtx, insertTemplate]);




  return (
    <AppShell>
      <ProjectNav projectId={projectId} title={project?.title} />
      <GuidedRail projectId={projectId} />
      <div className="max-w-[1600px] mx-auto px-6 lg:px-10 pt-3 flex items-center justify-between gap-3 flex-wrap">
        {fromGuided ? (
          <Link
            to="/first-screenplay/$projectId"
            params={{ projectId }}
            hash={guidedStep ? `step-${guidedStep}` : undefined}
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to guided path{guidedStep ? ` · ${guidedStep.replace(/_/g, " ")}` : ""}
          </Link>
        ) : <span />}
        <div className="flex items-center gap-3">
          <StudioModeToggle />
          <button
            onClick={writeMode.toggle}
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border transition-colors ${
              writeMode.on
                ? "bg-primary text-primary-foreground border-primary font-semibold shadow-sm"
                : "border-border/60 bg-card/60 text-muted-foreground hover:text-foreground"
            }`}
            title="Hide side panels and focus on the page"
          >
            <PencilLine className="h-3 w-3" /> Write
          </button>
          {/* Mobile pane toggles */}
          <Sheet open={leftDrawerOpen} onOpenChange={setLeftDrawerOpen}>
            <SheetTrigger asChild>
              <button className="lg:hidden inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition rounded-md border border-border/60 px-2 py-1" title="Story Navigator">
                <PanelLeft className="h-3.5 w-3.5" /> Scenes
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] p-4 overflow-auto">
              <StoryNavigatorPane
                projectId={projectId}
                projectTitle={project?.title}
                projectType={project?.project_type}
                genre={project?.genre ?? undefined}
                blocks={blocks as any}
                activeBlockId={activeBlockId}
                onJumpToBlock={(id) => { jumpToBlock(id); setLeftDrawerOpen(false); }}
                onAddScene={() => { addSceneAtEnd(); setLeftDrawerOpen(false); }}
              />
            </SheetContent>
          </Sheet>
          <Sheet open={rightDrawerOpen} onOpenChange={setRightDrawerOpen}>
            <SheetTrigger asChild>
              <button className="lg:hidden inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition rounded-md border border-border/60 px-2 py-1" title="Coach">
                <PanelRight className="h-3.5 w-3.5" /> Coach
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[360px] p-0 overflow-auto">
              <CoachPane
                projectId={projectId}
                blocks={blocks as any}
                activeBlockId={activeBlockId}
                activeBlockType={activeBlock?.block_type ?? null}
                defaultTab={coachDefaultTab}
                onOpenStoryBuilder={() => { setStoryBuilderOpen(true); setRightDrawerOpen(false); }}
                aiTools={AI_TOOLS}
                aiTool={aiTool}
                setAiTool={setAiTool}
                aiPrompt={aiPrompt}
                setAiPrompt={setAiPrompt}
                aiOutput={aiOutput}
                aiLoading={aiLoading}
                onRunAi={runAi}
              />
            </SheetContent>
          </Sheet>
          <button
            onClick={tour.start}
            className="hidden md:inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
            title="Replay the editor tour"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Replay tour
          </button>
          <AutosaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
        </div>

      </div>
      {recovery && (
        <div className="max-w-[1600px] mx-auto px-6 lg:px-10 pt-3">
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 flex items-center gap-3 flex-wrap">
            <p className="text-sm flex-1">
              We found <strong>{Object.keys(recovery).length}</strong> unsaved
              {Object.keys(recovery).length === 1 ? " change" : " changes"} from your last session.
            </p>
            <Button size="sm" onClick={restoreRecovery}>Restore</Button>
            <Button size="sm" variant="outline" onClick={discardRecovery}>Discard</Button>
          </div>
        </div>
      )}
      {onboarding?.preferred_mode === "guided" && (
        <GuidedStepStrip
          projectId={projectId}
          currentStep={guidedStep ?? null}
          completedCount={0}
        />
      )}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_340px] max-w-[1600px] mx-auto">

        {/* Left rail — Story Navigator (desktop) */}
        <aside data-tour="block-toolbar" className="hidden lg:block border-r border-border/60 p-4 min-h-[calc(100vh-104px)] sticky top-0 self-start max-h-[calc(100vh-104px)] overflow-auto bg-card/20">
          <StoryNavigatorPane
            projectId={projectId}
            projectTitle={project?.title}
            projectType={project?.project_type}
            genre={project?.genre ?? undefined}
            blocks={blocks as any}
            activeBlockId={activeBlockId}
            onJumpToBlock={jumpToBlock}
            onAddScene={addSceneAtEnd}
          />
        </aside>



        {/* Editor */}
        <section className="min-h-[calc(100vh-104px)] p-6 lg:p-10 screenplay-canvas">
          {/* Guided helpers — collapsible so they never block the canvas */}
          {(guidedStep || redirect || isLoglineStep) && (
            <details className="max-w-[760px] mx-auto mb-4 group font-sans" open>
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-border/60 bg-card/40 text-xs text-muted-foreground hover:bg-card/60">
                <span className="flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>
                    Guided step{guidedStep ? `: ${guidedStep.replace(/_/g, " ")}` : ""}
                  </span>
                </span>
                <span className="text-[10px] uppercase tracking-wider opacity-60 group-open:opacity-100">
                  Click to collapse
                </span>
              </summary>
              <div className="mt-3 space-y-3">
                <div data-tour="step-coach">
                  {guidedStep && (
                    <StepCoach
                      projectId={projectId}
                      stepKey={guidedStep}
                      progress={stepProgress}
                      onPrimary={handleCoachPrimary}
                      onMarkComplete={handleMarkComplete}
                      primaryBusy={primaryBusy || insertTemplate.isPending}
                      markBusy={markStepComplete.isPending}
                    />
                  )}
                </div>
                {redirect && (
                  <div className="rounded-lg border border-border bg-card/50 p-3 flex items-center gap-3 flex-wrap">
                    <p className="text-xs flex-1">
                      This step has a dedicated page: <strong>{redirect.destination}</strong>.
                    </p>
                    <Button asChild size="sm" variant="outline">
                      <Link
                        to={
                          redirect.destination === "characters" ? "/characters/$projectId" :
                          redirect.destination === "story-arc" ? "/story-arc/$projectId" :
                          redirect.destination === "scenes" ? "/scenes/$projectId" :
                          redirect.destination === "pitch" ? "/pitch/$projectId" :
                          "/tableread/$projectId"
                        }
                        params={{ projectId }}
                      >
                        Open {redirect.destination} <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </Link>
                    </Button>
                  </div>
                )}
                {isLoglineStep && (
                  <LoglineComposer
                    projectId={projectId}
                    initialLogline={project?.logline}
                    projectContext={projectCtx}
                  />
                )}
              </div>
            </details>
          )}

          {/* Manuscript header — page/scene counter + outline button */}
          <div className="max-w-[680px] mx-auto mb-3 flex items-center justify-between gap-3 font-sans px-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" />
              <span className="font-mono tabular-nums">
                Page {Math.max(1, Math.min(pageCount, Math.ceil(((activeBlockId ? blocks.findIndex((b: any) => b.id === activeBlockId) + 1 : blocks.length) / Math.max(1, blocks.length)) * pageCount)))} of {pageCount}
              </span>
              {activeScene && (
                <>
                  <span className="opacity-40">·</span>
                  <span>Act {activeScene.act === 1 ? "I" : activeScene.act === 2 ? "II" : "III"} · Scene {activeScene.index + 1} of {outline.length}</span>
                </>
              )}
              {!activeScene && outline.length > 0 && (
                <>
                  <span className="opacity-40">·</span>
                  <span>{outline.length} scene{outline.length === 1 ? "" : "s"}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-md font-semibold"
                onClick={() => setStoryBuilderOpen(true)}
                title="Generate logline, outline, and starter characters"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Story Builder
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={addSceneAtEnd}
                title="Add a new scene heading at the end"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Scene
              </Button>
            </div>
          </div>

          <CanvasToolbar
            blockType={activeBlock?.block_type ?? null}
            onChangeType={(t) => activeBlock && void saveBlock(activeBlock.id, { block_type: t })}
            pageCount={pageCount}
            currentPage={Math.max(1, Math.min(pageCount, Math.ceil(((activeBlockId ? blocks.findIndex((b: any) => b.id === activeBlockId) + 1 : blocks.length) / Math.max(1, blocks.length)) * pageCount)))}
            wordCount={blocks.reduce((n: number, b: any) => n + (b.content?.trim().split(/\s+/).filter(Boolean).length ?? 0), 0)}
            sceneCount={outline.length}
          />

          {/* Discoverable shortcut legend */}
          <div className="max-w-[760px] mx-auto mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-muted-foreground/70 px-1">
            <span><kbd className="px-1 py-0.5 rounded bg-muted/40 border border-border/40">Enter</kbd> next block</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted/40 border border-border/40">Tab</kbd> change type</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted/40 border border-border/40">/</kbd> menu</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted/40 border border-border/40">⌘↵</kbd> AI continue</span>
          </div>

          <div
            className="screenplay screenplay-paper max-w-[760px] mx-auto px-10 lg:px-16 py-12 lg:py-16 cursor-text"
            onMouseDown={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest("textarea, button, input, [role='menu'], [data-block-toolbar]")) return;
              e.preventDefault();
              const all = (e.currentTarget as HTMLElement).querySelectorAll<HTMLTextAreaElement>("textarea");
              if (all.length === 0) { cmdNewLine(); return; }
              const y = e.clientY;
              let best: HTMLTextAreaElement = all[0];
              let bestDist = Infinity;
              all.forEach((t) => {
                const r = t.getBoundingClientRect();
                const d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
                if (d < bestDist) { bestDist = d; best = t; }
              });
              best.focus();
              const len = best.value.length;
              try { best.setSelectionRange(len, len); } catch {}
            }}
          >
            {blocksLoading ? (
              <div className="space-y-3 py-8 font-sans">
                <div className="h-5 w-2/3 bg-muted/50 rounded animate-pulse" />
                <div className="h-4 w-full bg-muted/40 rounded animate-pulse" />
                <div className="h-4 w-5/6 bg-muted/40 rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-muted/40 rounded animate-pulse" />
              </div>
            ) : blocks.length === 0 ? (
              <EmptyEditorTeacher
                hasLogline={!!project?.logline}
                onUseTemplate={() => insertTemplate.mutateAsync(OPENING_SCENE_TEMPLATE)}
                onDraftWithAi={draftOpeningWithAi}
                onStartFromScratch={startFromScratch}
                onOpenStoryBuilder={() => setStoryBuilderOpen(true)}
              />
            ) : (
              <>
                {blocks.map((b, i) => {
                  const isNewScene = b.block_type === "scene_heading" && i > 0;
                  return (
                    <div key={b.id} data-block-id={b.id}>
                      {isNewScene && (
                        <div className="my-6 flex items-center gap-3 font-sans" aria-hidden="true">
                          <div className="h-px flex-1 bg-border/60" />
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-mono">
                            Scene
                          </span>
                          <div className="h-px flex-1 bg-border/60" />
                        </div>
                      )}
                      <BlockEditor
                        block={b}
                        prevBlockType={i > 0 ? blocks[i - 1].block_type : undefined}
                        onSave={(patch) => saveBlock(b.id, patch)}
                        onDirty={(content) => { writeDraft(b.id, content); markDirty(); }}
                        onDelete={() => deleteBlock.mutate(b.id)}
                        onInsertAfter={(block_type) => insertBlockAfter.mutate({ block_type, afterOrder: b.order_index })}
                        focusBlockId={focusBlockId}
                        onFocusDone={() => setFocusBlockId(null)}
                        onActiveChange={(id, active) => setActiveBlockId((prev) => (active ? id : prev === id ? null : prev))}
                        characters={characters}
                        onCreateCharacter={(name) => createCharacter.mutateAsync(name) as Promise<any>}
                      />
                    </div>
                  );
                })}

                {/* Persistent "Add line" ghost row — always visible cursor invitation */}
                <button
                  type="button"
                  onClick={cmdNewLine}
                  className="mt-4 w-full text-left px-3 py-3 rounded-md border border-dashed border-border/50 hover:border-primary/60 hover:bg-primary/[0.03] transition-colors font-sans text-xs text-muted-foreground/80 hover:text-foreground flex items-center gap-2"
                  title="Add a new line"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add line</span>
                  <span className="opacity-50 ml-auto font-mono">
                    Enter · Shift+Enter soft break · Tab change type · / menu
                  </span>
                </button>
              </>
            )}
          </div>

          <EditorCommandBar
            currentBlockType={activeBlock?.block_type ?? null}
            hasFocus={!!activeBlock}
            onCycleType={cmdCycleType}
            onNewLine={cmdNewLine}
            onAiContinue={cmdAiContinue}
            aiBusy={aiContinueBusy}
          />
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


        {/* Right sidebar — Intelligent Coach */}
        <aside data-tour="coach-panel" className="hidden lg:block border-l border-border/60 min-h-[calc(100vh-104px)] bg-card/20 max-h-[calc(100vh-104px)] overflow-auto sticky top-0 self-start">
          <CoachPane
            projectId={projectId}
            blocks={blocks as any}
            activeBlockId={activeBlockId}
                activeBlockType={activeBlock?.block_type ?? null}
            defaultTab={coachDefaultTab}
            onOpenStoryBuilder={() => setStoryBuilderOpen(true)}
            aiTools={AI_TOOLS}
            aiTool={aiTool}
            setAiTool={setAiTool}
            aiPrompt={aiPrompt}
            setAiPrompt={setAiPrompt}
            aiOutput={aiOutput}
            aiLoading={aiLoading}
            onRunAi={runAi}
          />
        </aside>

      </div>
      <FeatureDock projectId={projectId} />
      <EditorTour isOpen={tour.isOpen} onClose={tour.stop} />
      <StoryBuilder
        projectId={projectId}
        open={storyBuilderOpen}
        onOpenChange={setStoryBuilderOpen}
      />
    </AppShell>
  );
}

function BlockEditor({
  block,
  prevBlockType,
  onSave,
  onDirty,
  onDelete,
  onInsertAfter,
  focusBlockId,
  onFocusDone,
  onActiveChange,
  characters,
  onCreateCharacter,
}: {
  block: any;
  prevBlockType?: string;
  onSave: (patch: { content?: string; block_type?: string; metadata?: Record<string, any> }) => void | Promise<void>;
  onDirty: (content: string) => void;
  onDelete: () => void;
  onInsertAfter: (block_type: string) => void;
  focusBlockId: string | null;
  onFocusDone: () => void;
  onActiveChange?: (id: string, active: boolean) => void;
  characters: CharacterHit[];
  onCreateCharacter: (name: string) => Promise<any>;
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
        const next = cycleType(block.block_type, e.shiftKey ? -1 : 1);
        void onSave({ block_type: next });
        toast.success(`→ ${BLOCK_LABEL[next] ?? next}`, { duration: 1000 });
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        // Flush current value before computing next line
        if (val !== (block.content ?? "")) {
          if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
          void onSave({ content: val });
        }
        const nextType = nextBlockTypeAfter(block.block_type, prevBlockType);
        onInsertAfter(nextType);
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

  const autoFormattedRef = useRef(false);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setVal(newVal);
    dirtyRef.current = true;
    onDirty(newVal);
    scheduleSave(newVal);

    // Auto-format: only fire once per block, and only when content is short
    // enough that the writer is clearly still typing the first line.
    if (!autoFormattedRef.current && newVal.length <= 40) {
      const detected = detectBlockType(newVal);
      if (detected && detected !== block.block_type) {
        autoFormattedRef.current = true;
        void onSave({ block_type: detected });
        toast.success(`Auto-formatted as ${BLOCK_LABEL[detected]}`, { duration: 1400 });
      }
    }

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

  const isCharBlock = block.block_type === "character";
  const isSceneHeading = block.block_type === "scene_heading";
  const showAutocomplete = isCharBlock && isFocused && !slashOpen;
  const beat = (block.metadata as any)?.beat ?? null;

  return (
    <div
      className={`group relative blk-${block.block_type} border-l-2 pl-3 -ml-3 transition-colors ${
        isFocused ? "border-primary bg-primary/[0.04]" : "border-transparent hover:border-border"
      }`}
    >
      <textarea
        ref={ref}
        value={val}
        onChange={handleChange}
        onFocus={() => { setIsFocused(true); onActiveChange?.(block.id, true); }}
        onBlur={() => {
          flush();
          onActiveChange?.(block.id, false);
          setTimeout(() => setIsFocused(false), 150);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder[block.block_type]}
        rows={1}
        className="w-full bg-transparent border-none outline-none resize-none rounded px-1 -mx-1 placeholder:text-muted-foreground/60 caret-primary min-h-[1.5em]"
        style={{ fontFamily: "inherit", fontSize: "inherit", color: "inherit", textAlign: "inherit", textTransform: "inherit", fontWeight: "inherit", fontStyle: "inherit" } as any}
      />

      {/* Character autocomplete */}
      {showAutocomplete && (
        <CharacterAutocomplete
          query={val}
          characters={characters}
          anchorRef={ref as any}
          onPick={(c) => {
            setVal(c.name.toUpperCase());
            void onSave({ content: c.name.toUpperCase() });
            // Move focus out so the popover closes naturally
            ref.current?.blur();
          }}
          onCreate={async (name) => {
            try {
              const created = await onCreateCharacter(name);
              const finalName = (created?.name ?? name).toUpperCase();
              setVal(finalName);
              void onSave({ content: finalName });
              ref.current?.blur();
            } catch {
              // swallow — keep typed text
            }
          }}
        />
      )}

      {/* Scene beat picker (right-anchored) */}
      {isSceneHeading && (
        <div className="absolute right-0 -bottom-7 z-10 font-sans">
          <SceneBeatPicker
            value={beat}
            onChange={(b) => {
              const next = { ...(block.metadata || {}), beat: b ?? undefined };
              if (b === null) delete (next as any).beat;
              void onSave({ metadata: next });
            }}
          />
        </div>
      )}

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
