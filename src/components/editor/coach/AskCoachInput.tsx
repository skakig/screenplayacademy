import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  onAsk: (prompt: string) => void;
  loading?: boolean;
  placeholder?: string;
};

/**
 * Sticky chat input pinned to the bottom of the Coach pane.
 * Submits a free-form question to the AI assistant runner already wired
 * into the editor route.
 */
export function AskCoachInput({ onAsk, loading, placeholder }: Props) {
  const [text, setText] = useState("");
  const submit = () => {
    const v = text.trim();
    if (!v || loading) return;
    onAsk(v);
    setText("");
  };
  return (
    <div className="sticky bottom-0 -mx-4 px-4 py-3 mt-3 border-t border-border/60 bg-card/95 backdrop-blur">
      <div className="relative">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder ?? "Ask Coach about this scene…"}
          className="text-xs min-h-[56px] pr-10 resize-none bg-background/60 border-border/60 focus-visible:ring-primary/30"
        />
        <button
          onClick={submit}
          disabled={!text.trim() || loading}
          aria-label="Send"
          className="absolute right-2 bottom-2 inline-flex items-center justify-center h-7 w-7 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </button>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground/70 text-right">⌘↵ to send</p>
    </div>
  );
}
