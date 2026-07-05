/**
 * ProjectNav — deprecated. Kept as a no-op for source compatibility.
 *
 * All project navigation now lives inside the single Studio Menu drawer
 * rendered by `AppShell`. Rooms are grouped by creative purpose
 * (Write / Plan / Polish / Produce / Studio / Settings) instead of a
 * horizontal room bar.
 *
 * This file intentionally renders `null` so every route that imports it
 * keeps compiling while contributing no extra chrome to the shell.
 */
export function ProjectNav(_props: { projectId: string; title?: string }) {
  return null;
}
