// Legacy redirect: /characters/:projectId/profile/:characterId -> guided builder.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/characters/$projectId/profile/$characterId")({
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
