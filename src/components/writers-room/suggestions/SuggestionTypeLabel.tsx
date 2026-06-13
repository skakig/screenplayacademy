import { t } from "@/lib/i18n/t";
import type { I18nKey } from "@/lib/i18n/keys";
import type { SuggestionType } from "@/lib/suggestions";

const KEY: Record<SuggestionType, I18nKey> = {
  replace_block_text: "collab.suggestionType.replaceBlockText",
  insert_block_after: "collab.suggestionType.insertBlockAfter",
  delete_block: "collab.suggestionType.deleteBlock",
  change_block_type: "collab.suggestionType.changeBlockType",
  rewrite_scene: "collab.suggestionType.rewriteScene",
  character_note: "collab.suggestionType.characterNote",
  structure_note: "collab.suggestionType.structureNote",
  continuity_fix: "collab.suggestionType.continuityFix",
  pitch_deck_note: "collab.suggestionType.pitchDeckNote",
};

export function suggestionTypeLabel(type: SuggestionType): string {
  return t(KEY[type]);
}

export function SuggestionTypeLabel({ type }: { type: SuggestionType }) {
  return (
    <span className="text-xs uppercase tracking-wide text-muted-foreground">
      {suggestionTypeLabel(type)}
    </span>
  );
}
