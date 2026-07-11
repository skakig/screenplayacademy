// Legacy route redirect — the old character UI (tabbed profile dialog) has been
// replaced by the guided builder at /characters/$projectId/build/$characterId.
// Any existing link of the form /characters/:projectId/:characterId is
// permanently redirected to the new interface.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/characters/$projectId/$characterId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/characters/$projectId/build/$characterId",
      params: {
        projectId: params.projectId,
        characterId: params.characterId,
      },
      replace: true,
    });
  },
});
