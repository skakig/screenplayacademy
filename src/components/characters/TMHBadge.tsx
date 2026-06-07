import { tmhLabel, tmhVar } from "./tmh";

export function TMHBadge({ level, label, size = "sm" }: { level?: number | null; label?: string; size?: "xs" | "sm" }) {
  const text = label ?? tmhLabel(level);
  return (
    <span
      className={[
        "inline-flex items-center rounded-full font-medium tracking-wide",
        size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
      ].join(" ")}
      style={{
        background: `color-mix(in oklab, ${tmhVar(level)} 22%, transparent)`,
        color: `color-mix(in oklab, ${tmhVar(level)} 80%, white)`,
        border: `1px solid color-mix(in oklab, ${tmhVar(level)} 45%, transparent)`,
      }}
    >
      {text}
    </span>
  );
}
