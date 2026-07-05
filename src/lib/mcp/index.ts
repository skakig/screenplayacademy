import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjectsTool from "./tools/list-projects";
import getProjectTool from "./tools/get-project";
import listScenesTool from "./tools/list-scenes";
import listCharactersTool from "./tools/list-characters";
import createSceneTool from "./tools/create-scene";
import updateSceneTool from "./tools/update-scene";
import upsertCharacterTool from "./tools/upsert-character";
import appendScriptBlocksTool from "./tools/append-script-blocks";
import updateScriptBlockTool from "./tools/update-script-block";

// The OAuth issuer MUST be the direct Supabase host (never the .lovable.cloud proxy).
// VITE_SUPABASE_PROJECT_ID is inlined by Vite at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "scenesmith-studio-mcp",
  title: "SceneSmith Studio",
  version: "0.2.0",
  instructions:
    "Read and edit the signed-in writer's SceneSmith Studio screenplay projects. Read tools: list_projects, get_project, list_scenes, list_characters. Write tools: create_scene, update_scene, upsert_character, append_script_blocks, update_script_block. All writes act as the signed-in user, are enforced by row-level security, and refuse to overwrite a scene that another collaborator has locked in the Writers' Room.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listProjectsTool,
    getProjectTool,
    listScenesTool,
    listCharactersTool,
    createSceneTool,
    updateSceneTool,
    upsertCharacterTool,
    appendScriptBlocksTool,
    updateScriptBlockTool,
  ],
});
