// Legacy redirect: /character/:projectId (singular) -> /characters/:projectId.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/character/$projectId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/characters/$projectId",
      params: { projectId: params.projectId },
      replace: true,
    });
  },
});
