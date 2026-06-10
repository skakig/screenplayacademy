# SCREENPLAY_IMPORT_PIPELINE.md

## Purpose

This document defines the import pipeline for SceneSmith.

The import feature should let a writer upload existing work and have SceneSmith intelligently parse, diagnose, and populate the project.

Import is not just file upload.

Import is the bridge from an existing script or rough draft into the full SceneSmith system:

- screenplay editor
- script blocks
- scenes
- characters
- Character Bible
- World Bible
- Project Dictionary
- lore/canon
- story arcs
- ITS/PfHU learning signals
- editor review suggestions

## Prime Rule

Import must preserve the writer's work first.

Do not destructively rewrite an imported script.

The pipeline should:

1. extract text
2. parse structure
3. identify screenplay elements
4. create a preview
5. let the writer approve corrections
6. populate the project
7. run diagnostics
8. offer reviewable suggestions

The writer remains the author.

## Supported Import Sources

SceneSmith should eventually support:

1. Plain text `.txt`
2. Fountain `.fountain`
3. Final Draft `.fdx`
4. PDF `.pdf`
5. Word `.docx`
6. Rich text `.rtf`
7. Markdown `.md`
8. Pasted text
9. Existing SceneSmith JSON export

## Implementation Order

Do not try to support every format at once.

Recommended order:

1. Pasted text
2. `.txt`
3. `.fountain`
4. `.fdx`
5. `.docx`
6. `.pdf`
7. `.rtf`

PDF should come later because PDF extraction is often messy and layout-dependent.

## Import Flow

The user flow should be:

```text
Upload or paste script
  -> Extract raw text
  -> Parse into candidate blocks
  -> Show import preview
  -> Diagnose issues
  -> Let writer approve mapping
  -> Populate script_blocks/scenes/characters/etc.
  -> Save import report
```

## Import Modes

### Safe Import Mode

Default.

- Preserve text aggressively.
- Parse obvious screenplay structure.
- Do not rewrite style.
- Show uncertain lines for review.
- Create suggestions instead of forced changes.

### Format Cleanup Mode

Optional.

- Apply safe screenplay formatting.
- Normalize scene headings.
- Normalize character names.
- Detect dialogue and parentheticals.
- Still requires preview before committing.

### Diagnostic Mode

Optional after import.

- Analyze structure, characters, scenes, arcs, dialogue, formatting, world terms, and canon candidates.
- Does not rewrite the script.
- Creates reviewable recommendations.

## Core Pipeline Stages

## Stage 1 — File Intake

Accept the file or pasted text and create an import session.

```ts
type ImportSession = {
  id: string;
  project_id: string;
  user_id: string;
  source_type:
    | "paste"
    | "txt"
    | "fountain"
    | "fdx"
    | "pdf"
    | "docx"
    | "rtf"
    | "markdown"
    | "scenesmith_json";
  file_name?: string;
  raw_text?: string;
  status:
    | "uploaded"
    | "extracting"
    | "parsing"
    | "preview_ready"
    | "approved"
    | "imported"
    | "failed";
  created_at: string;
  updated_at: string;
};
```

## Stage 2 — Text Extraction

Extract raw text from the source.

Rules:

- Keep original text as an immutable source snapshot.
- Preserve line breaks as much as possible.
- Preserve page breaks if available.
- Preserve indentation when meaningful.
- Do not auto-correct during extraction.

## Stage 3 — Block Parsing

Convert raw text into candidate screenplay blocks.

```ts
type ImportedBlockCandidate = {
  id: string;
  import_session_id: string;
  order_index: number;
  raw_text: string;
  proposed_block_type:
    | "scene_heading"
    | "action"
    | "character"
    | "dialogue"
    | "parenthetical"
    | "transition"
    | "shot"
    | "note"
    | "unknown";
  confidence: "high" | "medium" | "low";
  reason?: string;
  needs_review: boolean;
  proposed_scene_index?: number;
  proposed_character_name?: string;
};
```

## Parsing Heuristics

### Scene Heading Detection

High confidence when line starts with:

- `INT.`
- `EXT.`
- `INT./EXT.`
- `I/E.`

Medium confidence when line begins with:

- `int `
- `ext `
- `inside `
- `outside `

### Character Detection

High confidence when:

- short uppercase line
- followed by dialogue-like text
- not ending with `:`
- not a transition phrase

Medium confidence when:

- short title-case line
- matches known Character Bible name
- appears before dialogue

### Dialogue Detection

High confidence when:

- line follows a Character block
- line is not a Scene Heading
- line is not a Transition

### Parenthetical Detection

High confidence when:

- line starts with `(` and ends with `)`
- line appears between Character and Dialogue

### Transition Detection

High confidence when line matches common transitions:

- `CUT TO:`
- `FADE IN:`
- `FADE OUT:`
- `SMASH CUT TO:`
- `DISSOLVE TO:`

### Action Detection

Default fallback for narrative lines.

If unsure, prefer Action over destructive guessing.

## Stage 4 — Import Preview

Before creating project data, show a preview.

The preview should display:

- candidate blocks
- proposed block types
- confidence level
- warnings
- detected scenes
- detected characters
- detected locations
- detected unknown terms
- detected possible lore/canon entries

The writer should be able to:

- change a block type
- edit text
- merge lines
- split lines
- remove a line
- approve all high-confidence blocks
- review medium/low-confidence blocks
- cancel import

## Stage 5 — Populate Project

After writer approval, create project data.

Populate:

- `script_blocks`
- scenes from Scene Headings
- characters from Character blocks
- scene-character relationships
- locations from Scene Headings
- Project Dictionary candidates
- World Bible candidates
- import report

## Scene Creation

Each Scene Heading should create or link to a scene.

Scene data may include:

```ts
type ImportedScene = {
  scene_heading: string;
  location_name?: string;
  time_of_day?: string;
  first_block_order_index: number;
  last_block_order_index?: number;
  detected_characters?: string[];
};
```

## Character Extraction

Character blocks should create candidate characters.

Rules:

- normalize screenplay uppercase name
- preserve original spelling
- detect variants such as `(V.O.)`, `(O.S.)`, `(CONT'D)`
- do not auto-merge uncertain names without review

Example:

```text
STEPHAN
STEPHAN (V.O.)
Stephan
```

These may map to the same character, but the writer should be able to confirm.

## Location Extraction

Scene Headings should create location candidates.

Example:

```text
EXT. BY THE TANK - DAWN
```

Can produce:

```ts
{
  location_name: "BY THE TANK",
  time_of_day: "DAWN"
}
```

Location candidates can later feed the World Bible.

## Project Dictionary Extraction

The import pipeline should detect recurring unknown terms and offer them as dictionary candidates.

Examples:

- invented names
- fantasy terms
- military terms
- place names
- unusual character names
- foreign words

Do not spell-correct these terms during import.

Offer actions:

- Add to Project Dictionary
- Add as Character
- Add as Location
- Add as Lore Term
- Ignore

## World Bible and Lore Candidates

Import should detect possible worldbuilding items but not force them into canon.

Possible candidates:

- repeated unusual place names
- factions or organizations
- cultural terms
- historical references
- artifacts
- rules or laws
- repeated symbols

Default status should be `proposed`, not `canon`.

The writer should approve before they become canon.

## Auto-Diagnosis After Import

After import, run a diagnostic report.

The report should include:

### Formatting Diagnosis

- suspicious block types
- missing scene headings
- dialogue not attached to a character
- character names typed inside Action
- transitions formatted as Action
- parentheticals too long

### Structure Diagnosis

- scene count
- scenes with no clear turn
- long scenes
- very short scenes
- Act/sequence guesses if possible
- scenes with no characters

### Character Diagnosis

- detected cast list
- character appearance counts
- character first appearance
- dialogue volume by character
- characters with inconsistent names
- characters appearing only once

### World/Lore Diagnosis

- location list
- repeated unknown terms
- possible canon terms
- possible lore entries
- possible factions
- timeline/date references

### ITS/PfHU Diagnosis

- formatting skill signals
- structure skill signals
- dialogue skill signals
- worldbuilding tendency signals
- likely user coaching needs

## Import Report Model

```ts
type ImportReport = {
  id: string;
  project_id: string;
  import_session_id: string;
  summary: string;
  block_count: number;
  scene_count: number;
  character_count: number;
  location_count: number;
  warnings: ImportWarning[];
  recommendations: ImportRecommendation[];
};
```

## Import Warning Model

```ts
type ImportWarning = {
  id: string;
  severity: "info" | "warning" | "error";
  type:
    | "formatting"
    | "structure"
    | "character"
    | "continuity"
    | "worldbuilding"
    | "dictionary"
    | "unknown";
  message: string;
  related_candidate_ids?: string[];
};
```

## Writer Review Controls

The writer must be able to:

- approve import
- edit before import
- cancel import
- import as draft
- import into existing project
- import into new project
- keep original text snapshot
- revert import if needed

## Non-Destructive Rule

Never destroy original imported work.

Always keep:

- original file reference or raw text snapshot
- parsed candidate blocks
- final imported blocks
- import report

If the import parser gets something wrong, the writer should be able to recover.

## Edge Function Guidance

File parsing and AI-assisted diagnosis should happen through safe backend routes or Edge Functions, not in the frontend when secrets or heavy parsing are involved.

Possible functions:

```text
import-extract-text
import-parse-screenplay
import-diagnose-script
import-create-project-data
```

Do not expose API keys in the frontend.

## Recommended Tables

Possible tables:

- `import_sessions`
- `import_block_candidates`
- `import_reports`
- `import_warnings`
- `import_recommendations`
- `project_dictionary_entries`

All tables must be project-scoped and protected by RLS.

## Integration With Existing Editor

After import is approved:

- hydrate imported blocks into the local-first editor
- use stable local IDs in the editor
- keep server IDs separate
- allow immediate editing
- run focus-zone viewport behavior normally
- do not force a full page reload if avoidable

## Acceptance Tests

1. User can paste rough screenplay text and see a preview.
2. Scene Headings are detected correctly.
3. Character blocks are detected correctly.
4. Character + Dialogue flow is reconstructed correctly.
5. Unknown terms are preserved, not spell-corrected.
6. Repeated unusual terms become dictionary candidates.
7. Imported Scene Headings create scene records or scene candidates.
8. Imported Character blocks create character candidates.
9. Import preview allows block type correction before commit.
10. Import creates script blocks in correct order.
11. Refresh after import preserves imported content.
12. Imported content opens in the local-first editor and remains editable.
13. Diagnostics are shown as suggestions, not forced rewrites.
14. Original imported text is recoverable.

## Final Rule

Import should make an existing writer feel safe.

They should think:

> I can bring my work here, SceneSmith understands it, and nothing will be destroyed.

Import is the doorway into the full SceneSmith system.
