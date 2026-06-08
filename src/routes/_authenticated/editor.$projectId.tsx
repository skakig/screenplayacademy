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
import { ScreenplayDocumentEditor } from "@/components/editor/ScreenplayDocumentEditor";
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
  // Content typed into a yet-to-be-persisted (temp-*) block. Flushed to the
  // real row once the optimistic insert returns the real id.
  const pendingTempContent = useRef<Map<string, string>>(new Map());
  // Tracks block ids that currently have a save request in-flight, so
  // BlockEditor's server-echo sync can drop stale cache patches.
  const inFlightSaves = useRef<Set<string>>(new Set());
  const isSaving = useCallback((id: string) => inFlightSaves.current.has(id), []);

  const markDirty = useCallback(() => {
    // Only update visual state — pending save count is incremented per
    // actual save operation in markSaving, NOT per keystroke (otherwise
    // the indicator gets stuck on "Saving…").
    setSaveStatus("dirty");
  }, []);
  const markSaving = useCallback(() => {
    pendingCount.current += 1;
    setSaveStatus("saving");
  }, []);
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
    mutationFn: async ({ block_type, initialContent }: { block_type: string; initialContent?: string }) => {
      const order_index = blocks.length;
      const { data, error } = await supabase.from("script_blocks")
        .insert({ project_id: projectId, block_type, content: initialContent ?? "", order_index })
        .select().single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ block_type, initialContent }) => {
      await qc.cancelQueries({ queryKey: ["blocks", projectId] });
      const prev = qc.getQueryData<any[]>(["blocks", projectId]) ?? [];
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const temp = { id: tempId, project_id: projectId, block_type, content: initialContent ?? "", order_index: prev.length, metadata: null };
      qc.setQueryData<any[]>(["blocks", projectId], [...prev, temp]);
      if (initialContent) pendingTempContent.current.set(tempId, initialContent);
      setFocusBlockId(tempId);
      return { tempId, prev };
    },
    onSuccess: (data, vars, ctx: any) => {
      qc.setQueryData<any[]>(["blocks", projectId], (old) =>
        (old ?? []).map((b) => (b.id === ctx?.tempId ? data : b))
      );
      if (data?.id) setFocusBlockId(data.id);
      // Flush any text the user already typed into the temp row.
      const buffered = ctx?.tempId ? pendingTempContent.current.get(ctx.tempId) : undefined;
      if (ctx?.tempId) pendingTempContent.current.delete(ctx.tempId);
      if (buffered && data?.id && buffered !== (data.content ?? "")) {
        void saveBlock(data.id, { content: buffered });
      }
      emitEvent({ event_type: "block_created", project_id: projectId, context: { block_type: vars.block_type } });
      if (vars.block_type === "scene_heading") {
        emitEvent({ event_type: "scene_created", project_id: projectId, context: { has_turn: false } });
      }
    },
    onError: (_e, _v, ctx: any) => {
      if (ctx?.tempId) pendingTempContent.current.delete(ctx.tempId);
      if (ctx?.prev) qc.setQueryData(["blocks", projectId], ctx.prev);
    },
  });

  const insertBlockAfter = useMutation({
    mutationFn: async ({ block_type, afterOrder, initialContent }: { block_type: string; afterOrder: number; initialContent?: string }) => {
      const sorted = [...blocks].sort((a, b) => a.order_index - b.order_index);
      const idx = sorted.findIndex((b) => b.order_index === afterOrder);
      const nextOrder = idx >= 0 && sorted[idx + 1] ? sorted[idx + 1].order_index : afterOrder + 1;
      const newOrder = (afterOrder + nextOrder) / 2;
      const { data, error } = await supabase.from("script_blocks")
        .insert({ project_id: projectId, block_type, content: initialContent ?? "", order_index: newOrder })
        .select().single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ block_type, afterOrder, initialContent }) => {
      await qc.cancelQueries({ queryKey: ["blocks", projectId] });
      const prev = qc.getQueryData<any[]>(["blocks", projectId]) ?? [];
      const sorted = [...prev].sort((a, b) => a.order_index - b.order_index);
      const idx = sorted.findIndex((b) => b.order_index === afterOrder);
      const nextOrder = idx >= 0 && sorted[idx + 1] ? sorted[idx + 1].order_index : afterOrder + 1;
      const newOrder = (afterOrder + nextOrder) / 2;
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const temp = { id: tempId, project_id: projectId, block_type, content: initialContent ?? "", order_index: newOrder, metadata: null };
      qc.setQueryData<any[]>(["blocks", projectId], [...prev, temp].sort((a, b) => a.order_index - b.order_index));
      if (initialContent) pendingTempContent.current.set(tempId, initialContent);
      setFocusBlockId(tempId);
      return { tempId, prev };
    },
    onSuccess: (data, _vars, ctx: any) => {
      qc.setQueryData<any[]>(["blocks", projectId], (old) =>
        (old ?? []).map((b) => (b.id === ctx?.tempId ? data : b))
      );
      if (data?.id) setFocusBlockId(data.id);
      const buffered = ctx?.tempId ? pendingTempContent.current.get(ctx.tempId) : undefined;
      if (ctx?.tempId) pendingTempContent.current.delete(ctx.tempId);
      if (buffered && data?.id && buffered !== (data.content ?? "")) {
        void saveBlock(data.id, { content: buffered });
      }
    },
    onError: (_e, _v, ctx: any) => {
      if (ctx?.tempId) pendingTempContent.current.delete(ctx.tempId);
      if (ctx?.prev) qc.setQueryData(["blocks", projectId], ctx.prev);
      toast.error("Couldn't insert line");
    },
  });

  const saveBlock = useCallback(async (id: string, patch: { content?: string; block_type?: string; metadata?: Record<string, any> }) => {
    if (id.startsWith("temp-")) {
      // Optimistic row not yet persisted — buffer the typed content so we
      // can flush it as soon as the insert mutation returns the real id.
      if (patch.content !== undefined) pendingTempContent.current.set(id, patch.content);
      setSaveStatus("dirty");
      return;
    }
    markSaving();
    inFlightSaves.current.add(id);
    try {
      const update: any = {};
      if (patch.content !== undefined) update.content = patch.content;
      if (patch.block_type) update.block_type = patch.block_type;
      if (patch.metadata !== undefined) update.metadata = patch.metadata;
      const { error } = await supabase.from("script_blocks").update(update).eq("id", id);
      if (error) throw error;
      if (patch.content !== undefined) clearDraft(id);
      // Patch the React Query cache in place — never invalidate, that would
      // remount the focused textarea and lose the caret.
      qc.setQueryData<any[]>(["blocks", projectId], (old) =>
        (old ?? []).map((b) => (b.id === id ? { ...b, ...update } : b))
      );
      markSaved();
    } catch (e: any) {
      markError();
      toast.error("Couldn't save — your work is kept locally and will retry on next edit");
    } finally {
      inFlightSaves.current.delete(id);
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
        qc.setQueryData<any[]>(["blocks", projectId], (old) =>
          (old ?? []).map((b) => (b.id === id ? { ...b, content: draft.content } : b))
        );
        clearDraft(id);
        markSaved();
      } catch {
        markError();
      }
    }
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
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<any[]>(["blocks", projectId], (old) =>
        (old ?? []).filter((b) => b.id !== id)
      );
    },
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
    await addBlock.mutateAsync({ block_type: "scene_heading" });
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
    addBlock.mutate({ block_type: "scene_heading" });
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
      addBlock.mutate({ block_type: "scene_heading" });
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
      <div className={`grid grid-cols-1 ${writeMode.on ? "lg:grid-cols-1" : "lg:grid-cols-[280px_1fr_340px]"} max-w-[1600px] mx-auto`}>

        {/* Left rail — Story Navigator (desktop) */}
        {!writeMode.on && (
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
        )}



        {/* Editor */}
        <section className="min-h-[calc(100vh-104px)] p-6 lg:p-10 screenplay-canvas">
          {isLoglineStep ? (
            <div className="max-w-[760px] mx-auto pt-4">
              <div className="mb-3 text-center">
                <h1 className="text-2xl font-semibold">Write your logline</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  One sentence that captures your story. We'll come back to the screenplay once this is locked.
                </p>
              </div>
              <LoglineComposer
                projectId={projectId}
                initialLogline={project?.logline}
                projectContext={projectCtx}
              />
              <div className="text-center mt-4">
                <Link
                  to="/editor/$projectId"
                  params={{ projectId }}
                  className="text-xs text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
                >
                  Skip to manuscript →
                </Link>
              </div>
            </div>
          ) : (
          <>
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

          <ScreenplayDocumentEditor
            blocks={blocks as any[]}
            blocksLoading={blocksLoading}
            characters={characters as CharacterHit[]}
            focusBlockId={focusBlockId}
            setFocusBlockId={setFocusBlockId}
            activeBlockId={activeBlockId}
            setActiveBlockId={setActiveBlockId}
            onAddBlock={(block_type, initialContent) => addBlock.mutate({ block_type, initialContent })}
            onInsertAfter={(args) => insertBlockAfter.mutate(args)}
            onSaveBlock={saveBlock}
            onDeleteBlock={(id) => deleteBlock.mutate(id)}
            onCreateCharacter={(name) => createCharacter.mutateAsync(name) as Promise<any>}
            onDirty={(blockId, content) => { writeDraft(blockId, content); markDirty(); }}
            onOpenStoryBuilder={() => setStoryBuilderOpen(true)}
            onDraftWithAi={draftOpeningWithAi}
            onInsertTemplate={() => void insertTemplate.mutateAsync(OPENING_SCENE_TEMPLATE)}
            primaryBusy={primaryBusy || insertTemplate.isPending}
          />


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
          </>
          )}
        </section>


        {/* Right sidebar — Intelligent Coach */}
        {!writeMode.on && (
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
        )}

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
