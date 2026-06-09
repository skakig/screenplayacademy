## Auto-Format Applied Indicator

Add a small, unobtrusive UI indicator inside the screenplay editor that surfaces when auto-formatting has changed the user's text, plus a beginner-friendly explanation of what auto-formatting does.

### 1. Track the last format event

In `ScreenplayDocumentEditor`, add state:

```ts
type FormatEvent = {
  original: string;
  formatted: string;
  blockType: string;
  at: number;
};
```

Expose this in `ScreenplayDocumentEditor` and render an inline indicator just above the keyboard-shortcut hints.

### 2. Wire `ScreenplayLine` to report formatting

Add an `onAutoFormatApplied` prop to `ScreenplayLine`. In `runSafeFormat()`, when `formatBlockText` produces a different string (and it passes the anti-fight guard), call:

```ts
onAutoFormatApplied?.({ original: raw, formatted, blockType: effectiveType });
```

### 3. Render the indicator

Inside `ScreenplayDocumentEditor`, below the block list and above the keyboard hints, show a small pill when `lastFormatEvent` is within the last 5 seconds:

- Left side: a sparkle/wand icon + text like "Auto-formatted to INT. DESERT - DAY"
- Right side: an info icon with a tooltip explaining: "Screenplays follow strict industry formatting. We automatically capitalize scene headings, character names, transitions, and other cues so your script looks professional."
- The pill auto-hides after 5 seconds and can be manually dismissed.
- Uses the existing font-sans styling to blend with the editor chrome.

### 4. Add translation keys

Create `src/lib/i18n/keys.ts` with a minimal key map so user-facing strings are not hardcoded and can be extracted when a proper i18n framework is wired:

```ts
export const i18nKeys = {
  "editor.autoFormat.indicator": "Auto-formatted to {{result}}",
  "editor.autoFormat.tooltip": "Screenplays follow strict industry formatting...",
} as const;
```

Use a tiny `t(key, vars?)` helper in the component.

5. Make sure the beginning of the sentence is in capitals if it's a dialogue, action or other appropriate formatting places.

### Files changed

- `src/components/editor/ScreenplayDocumentEditor.tsx` — add `FormatEvent` state, render indicator, pass callback to lines
- `src/components/editor/ScreenplayLine.tsx` — add `onAutoFormatApplied` prop and call it from `runSafeFormat()`
- `src/lib/i18n/keys.ts` (new) — translation key map
- `src/lib/i18n/t.ts` (new) — minimal fallback `t()` helper

### Out of scope

- Full i18n framework or language switching
- Persistent history of format events
- Settings to disable auto-formatting