import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ScreenplayDocumentEditor } from "@/components/editor/ScreenplayDocumentEditor";
import {
  NullPersistenceAdapter,
  type PersistenceAdapter,
} from "@/components/editor/screenplayPersistence";
import { createSupabasePersistenceAdapter } from "@/components/editor/persistence/SupabasePersistenceAdapter";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/editor-lab")({
  head: () => ({
    meta: [
      { title: "Editor Lab — Local-only screenplay engine" },
      {
        name: "description",
        content:
          "Local-only screenplay editor proving ground. No network, no Supabase, no AI — just the writing engine.",
      },
    ],
  }),
  component: EditorLab,
});

const LAB_PROJECT_ID = "editor-lab-scratch";

type AdapterMode = "null" | "supabase";

function EditorLab() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<AdapterMode>("null");
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setSignedIn(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSignedIn(!!s);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const persistence = useMemo<PersistenceAdapter>(() => {
    if (mode === "supabase" && signedIn) {
      return createSupabasePersistenceAdapter({
        projectId: LAB_PROJECT_ID,
        queryClient: qc,
        onSaveStatus: setSaveStatus,
        onLastSaved: setLastSavedAt,
      });
    }
    return NullPersistenceAdapter;
    // Re-create when toggling so the previous adapter's queues are dropped.
  }, [mode, signedIn, qc]);

  const activeLabel =
    mode === "supabase" && signedIn ? "Supabase adapter" : "Null adapter (local only)";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-[760px] mx-auto px-6 py-3 flex items-center justify-between gap-4 font-sans flex-wrap">
          <div>
            <h1 className="text-sm font-semibold">Editor Lab</h1>
            <p className="text-[11px] text-muted-foreground">
              {activeLabel}. Verify Null mode first — switch to Supabase only after Null passes.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-[10px] text-muted-foreground font-mono">
              {saveStatus}
              {lastSavedAt ? ` · ${new Date(lastSavedAt).toLocaleTimeString()}` : ""}
            </div>
            <div className="inline-flex rounded-md border border-border/70 overflow-hidden text-[11px]">
              <button
                className={`px-2.5 py-1 ${mode === "null" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground"}`}
                onClick={() => setMode("null")}
              >
                Null
              </button>
              <button
                className={`px-2.5 py-1 ${mode === "supabase" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground"} ${!signedIn ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={() => signedIn && setMode("supabase")}
                title={signedIn ? "Use Supabase persistence" : "Sign in at /auth to enable"}
                disabled={!signedIn}
              >
                Supabase
              </button>
            </div>
          </div>
        </div>
        {mode === "supabase" && !signedIn && (
          <div className="max-w-[760px] mx-auto px-6 pb-2 text-[11px] text-amber-600 font-sans">
            Sign in at <a className="underline" href="/auth">/auth</a> to enable Supabase persistence in the lab.
          </div>
        )}
      </header>

      <main className="py-6">
        <ScreenplayDocumentEditor
          key={mode + String(signedIn)}
          projectId={LAB_PROJECT_ID}
          initialBlocks={[]}
          persistence={persistence}
          onSaveStatus={setSaveStatus}
          onLastSaved={setLastSavedAt}
        />
      </main>
    </div>
  );
}
