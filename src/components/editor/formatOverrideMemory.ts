// Per-project "do not fight the writer" memory. When the writer reverts an
// auto-applied fix within a short window, we remember the original token in
// localStorage and skip that exact fix next time.
//
// Lives in localStorage (small footprint) — survives reloads and works offline.

const KEY_PREFIX = "scenesmith.fixOverrides.v1.";

type Overrides = Record<string, "rejected" | "accepted">;

function key(projectId: string): string {
  return KEY_PREFIX + projectId;
}

function read(projectId: string): Overrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key(projectId));
    return raw ? (JSON.parse(raw) as Overrides) : {};
  } catch {
    return {};
  }
}

function write(projectId: string, value: Overrides) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(projectId), JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

export function getRejectedSet(projectId: string): Set<string> {
  const ov = read(projectId);
  return new Set(Object.entries(ov).filter(([, v]) => v === "rejected").map(([k]) => k));
}

export function markFixRejected(projectId: string, original: string) {
  const ov = read(projectId);
  ov[original.toLowerCase()] = "rejected";
  write(projectId, ov);
}

export function markFixAccepted(projectId: string, original: string) {
  const ov = read(projectId);
  ov[original.toLowerCase()] = "accepted";
  write(projectId, ov);
}

export function resetOverrides(projectId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(projectId));
  } catch {
    // noop
  }
}
