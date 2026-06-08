import { createFileRoute } from "@tanstack/react-router";
import { ScreenplayDocumentEditor } from "@/components/editor/ScreenplayDocumentEditor";
import { NullPersistenceAdapter } from "@/components/editor/screenplayPersistence";

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

function EditorLab() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-[760px] mx-auto px-6 py-3 flex items-center justify-between font-sans">
          <div>
            <h1 className="text-sm font-semibold">Editor Lab</h1>
            <p className="text-[11px] text-muted-foreground">
              Local-only. No saves. Refresh wipes content. Prove the writing engine here first.
            </p>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-mono">
            Pass 1 · local-first
          </span>
        </div>
      </header>

      <main className="py-6">
        <ScreenplayDocumentEditor
          projectId="editor-lab"
          initialBlocks={[]}
          persistence={NullPersistenceAdapter}
        />
      </main>
    </div>
  );
}
