# WORLD_LORE_CANON_ARCHITECTURE.md

## Purpose

This document defines the future architecture for SceneSmith worldbuilding: maps, locations, lore, canon, timelines, cultures, factions, languages, rules, artifacts, and continuity.

SceneSmith should not only help a writer draft scenes. It should help a writer build and protect a living story world.

This is especially important for fantasy, science fiction, historical drama, shared universes, series television, games, and large ensemble stories.

## Prime Rule

Worldbuilding must serve the story.

The world engine should help the writer create stronger scenes, characters, conflict, continuity, and meaning. It should not become a disconnected encyclopedia.

Correct flow:

```text
Story need -> world detail -> canon rule -> scene use -> continuity check -> coaching signal
```

Avoid:

```text
Endless lore -> no scene -> no conflict -> no finished script
```

## Core Product Vision

The World Bible becomes the shared memory of the project.

It should answer:

- Where are we?
- What exists here?
- What happened here before?
- Who controls this place?
- What rules govern this world?
- What terms, names, and languages belong to this world?
- What is canon, draft, rumored, contradicted, or retired?
- How does this world pressure the characters?
- How does this world support the theme?

## Core Modules

SceneSmith should eventually support:

1. World Map
2. Location Bible
3. Lore Entries
4. Canon Rules
5. Timeline and Events
6. Factions and Organizations
7. Cultures and Societies
8. Languages and Terms
9. Objects and Artifacts
10. Systems and Rules
11. Continuity Checker
12. Project Dictionary
13. ITS/PfHU Worldbuilding Tutor

## Canon Status

Not every idea is final canon.

```ts
type CanonStatus =
  | "canon"
  | "draft"
  | "proposed"
  | "rumor"
  | "contradicted"
  | "deprecated";
```

Rules:

- `canon` means accepted truth for the project.
- `draft` means current working idea.
- `proposed` means writer or AI suggestion not yet approved.
- `rumor` means it may exist in-world but may not be objectively true.
- `contradicted` means another canon item conflicts with it.
- `deprecated` means no longer used but kept for history.

AI must not treat proposed or deprecated lore as final truth.

## World Location Model

```ts
type WorldLocation = {
  id: string;
  project_id: string;
  name: string;
  type:
    | "world"
    | "continent"
    | "country"
    | "region"
    | "city"
    | "village"
    | "building"
    | "room"
    | "landmark"
    | "route"
    | "hidden_place"
    | "custom";
  parent_location_id?: string;
  description?: string;
  visual_identity?: string;
  atmosphere?: string;
  controlling_faction_id?: string;
  related_character_ids?: string[];
  related_scene_ids?: string[];
  map_coordinates?: { x: number; y: number; z?: number };
  real_world_reference?: string;
  canon_status: CanonStatus;
};
```

## Lore Entry Model

```ts
type LoreEntry = {
  id: string;
  project_id: string;
  title: string;
  category:
    | "history"
    | "myth"
    | "law"
    | "custom"
    | "technology"
    | "symbol"
    | "family"
    | "politics"
    | "economy"
    | "secret"
    | "belief"
    | "language"
    | "custom";
  summary: string;
  full_text?: string;
  related_location_ids?: string[];
  related_character_ids?: string[];
  related_faction_ids?: string[];
  related_scene_ids?: string[];
  first_revealed_scene_id?: string;
  canon_status: CanonStatus;
  visibility:
    | "writer_only"
    | "reader_knows"
    | "character_knows"
    | "hidden_until_revealed";
};
```

## Canon Term Model

World-specific words should feed the Project Dictionary and language intelligence layer.

```ts
type CanonTerm = {
  id: string;
  project_id: string;
  term: string;
  pronunciation?: string;
  category:
    | "name"
    | "place"
    | "rank"
    | "object"
    | "language"
    | "slang"
    | "title"
    | "custom";
  definition?: string;
  related_lore_id?: string;
  related_location_id?: string;
  related_character_id?: string;
  approved_dictionary_entry: boolean;
  canon_status: CanonStatus;
};
```

## Timeline Event Model

```ts
type WorldEvent = {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  event_type:
    | "historical"
    | "backstory"
    | "scene_event"
    | "discovery"
    | "founding"
    | "collapse"
    | "migration"
    | "reveal"
    | "custom";
  date_label?: string;
  timeline_order?: number;
  related_scene_id?: string;
  related_character_ids?: string[];
  related_location_ids?: string[];
  related_faction_ids?: string[];
  canon_status: CanonStatus;
};
```

## Faction Model

```ts
type Faction = {
  id: string;
  project_id: string;
  name: string;
  type: string;
  description?: string;
  values?: string[];
  goals?: string[];
  allies?: string[];
  rivals?: string[];
  leader_character_id?: string;
  member_character_ids?: string[];
  headquarters_location_id?: string;
  symbols?: string[];
  rules?: string[];
  canon_status: CanonStatus;
};
```

## Editor Integration

The world engine should connect to the screenplay editor.

Examples:

- Scene Heading recognizes known locations.
- Unknown locations can be added to the World Map.
- Dialogue can reference lore terms without being flagged as spelling errors.
- A scene can reveal a Lore Entry.
- A location can show continuity notes in the sidebar.
- The editor can warn if a character knows lore they should not know.
- The editor can suggest adding a repeated unfamiliar term to canon.

## Character Bible Integration

The World Bible and Character Bible should connect.

Characters may have:

- birthplace
- culture
- faction membership
- social class
- language
- loyalty
- taboo
- secret knowledge
- relationship to locations
- relationship to historical events
- relationship to artifacts

These links can feed dialogue, motivation, conflict, and moral pressure.

## ITS/PfHU Integration

Worldbuilding can become a teaching signal.

The ITS can teach:

- how to reveal lore through action
- how to avoid exposition dumps
- how to use world rules to create conflict
- how to build cultures that affect behavior
- how to maintain continuity
- how to keep worldbuilding connected to character arcs

The PfHU can learn:

- whether the writer overbuilds lore but avoids scenes
- whether the writer writes scenes but forgets continuity
- whether the writer needs structure help
- whether the writer prefers maps, timelines, or character-first organization
- whether the writer repeatedly contradicts canon
- whether the writer needs coaching on exposition

## Canon Review Mode

Future Canon Review Mode should let the writer review world consistency.

It should show:

- contradictions
- unresolved lore
- unused lore
- repeated unknown terms
- location inconsistencies
- timeline inconsistencies
- character knowledge conflicts
- faction conflicts

Every finding should support:

- accept
- edit
- reject
- mark intentional
- add to canon
- add to dictionary

## World Map UI

Future World Map UI should support:

- visual map canvas
- list of locations
- location cards
- scene pins
- character paths
- faction territory overlays
- timeline overlays
- canon/lore markers
- exportable map notes

Do not require a finished map image to build world data. The map can begin as structured location nodes.

## Recommended Tables

Future tables may include:

- `worlds`
- `world_locations`
- `lore_entries`
- `canon_terms`
- `world_events`
- `factions`
- `cultures`
- `world_rules`
- `artifacts`
- `location_scene_uses`
- `canon_contradictions`
- `project_dictionary_entries`

All tables must be project-scoped and protected by RLS.

## Recommended Helper Modules

Possible files:

```text
src/components/world/WorldBible.tsx
src/components/world/WorldMap.tsx
src/components/world/LorePanel.tsx
src/components/world/CanonReview.tsx
src/components/world/TimelineView.tsx
src/components/world/FactionManager.tsx
src/lib/world/canonEngine.ts
src/lib/world/worldDictionary.ts
src/lib/world/continuityChecks.ts
src/lib/world/worldGraph.ts
```

## Integration Order

Do not build the full world engine before the screenplay editor is stable.

Recommended order:

1. Project Dictionary and Canon Terms.
2. Locations from Scene Headings.
3. Basic World Bible page.
4. Lore Entries.
5. Character Bible links.
6. Timeline and events.
7. Factions and cultures.
8. Canon Review Mode.
9. Visual World Map.
10. ITS/PfHU worldbuilding coaching.

## Acceptance Tests

1. Repeated unknown term can be added to Project Dictionary.
2. Known canon term is not spell-corrected.
3. Scene Heading location can become a World Location.
4. Lore Entry can link to a scene.
5. Character can link to a culture or faction.
6. Canon status can be canon, draft, proposed, rumor, contradicted, or deprecated.
7. Contradiction warnings are reviewable, not forced rewrites.
8. Editor can show lore/context without stealing writing focus.
9. ITS/PfHU can recommend a lesson based on repeated lore issues.
10. AI suggestions never treat proposed lore as final canon without writer approval.

## Final Rule

A powerful story world is not a pile of lore.

It is a living system of places, rules, history, language, and pressure that makes scenes stronger.

SceneSmith should help the writer build worlds that produce better stories.
