import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjectsTool from "./tools/list-projects";
import getProjectTool from "./tools/get-project";
import listScenesTool from "./tools/list-scenes";
import listCharactersTool from "./tools/list-characters";

// The OAuth issuer MUST be the direct Supabase host (never the .lovable.cloud proxy).
// VITE_SUPABASE_PROJECT_ID is inlined by Vite at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "scenesmith-studio-mcp",
  title: "SceneSmith Studio",
  version: "0.1.0",
  instructions:
    "Read-only access to the signed-in writer's SceneSmith Studio screenplay projects: list projects, fetch project details, list scenes and characters. Use these to gather context about a writer's work before offering script notes, character analysis, or story suggestions.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listProjectsTool, getProjectTool, listScenesTool, listCharactersTool],
});
