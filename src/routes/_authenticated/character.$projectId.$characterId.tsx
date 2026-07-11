// Legacy redirect: /character/:projectId/:characterId (singular) -> guided builder.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/character/$projectId/$characterId")({
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
