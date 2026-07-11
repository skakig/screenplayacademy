import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RouteReadinessGate } from "@/components/RouteReadinessGate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Sparkles, Plus, Copy, ArrowLeft, HelpCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { aiAssist } from "@/lib/ai.functions";
import { listProjectCharacters, upsertCharacter } from "@/lib/characters.functions";
import { updateGuidedStep } from "@/lib/academy.functions";
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
import { CanvasToolbar } from "@/components/editor/CanvasToolbar";
import { useManuscriptAnalyzer } from "@/hooks/useManuscriptAnalyzer";
import { useOnboarding } from "@/hooks/use-onboarding";
import { buildOutline, estimatePages } from "@/lib/editor/manuscriptAnalyzer";
import { BookOpen, Map as MapIcon, Clapperboard } from "lucide-react";
import { useWriterEvents } from "@/hooks/useWriterEvents";
import { useWriteMode } from "@/hooks/use-write-mode";
import { FocusPill } from "@/components/editor/FocusPill";
import { FirstRunModeDialog } from "@/components/editor/FirstRunModeDialog";
import { BasicProgressPill } from "@/components/editor/BasicProgressPill";
import { EditorSummonBar } from "@/components/editor/EditorSummonBar";
import { PresenceAvatarStack } from "@/components/writers-room/presence/PresenceAvatarStack";
import { PeerBlockIndicators } from "@/components/writers-room/presence/PeerBlockIndicators";
import { TeammatesPanel } from "@/components/writers-room/presence/TeammatesPanel";
import { PresenceProvider, useOptionalPresence } from "@/lib/presence/PresenceProvider";
import { InviteCollaboratorDialog } from "@/components/writers-room/InviteCollaboratorDialog";
import { UserPlus } from "lucide-react";
import { AutosaveIndicator } from "@/components/editor/AutosaveIndicator";
import { WriterDeskNewMenu } from "@/components/vault/WriterDeskNewMenu";

export const Route = createFileRoute("/_authenticated/editor/$projectId")({
  head: () => ({ meta: [{ title: "Writer's Desk — Screenplay Academy" }] }),
  validateSearch: (s: Record<string, unknown>): { from?: string; step?: string; block?: string } => ({
    from: typeof s.from === "string" ? s.from : undefined,
    step: typeof s.step === "string" ? s.step : undefined,
    block: typeof s.block === "string" ? s.block : undefined,
  }),
  component: () => (<RouteReadinessGate to="/editor/$projectId"><EditorRoute /></RouteReadinessGate>),
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
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-3">
        <h2 className="text-xl font-semibold">That script isn't here</h2>
        <p className="text-sm text-muted-foreground">
          The project you're trying to open doesn't exist or you don't have access to it.
        </p>
        <div className="flex gap-2 justify-center">
          <a href="/dashboard" className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm">Back to dashboard</a>
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

function EditorRoute() {
  const { projectId } = Route.useParams();
  return (
    <PresenceProvider projectId={projectId}>
      <Editor />
    </PresenceProvider>
  );
}

function Editor() {
  const { projectId } = Route.useParams();
  const search = Route.useSearch();
  const fromGuided = search.from === "guided";
  const guidedStep = search.step;
  const qc = useQueryClient();
  const navigate = useNavigate();
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

  const openGuidedCharacterBuilder = async () => {
    let characterId: string | undefined = (characters as CharacterHit[])[0]?.id;
    if (!characterId) {
      const created = (await createCharacter.mutateAsync("New Character")) as { row?: { id?: string }; id?: string } | null;
      characterId = created?.row?.id ?? created?.id;
      toast.success("First character created", {
        description: "Let's build them together in the guided builder.",
      });
    }
    if (!characterId) {
      toast.error("Could not open character builder");
      return;
    }
    navigate({ to: "/characters/$projectId/build/$characterId", params: { projectId, characterId } });
  };

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

  // Bulk insert template / starter blocks (used by AI + template helpers).
  // Uses setQueryData cache-patch instead of invalidateQueries to avoid a
  // refetch racing the server-echo merge while the writer is actively typing.
  const insertTemplate = useMutation({
    mutationFn: async (template: { block_type: string; content: string }[]) => {
      const startOrder = (blocks?.length ?? 0);
      const rows = template.map((t, i) => ({
        project_id: projectId,
        block_type: t.block_type,
        content: t.content,
        order_index: startOrder + i,
      }));
      const { data, error } = await supabase.from("script_blocks").insert(rows).select();
      if (error) throw error;
      return data ?? [];
    },
    onSuccess: (inserted) => {
      if (!inserted?.length) return;
      qc.setQueryData(["blocks", projectId], (prev: any[] | undefined) => {
        const base = Array.isArray(prev) ? prev : [];
        return [...base, ...inserted];
      });
    },
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
  const [toolsDrawerOpen, setToolsDrawerOpen] = useState(false);
  const [coachPinned, setCoachPinnedState] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = window.localStorage.getItem("editor:coach-pinned");
    return v === null ? true : v === "1";
  });
  // Hydrate from server-side user preference (cross-device).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("ui_preferences")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (cancelled) return;
      const prefs = (data?.ui_preferences ?? {}) as Record<string, unknown>;
      if (typeof prefs.coachPinned === "boolean") {
        setCoachPinnedState(prefs.coachPinned);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("editor:coach-pinned", prefs.coachPinned ? "1" : "0");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const setCoachPinned = useCallback((v: boolean) => {
    setCoachPinnedState(v);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("editor:coach-pinned", v ? "1" : "0");
    }
    void (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: current } = await supabase
        .from("profiles")
        .select("ui_preferences")
        .eq("id", userData.user.id)
        .maybeSingle();
      const prefs = {
        ...((current?.ui_preferences ?? {}) as Record<string, unknown>),
        coachPinned: v,
      };
      await supabase.from("profiles").update({ ui_preferences: prefs }).eq("id", userData.user.id);
    })();
  }, []);
  const writeMode = useWriteMode();
  const focus = writeMode.on;

  const { data: onboarding } = useOnboarding();
  const isBasic = onboarding?.preferred_mode === "guided";
  const coachDefaultTab = isBasic ? "builder" : "coach";
  const showCoachRail = coachPinned && !focus;

  // Esc exits Focus Mode; Cmd/Ctrl+. toggles Focus Mode from anywhere.
  // Ignore when a modal/menu/popover has consumed the event (Radix marks
  // defaultPrevented).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      // Cmd/Ctrl+. toggle
      if ((e.metaKey || e.ctrlKey) && e.key === "." && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        writeMode.toggle();
        return;
      }
      // Bare Escape exits focus
      if (focus && e.key === "Escape" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        writeMode.set(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focus, writeMode]);

  // Emit focus-mode analytics whenever it toggles (post-mount only).
  const lastFocusRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (lastFocusRef.current === null) {
      lastFocusRef.current = focus;
      return;
    }
    if (lastFocusRef.current === focus) return;
    lastFocusRef.current = focus;
    emitEvent({
      event_type: focus ? "focus_mode_entered" : "focus_mode_exited",
      project_id: projectId,
    });
  }, [focus, emitEvent, projectId]);

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

  // Presence: broadcast that this user is in the script editor, which scene
  // their caret is currently in, and which block. Payload carries no script content.
  const presence = useOptionalPresence();
  useEffect(() => {
    presence?.setActiveArea("script");
  }, [presence]);
  useEffect(() => {
    presence?.setActiveScene(
      activeScene?.id ?? null,
      activeScene?.title ?? null,
    );
  }, [presence, activeScene?.id, activeScene?.title]);
  useEffect(() => {
    presence?.setActiveBlock(activeBlockId ?? null);
  }, [presence, activeBlockId]);

  // Editor scroll container — hosts the peer caret overlay.
  const editorSurfaceRef = useRef<HTMLDivElement>(null);
  const pingTyping = presence?.pingTyping;
  useEffect(() => {
    if (!pingTyping) return;
    const el = editorSurfaceRef.current;
    if (!el) return;
    const onInput = () => pingTyping(activeScene?.id ?? null);
    el.addEventListener("input", onInput, true);
    el.addEventListener("keydown", onInput, true);
    return () => {
      el.removeEventListener("input", onInput, true);
      el.removeEventListener("keydown", onInput, true);
    };
  }, [pingTyping, activeScene?.id]);

  const [inviteOpen, setInviteOpen] = useState(false);


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

  const headerExtras = (
    <div className="flex items-center gap-2">
      {!focus && <PresenceAvatarStack />}
      {!focus && <TeammatesPanel projectId={projectId} blocks={blocks as any} />}
      {!focus && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setInviteOpen(true)}
          title="Invite a collaborator"
        >
          <UserPlus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Invite</span>
        </Button>
      )}
      <WriterDeskModeToggle />
      <AutosaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
    </div>
  );

  return (
    <AppShell focus={focus} title={project?.title} headerExtras={headerExtras}>
      <InviteCollaboratorDialog
        projectId={projectId}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />
      {!focus && fromGuided && (
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

      {/* Basic Mode gets a compact progress pill, not a full curriculum strip. */}
      {!focus && isBasic && (
        <div className="max-w-[1600px] mx-auto px-6 lg:px-10 pt-3 flex items-center gap-3">
          <BasicProgressPill projectId={projectId} currentStep={guidedStep ?? null} />
          {!focus && (
            <button
              onClick={tour.start}
              className="ml-auto hidden md:inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
              title="Replay the editor tour"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Replay tour
            </button>
          )}
        </div>
      )}

      {/* Advanced Mode: manuscript is single-column; panels are summoned. */}
      <div className={`grid max-w-[1600px] mx-auto ${showCoachRail ? "grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px]" : "grid-cols-1"}`}>
        <section className="min-h-[calc(100vh-64px)] min-w-0 flex flex-col p-4 sm:p-6 lg:p-8 screenplay-canvas">
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
              {/* Basic Mode next-step card: page + one clear thing to do next. */}
              {!focus && isBasic && guidedStep && (
                <div data-tour="step-coach">
                  <StepCoach
                    projectId={projectId}
                    stepKey={guidedStep}
                    progress={stepProgress}
                    onPrimary={handleCoachPrimary}
                    onMarkComplete={handleMarkComplete}
                    primaryBusy={primaryBusy || insertTemplate.isPending}
                    markBusy={markStepComplete.isPending}
                  />
                  {redirect && (
                    <div className="max-w-[680px] mx-auto mb-4 rounded-lg border border-border bg-card/50 p-3 flex items-center gap-3 flex-wrap font-sans">
                      <p className="text-xs flex-1">
                        This step has a dedicated page: <strong>{redirect.destination}</strong>.
                      </p>
                      {redirect.destination === "characters" ? (
                        <Button size="sm" variant="outline" onClick={openGuidedCharacterBuilder} disabled={createCharacter.isPending}>
                          Open characters <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                        </Button>
                      ) : (
                        <Button asChild size="sm" variant="outline">
                          <Link
                            to={
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
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Advanced-only: subtle inline guided-step details block if guided is active but not Basic. */}
              {!focus && !isBasic && guidedStep && (
                <details className="max-w-[760px] mx-auto mb-4 group font-sans">
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-border/60 bg-card/40 text-xs text-muted-foreground hover:bg-card/60">
                    <span className="flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>Guided step: {guidedStep.replace(/_/g, " ")}</span>
                    </span>
                    <span className="text-[10px] uppercase tracking-wider opacity-60 group-open:opacity-100">
                      Click to open
                    </span>
                  </summary>
                  <div className="mt-3">
                    <StepCoach
                      projectId={projectId}
                      stepKey={guidedStep}
                      progress={stepProgress}
                      onPrimary={handleCoachPrimary}
                      onMarkComplete={handleMarkComplete}
                      primaryBusy={primaryBusy || insertTemplate.isPending}
                      markBusy={markStepComplete.isPending}
                    />
                  </div>
                </details>
              )}

              {/* Advanced-only: quiet Story Builder / add-scene affordance. Kept lightweight. */}
              {!focus && !isBasic && (
                <div className="max-w-[680px] mx-auto mb-3 flex items-center justify-end gap-2 font-sans px-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    onClick={() => setStoryBuilderOpen(true)}
                    title="Generate logline, outline, and starter characters"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Story Builder
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={addSceneAtEnd}
                    title="Add a new scene heading at the end"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Scene
                  </Button>
                </div>
              )}

              <SaveStatusBanner
                visible={saveStatus === "error" || failedCount > 0}
                failedCount={failedCount}
                onRetry={retryFailed}
                onCopyAll={copyAllText}
              />

              <div className="flex-1 min-h-0 relative" ref={editorSurfaceRef}>
                <PeerBlockIndicators containerRef={editorSurfaceRef} projectId={projectId} />
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
                  annotationMode={focus || isBasic ? "silent" : "quiet"}
                  chromeMode={focus ? "focus" : isBasic ? "basic" : "advanced"}
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
              {(blocks as any[]).length > 0 && !focus && (
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
        {showCoachRail && (
          <aside className="hidden xl:block border-l border-border/40 bg-background/40">
            <div className="sticky top-16 max-h-[calc(100vh-64px)] overflow-auto">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-background/60">
                <span className="font-mono uppercase tracking-[0.2em] text-[10px] text-muted-foreground">Coach Rail</span>
                <button
                  onClick={() => setCoachPinned(false)}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition"
                  title="Unpin the Coach rail"
                >
                  Unpin
                </button>
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
            </div>
          </aside>
        )}
      </div>

      {/* Summoned panels: Script Map & Director's Chair as right-side drawers. */}
      {!focus && (
        <Sheet open={leftDrawerOpen} onOpenChange={setLeftDrawerOpen}>
          <SheetContent side="left" className="w-[320px] p-4 overflow-auto">
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
      )}
      {!focus && (
        <Sheet open={rightDrawerOpen} onOpenChange={setRightDrawerOpen}>
          <SheetContent side="right" className="w-[380px] p-0 overflow-auto">
            {!coachPinned && (
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
                <span className="font-mono uppercase tracking-[0.2em] text-[10px] text-muted-foreground">Coach</span>
                <button
                  onClick={() => { setCoachPinned(true); setRightDrawerOpen(false); }}
                  className="text-[10px] text-primary hover:underline"
                  title="Pin Coach as persistent side rail"
                >
                  Pin to side
                </button>
              </div>
            )}
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
      )}
      {/* Tools drawer: reuse FeatureDock content in a bottom sheet. */}
      {!focus && (
        <Sheet open={toolsDrawerOpen} onOpenChange={setToolsDrawerOpen}>
          <SheetContent side="bottom" className="p-0 max-h-[70vh] overflow-auto">
            <div className="font-mono uppercase tracking-[0.2em] text-[10px] text-muted-foreground px-4 pt-4 flex items-center gap-1.5">
              <Clapperboard className="h-3 w-3" /> Tools
            </div>
            <FeatureDock projectId={projectId} />
          </SheetContent>
        </Sheet>
      )}

      {/* Floating summoner cluster — page-first, tools on demand. */}
      {!focus && !isLoglineStep && (
        <EditorSummonBar
          onOpenScriptMap={() => setLeftDrawerOpen(true)}
          onOpenDirector={() => setRightDrawerOpen(true)}
          onOpenTools={isBasic ? undefined : () => setToolsDrawerOpen(true)}
          formatContent={
            <CanvasToolbar
              blockType={activeBlockType}
              onChangeType={(t) => editorRef.current?.changeActiveType(t)}
              pageCount={pageCount}
              currentPage={currentPage}
              wordCount={(blocks as any[]).reduce((n: number, b: any) => n + (b.content?.trim().split(/\s+/).filter(Boolean).length ?? 0), 0)}
              sceneCount={outline.length}
            />
          }
        />
      )}

      {!focus && <GuidedRail projectId={projectId} />}
      <EditorTour isOpen={tour.isOpen} onClose={tour.stop} />
      <StoryBuilder
        projectId={projectId}
        open={storyBuilderOpen}
        onOpenChange={setStoryBuilderOpen}
      />
      <FocusPill />
      <FirstRunModeDialog />
      <WriterDeskNewMenu projectId={projectId} />
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
