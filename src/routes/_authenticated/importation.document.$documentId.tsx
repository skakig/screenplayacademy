import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ResolvedScreenplayView } from "@/components/importation/ResolvedScreenplayView";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute(
  "/_authenticated/importation/document/$documentId",
)({
  head: () => ({
    meta: [
      { title: "Resolved screenplay — SceneSmith Studio" },
      {
        name: "description",
        content:
          "Imported screenplay rendered with resolved, stable character identities from the ITS/PfHU pipeline.",
      },
    ],
  }),
  component: ResolvedDocumentRoute,
  errorComponent: ({ error, reset }) => (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md space-y-3 text-center">
        <h2 className="text-xl font-semibold">Couldn't load this document</h2>
        <p className="text-sm text-muted-foreground break-words">
          {error?.message ?? "Unknown error"}
        </p>
        <button
          onClick={reset}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center p-6 text-sm text-muted-foreground">
      Document not found.
    </div>
  ),
});

function ResolvedDocumentRoute() {
  const { documentId } = Route.useParams();
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Back
          </Link>
        </div>
        <div className="rounded-lg border border-border/60 bg-card">
          <ResolvedScreenplayView documentId={documentId} />
        </div>
      </div>
    </AppShell>
  );
}
