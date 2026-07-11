// Legacy redirect: /cast/:projectId -> /characters/:projectId (cast landing).
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/cast/$projectId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/characters/$projectId",
      params: { projectId: params.projectId },
      replace: true,
    });
  },
});
