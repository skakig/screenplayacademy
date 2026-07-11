/**
 * Pure-data mirror of the Studio Menu structure defined in
 * `src/components/StudioMenu.tsx`. Kept free of React / lucide imports so it
 * can be consumed by node scripts (route matrix regeneration), tests, and
 * SSR-safe modules alike.
 *
 * A vitest (`StudioMenu.matrix.test.ts`) asserts that this manifest and the
 * live `GROUPS` array in StudioMenu.tsx stay in lockstep. When you edit one,
 * you must edit the other or `bun run route-matrix` will refuse to regenerate.
 */

import type { Feature } from "@/lib/entitlements";

export type MenuItemManifest = {
  to: string;
  label: string;
  desc: string;
  /** lucide icon name — mirrors the `icon` prop on GROUPS. */
  iconName: string;
  needsProject?: boolean;
  guidedOnly?: boolean;
  feature?: Feature;
  experimental?: boolean;
  setupRequires?: "billing";
  needsData?: "scenes" | "characters" | "script";
};

export type MenuGroupManifest = {
  key: string;
  label: string;
  items: MenuItemManifest[];
};

export const MENU_MANIFEST: MenuGroupManifest[] = [
  {
    key: "school",
    label: "School — Learn to write",
    items: [
      { to: "/academy", label: "SceneSmith Academy", desc: "Lessons, modules, and craft fundamentals.", iconName: "GraduationCap" },
      { to: "/first-screenplay/$projectId", label: "Guided Path", desc: "Step-by-step from idea to draft.", iconName: "Compass", needsProject: true, guidedOnly: true },
    ],
  },
  {
    key: "editor",
    label: "Editor — Write the screenplay",
    items: [
      { to: "/editor/$projectId", label: "Writer's Desk", desc: "The page. Where the screenplay lives.", iconName: "FileText", needsProject: true },
      { to: "/scenes/$projectId", label: "Scene Board", desc: "See every scene on one wall.", iconName: "LayoutGrid", needsProject: true, needsData: "scenes" },
      { to: "/vault/$projectId", label: "Scene Vault", desc: "Stash scenes, fragments, and alt takes.", iconName: "Archive", needsProject: true },
      { to: "/story-arc/$projectId", label: "Story Spine", desc: "Beats and turning points across three acts.", iconName: "GitBranch", needsProject: true },
      { to: "/characters/$projectId", label: "Characters", desc: "Character profiles, wants, wounds.", iconName: "Users", needsProject: true },
      { to: "/arc-timeline/$projectId", label: "Dramatic Pulse", desc: "Tension and stakes scene-by-scene.", iconName: "Activity", needsProject: true, needsData: "scenes" },
    ],
  },
  {
    key: "producer",
    label: "Producer — Ship the screenplay",
    items: [
      { to: "/pitch/$projectId", label: "Pitch Deck", desc: "Logline, synopsis, treatment, pitch email.", iconName: "Sparkles", needsProject: true, feature: "pitch", needsData: "script" },
      { to: "/tableread/$projectId", label: "Table Read", desc: "Hear it read aloud with AI voices.", iconName: "Mic", needsProject: true, feature: "table_read", needsData: "characters", experimental: true },
      { to: "/storyboard/$projectId", label: "Shot Wall", desc: "Visualize scenes as storyboards.", iconName: "ImageIcon", needsProject: true, feature: "storyboard", needsData: "scenes", experimental: true },
      { to: "/writers-room/$projectId", label: "Writers' Room", desc: "Invite collaborators, notes, sessions.", iconName: "UsersRound", needsProject: true, feature: "writers_room", experimental: true },
    ],
  },
  {
    key: "studio",
    label: "Studio",
    items: [
      { to: "/dashboard", label: "Studio Lobby", desc: "Your home base.", iconName: "Home" },
      { to: "/projects", label: "Script Vault", desc: "All your projects.", iconName: "FolderKanban" },
      { to: "/settings", label: "Studio Settings", desc: "Preferences and account.", iconName: "Settings" },
      { to: "/pricing", label: "Pricing", desc: "Plans and billing.", iconName: "CreditCard", setupRequires: "billing" },
    ],
  },
];
