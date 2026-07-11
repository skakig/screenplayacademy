import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("Character route emergency repair", () => {
  it("keeps /characters/$projectId as a layout route with an Outlet", () => {
    const layout = read("src/routes/_authenticated/characters.$projectId.tsx");

    expect(layout).toContain('createFileRoute("/_authenticated/characters/$projectId")');
    expect(layout).toContain("Outlet");
    expect(layout).not.toContain("CharactersPage");
    expect(layout).not.toContain("AppShell");
  });

  it("moves the cast landing page to the nested index route", () => {
    const index = read("src/routes/_authenticated/characters.$projectId.index.tsx");

    expect(index).toContain('createFileRoute("/_authenticated/characters/$projectId/")');
    expect(index).toContain("function CharactersPage");
    expect(index).toContain('useSearch({ from: "/_authenticated/characters/$projectId/" })');
  });

  it("uses /build as the only route that creates a first character", () => {
    const resolver = read("src/routes/_authenticated/characters.$projectId.build.index.tsx");
    const builder = read("src/routes/_authenticated/characters.$projectId.build.$characterId.tsx");

    expect(resolver).toContain('createFileRoute("/_authenticated/characters/$projectId/build/")');
    expect(resolver).toContain("callUpsert");
    expect(resolver).toContain('to: "/characters/$projectId/build/$characterId"');

    expect(builder).not.toContain("autoCreateRef");
    expect(builder).not.toContain("Created your first character");
    expect(builder).toContain('t("characters.builder.notFoundTitle")');
  });

  it("starts the guided builder with Identity and exposes portrait configuration status", () => {
    const builder = read("src/routes/_authenticated/characters.$projectId.build.$characterId.tsx");

    const identityIndex = builder.indexOf('field: "identity"');
    const roleIndex = builder.indexOf('field: "role"');
    expect(identityIndex).toBeGreaterThan(-1);
    expect(roleIndex).toBeGreaterThan(identityIndex);

    expect(builder).toContain("getImageGenStatus");
    expect(builder).toContain('t("characters.builder.portrait.notConfigured")');
    // Generate button must be gated on image-gen configuration status.
    expect(builder).toMatch(/disabled=\{[^}]*imageStatus\?\.configured === false[^}]*\}/);
    expect(builder).toMatch(/disabled=\{[^}]*imageStatusLoading[^}]*\}/);
  });
});