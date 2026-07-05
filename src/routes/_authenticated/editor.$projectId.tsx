import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ProjectNav } from "@/components/ProjectNav";
import { Button } from "@/components/ui/button";
import { Sparkles, Plus, Copy, ArrowLeft, HelpCircle, PanelLeft, PanelRight } from "lucide-react";
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
import type { CharacterHit } from "@/components/editor/CharacterAutocomplete";
import { StepCoach } from "@/components/editor/StepCoach";
import {
  ScreenplayDocumentEditor,
  type ScreenplayEditorHandle,
  type ActiveBlockMeta,
} from "@/components/editor/ScreenplayDocumentEditor";
import { createSupabasePersistenceAdapter } from "@/components/editor/persistence/SupabasePersistenceAdapter";
import { SaveStatusBanner } from "@/components/editor/SaveStatusBanner";
import { clearDraft } from "@/components/editor/draftBackup";
import { useProjectDictionary } from "@/hooks/useProjectDictionary";
import { getRejectedSet } from "@/components/editor/formatOverrideMemory";

import { LoglineComposer } from "@/components/editor/LoglineComposer";
import { progressForStep, shouldUseLoglineComposer, shouldRedirectStep } from "@/lib/editor/stepCompletion";
import { OPENING_SCENE_TEMPLATE } from "@/lib/editor/openingTemplate";
import { ArrowRight } from "lucide-react";
import { EditorTour } from "@/components/editor/EditorTour";
import { useEditorTour } from "@/hooks/useEditorTour";
import { EditorCommandBar } from "@/components/editor/EditorCommandBar";
import { cycleType } from "@/components/editor/screenplayKeymap";
import { BLOCK_LABEL } from "@/lib/editor/autoFormat";
import { StoryNavigatorPane } from "@/components/editor/StoryNavigatorPane";
import { CoachPane } from "@/components/editor/CoachPane";
import { StoryBuilder } from "@/components/editor/StoryBuilder";
import { WriterDeskModeToggle } from "@/components/editor/WriterDeskModeToggle";
import { FeatureDock } from "@/components/editor/FeatureDock";
import { GuidedStepStrip } from "@/components/editor/GuidedStepStrip";
import { CanvasToolbar } from "@/components/editor/CanvasToolbar";
import { useManuscriptAnalyzer } from "@/hooks/useManuscriptAnalyzer";
import { useOnboarding } from "@/hooks/use-onboarding";
import { buildOutline, estimatePages } from "@/lib/editor/manuscriptAnalyzer";
import { BookOpen, Map as MapIcon, Clapperboard } from "lucide-react";
import { useWriterEvents } from "@/hooks/useWriterEvents";
import { useWriteMode } from "@/hooks/use-write-mode";
import { FocusPill } from "@/components/editor/FocusPill";
import { FirstRunModeDialog } from "@/components/editor/FirstRunModeDialog";

export const Route = createFileRoute("/_authenticated/editor/$projectId")({
  head: () => ({ meta: [{ title: "Writer's Desk — Screenplay Academy" }] }),
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

  // Project Dictionary — terms that should never be auto-corrected.
  const dictionary = useProjectDictionary(projectId);
  const rejectedFixes = useMemo(() => getRejectedSet(projectId), [projectId]);

  // Multilingual language intelligence wiring.
  const { data: writerProfile } = useQuery({
    queryKey: ["profile-languages"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("preferred_languages, ui_language")
        .eq("id", u.user.id)
        .maybeSingle();
      return data;
    },
  });
  const screenplayLanguage = useMemo(
    () => {
      const raw = (project as any)?.screenplay_language;
      // coerce to supported set; fall back to en
      const supported = ["en","es","fr","de","pt","it","pl","uk","ru"] as const;
      return (supported as readonly string[]).includes(raw) ? (raw as (typeof supported)[number]) : "en";
    },
    [project],
  );
  const knownLanguages = useMemo(() => {
    const raw = (writerProfile as any)?.preferred_languages as string[] | undefined;
    const supported = ["en","es","fr","de","pt","it","pl","uk","ru"] as const;
    return (raw ?? ["en"]).filter((l) => (supported as readonly string[]).includes(l)) as Array<(typeof supported)[number]>;
  }, [writerProfile]);

  // Soft one-time prompt when screenplay language differs from UI/known set.
  useEffect(() => {
    if (!writerProfile || !project) return;
    const key = `lovable.langSoftPrompt.${projectId}`;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(key)) return;
    if (knownLanguages.includes(screenplayLanguage)) return;
    window.localStorage.setItem(key, "1");
    const labels: Record<string, string> = {
      en: "English", es: "Español", fr: "Français", de: "Deutsch",
      pt: "Português", it: "Italiano", pl: "Polski", uk: "Українська", ru: "Русский",
    };
    toast(`Writing in ${labels[screenplayLanguage] ?? screenplayLanguage}?`, {
      description: "Tell us which languages you know so we stop flagging familiar words.",
      action: { label: "Set languages", onClick: () => { window.location.href = "/settings"; } },
      duration: 8000,
    });
  }, [writerProfile, project, projectId, knownLanguages, screenplayLanguage]);




  const editorRef = useRef<ScreenplayEditorHandle>(null);
  const [activeMeta, setActiveMeta] = useState<ActiveBlockMeta>(null);
  const activeBlockId = activeMeta?.serverId ?? null;
  const activeBlockType = activeMeta?.type ?? null;

  // Editor-wide autosave indicator
  const [saveStatus, setSaveStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [failedCount, setFailedCount] = useState(0);

  const emitEvent = useWriterEvents();

  // Local-first persistence adapter: owns insert/update/delete queues,
  // patches the ["blocks", projectId] cache in place. Never invalidates
  // during typing. One adapter per (projectId, queryClient).
  const persistence = useMemo(
    () =>
      createSupabasePersistenceAdapter({
        projectId,
        queryClient: qc,
        onSaveStatus: (s) => {
          setSaveStatus(s as AutosaveStatus);
        },
        onLastSaved: (ts) => {
          setLastSavedAt(ts);
          // Full sync confirmed — drop the localStorage draft so a future
          // session doesn't try to "restore" already-saved lines.
          setFailedCount(0);
          clearDraft(projectId);
        },
        onSaveError: (info) => {
          setFailedCount((n) => n + 1);
          emitEvent({
            event_type: "save_failed",
            project_id: projectId,
            context: {
              kind: info.kind,
              message: info.message,
              attempts: info.attempts,
            },
          });
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, qc],
  );

  // beforeunload warning while unsaved
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveStatus === "dirty" || saveStatus === "saving" || saveStatus === "error") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveStatus]);

  const retryFailed = useCallback(() => {
    setFailedCount(0);
    persistence.retryFailed?.();
    toast.info("Retrying unsaved lines…");
  }, [persistence]);

  const copyAllText = useCallback(() => {
    const local = editorRef.current?.getBlocks() ?? (blocks as any[]);
    const text = local
      .filter((b: any) => b.block_type !== "note")
      .map(formatExport)
      .join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success("Script copied to clipboard as backup");
  }, [blocks]);

  const handleDraftRestored = useCallback(
    (count: number) => {
      toast.success(
        `Restored ${count} unsaved line${count === 1 ? "" : "s"} from your last session`,
        { duration: 6000 },
      );
      emitEvent({
        event_type: "draft_restored",
        project_id: projectId,
        context: { count },
      });
    },
    [emitEvent, projectId],
  );

  // Bulk insert template / starter blocks (used by AI + template helpers)
  const insertTemplate = useMutation({
    mutationFn: async (template: { block_type: string; content: string }[]) => {
      const startOrder = (blocks?.length ?? 0);
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
        .filter((b: any) => b.block_type !== "note")
        .map((b: any) => `[${b.block_type}] ${b.content}`).join("\n");
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

  const tour = useEditorTour();
  const [storyBuilderOpen, setStoryBuilderOpen] = useState(false);
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const writeMode = useWriteMode();
  const focus = writeMode.on;

  const { data: onboarding } = useOnboarding();
  const isBasic = onboarding?.preferred_mode === "guided";
  const coachDefaultTab = isBasic ? "builder" : "coach";

  // Esc exits Focus Mode. Ignore when a modal/menu/popover has consumed the
  // event (Radix marks defaultPrevented), and don't fire if a bare Escape
  // isn't the key.
  useEffect(() => {
    if (!focus) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      writeMode.set(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focus, writeMode]);

  // Global Cmd/Ctrl+1–7 → set active block's type
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
        editorRef.current?.changeActiveType(t);
        toast.success(`→ ${BLOCK_LABEL[t] ?? t}`, { duration: 800 });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Background auto-analyzer
  useManuscriptAnalyzer({
    projectId,
    blocks: blocks as any,
    existingCharacterNames: (characters as any[]).map((c) => c.name),
  });

  // Outline + page counts (driven by server blocks; refreshed when cache patches)
  const outline = buildOutline(blocks as any);
  const pageCount = estimatePages(blocks as any);
  const activeSceneIdx = (() => {
    if (!activeMeta) return -1;
    return outline.findIndex(
      (s) => activeMeta.orderIndex >= s.startOrder && activeMeta.orderIndex <= s.endOrder,
    );
  })();
  const activeScene = activeSceneIdx >= 0 ? outline[activeSceneIdx] : null;

  const jumpToBlock = useCallback((serverId: string) => {
    // jumpToServer also triggers the active-line viewport scroller so the
    // jumped-to block lands in the focus zone — no manual scrollIntoView here.
    editorRef.current?.jumpToServer(serverId);
  }, []);

  const addSceneAtEnd = useCallback(() => {
    editorRef.current?.insertAtEnd("scene_heading");
  }, []);

  const cmdCycleType = useCallback(() => {
    if (!activeBlockType) return;
    const next = cycleType(activeBlockType);
    editorRef.current?.changeActiveType(next);
    toast.success(`→ ${BLOCK_LABEL[next] ?? next}`, { duration: 1000 });
  }, [activeBlockType]);

  const cmdNewLine = useCallback(() => {
    editorRef.current?.insertAfterActive();
  }, []);

  const [aiContinueBusy, setAiContinueBusy] = useState(false);
  const cmdAiContinue = useCallback(async () => {
    setAiContinueBusy(true);
    try {
      const tail = (blocks as any[])
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

  const handleBlockCreated = useCallback(
    (block_type: string) => {
      emitEvent({ event_type: "block_created", project_id: projectId, context: { block_type } });
      if (block_type === "scene_heading") {
        emitEvent({ event_type: "scene_created", project_id: projectId, context: { has_turn: false } });
      }
    },
    [emitEvent, projectId],
  );

  const currentPage = Math.max(
    1,
    Math.min(
      pageCount,
      Math.ceil(
        ((activeMeta
          ? Math.max(1, (blocks as any[]).findIndex((b: any) => b.id === activeMeta.serverId) + 1)
          : (blocks as any[]).length) /
          Math.max(1, (blocks as any[]).length)) *
          pageCount,
      ),
    ),
  );

  return (
    <AppShell>
      <ProjectNav projectId={projectId} title={project?.title} />
      {!focus && <GuidedRail projectId={projectId} />}
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
        <div className="flex items-center gap-3 flex-wrap">
          <WriterDeskModeToggle />
          <Sheet open={leftDrawerOpen} onOpenChange={setLeftDrawerOpen}>
            <SheetTrigger asChild>
              <button className="lg:hidden inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition rounded-md border border-border/60 px-2 py-1" title="Script Map">
                <PanelLeft className="h-3.5 w-3.5" /> Script Map
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] p-4 overflow-auto">
              <div className="font-mono uppercase tracking-[0.2em] text-[10px] text-muted-foreground mb-3 flex items-center gap-1.5">
                <MapIcon className="h-3 w-3" /> Script Map
              </div>
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
              <button className="xl:hidden inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition rounded-md border border-border/60 px-2 py-1" title="Director's Chair">
                <PanelRight className="h-3.5 w-3.5" /> Director
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[360px] p-0 overflow-auto">
              <CoachPane
                projectId={projectId}
                blocks={blocks as any}
                activeBlockId={activeBlockId}
                activeBlockType={activeBlockType}
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
      {onboarding?.preferred_mode === "guided" && (
        <GuidedStepStrip
          projectId={projectId}
          currentStep={guidedStep ?? null}
          completedCount={0}
        />
      )}
      <div
        className={`grid grid-cols-1 max-w-[1600px] mx-auto ${
          writeMode.on
            ? "lg:grid-cols-1"
            : "lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_300px]"
        }`}
      >

        {!writeMode.on && (
        <aside
          data-tour="block-toolbar"
          aria-label="Script Map"
          className="hidden lg:block border-r border-border/40 p-4 min-h-[calc(100vh-104px)] sticky top-0 self-start max-h-[calc(100vh-104px)] overflow-auto bg-card/10"
        >
          <div className="font-mono uppercase tracking-[0.2em] text-[10px] text-muted-foreground mb-3 flex items-center gap-1.5">
            <MapIcon className="h-3 w-3" /> Script Map
          </div>
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

        <section className="h-[calc(100vh-104px)] min-w-0 flex flex-col p-4 sm:p-6 lg:p-6 xl:p-8 screenplay-canvas overflow-hidden">
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
          {(guidedStep || redirect) && (
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
              </div>
            </details>
          )}

          <div className="max-w-[680px] mx-auto mb-3 flex items-center justify-between gap-3 font-sans px-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" />
              <span className="font-mono tabular-nums">
                Page {currentPage} of {pageCount}
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
            blockType={activeBlockType}
            onChangeType={(t) => editorRef.current?.changeActiveType(t)}
            pageCount={pageCount}
            currentPage={currentPage}
            wordCount={(blocks as any[]).reduce((n: number, b: any) => n + (b.content?.trim().split(/\s+/).filter(Boolean).length ?? 0), 0)}
            sceneCount={outline.length}
          />

          <div className="max-w-[760px] mx-auto mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-muted-foreground/70 px-1">
            <span><kbd className="px-1 py-0.5 rounded bg-muted/40 border border-border/40">Enter</kbd> next block</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted/40 border border-border/40">Tab</kbd> change type</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted/40 border border-border/40">/</kbd> menu</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted/40 border border-border/40">⌘↵</kbd> AI continue</span>
          </div>

          <SaveStatusBanner
            visible={saveStatus === "error" || failedCount > 0}
            failedCount={failedCount}
            onRetry={retryFailed}
            onCopyAll={copyAllText}
          />

          <div className="flex-1 min-h-0">
            <ScreenplayDocumentEditor
              ref={editorRef}
              projectId={projectId}
              initialBlocks={blocks as any[]}
              blocksLoading={blocksLoading}
              characters={characters as CharacterHit[]}
              onCreateCharacter={(name) => createCharacter.mutateAsync(name) as Promise<any>}
              onActiveBlockChange={setActiveMeta}
              onBlockCreated={handleBlockCreated}
              onDraftRestored={handleDraftRestored}
              onOpenStoryBuilder={() => setStoryBuilderOpen(true)}
              onDraftWithAi={draftOpeningWithAi}
              onInsertTemplate={() => void insertTemplate.mutateAsync(OPENING_SCENE_TEMPLATE)}
              primaryBusy={primaryBusy || insertTemplate.isPending}
              persistence={persistence}
              projectDictionary={dictionary.termSet}
              rejectedFixes={rejectedFixes}
              screenplayLanguage={screenplayLanguage}
              knownLanguages={knownLanguages}
              onAddDictionaryTerm={(term, category) => {
                dictionary.addTerm({
                  term,
                  category: (category ?? "custom") as never,
                  createdFrom: "script_detection",
                });
                toast.success(`Added "${term}" to project dictionary`, { duration: 1500 });
              }}
              onRejectFormatSuggestion={(original) => {
                import("@/components/editor/formatOverrideMemory").then((m) =>
                  m.markFixRejected(projectId, original),
                );
              }}
            />

          </div>

          <EditorCommandBar
            currentBlockType={activeBlockType}
            hasFocus={!!activeMeta}
            onCycleType={cmdCycleType}
            onNewLine={cmdNewLine}
            onAiContinue={cmdAiContinue}
            aiBusy={aiContinueBusy}
          />
          {(blocks as any[]).length > 0 && (
            <div className="max-w-[680px] mx-auto mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                const local = editorRef.current?.getBlocks() ?? (blocks as any[]);
                const text = local.filter((b: any) => b.block_type !== "note").map(formatExport).join("\n\n");
                navigator.clipboard.writeText(text);
                toast.success("Screenplay copied to clipboard");
              }}><Copy className="h-3.5 w-3.5 mr-1.5" />Copy</Button>
              <Button variant="outline" size="sm" onClick={() => {
                const local = editorRef.current?.getBlocks() ?? (blocks as any[]);
                const text = local.filter((b: any) => b.block_type !== "note").map(formatExport).join("\n\n");
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

        {!writeMode.on && (
        <aside
          data-tour="coach-panel"
          aria-label="Director's Chair"
          className="hidden xl:block border-l border-border/40 min-h-[calc(100vh-104px)] bg-card/10 max-h-[calc(100vh-104px)] overflow-auto sticky top-0 self-start"
        >
          <div className="font-mono uppercase tracking-[0.2em] text-[10px] text-muted-foreground px-4 pt-4 pb-2 flex items-center gap-1.5 border-b border-border/30">
            <Clapperboard className="h-3 w-3" /> Director's Chair
          </div>
          <CoachPane
            projectId={projectId}
            blocks={blocks as any}
            activeBlockId={activeBlockId}
            activeBlockType={activeBlockType}
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
