import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/characters/$projectId")({
  component: CharactersLayout,
});

function CharactersLayout() {
  return <Outlet />;
}