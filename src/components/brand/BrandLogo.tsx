import { Link } from "@tanstack/react-router";
import mark from "@/assets/scenesmith-mark.png.asset.json";

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, { img: string; name: string; sub: string; gap: string }> = {
  sm: { img: "h-7 w-7", name: "text-lg leading-none", sub: "text-[8px] tracking-[0.32em]", gap: "gap-2" },
  md: { img: "h-10 w-10", name: "text-2xl leading-none", sub: "text-[10px] tracking-[0.36em]", gap: "gap-2.5" },
  lg: { img: "h-14 w-14 md:h-16 md:w-16", name: "text-4xl md:text-5xl leading-none", sub: "text-xs tracking-[0.42em]", gap: "gap-3" },
};

export function BrandLogo({
  size = "sm",
  asLink = true,
  className = "",
}: {
  size?: Size;
  asLink?: boolean;
  className?: string;
}) {
  const s = SIZES[size];
  const inner = (
    <span className={`inline-flex items-center ${s.gap} ${className}`}>
      <img
        src={mark.url}
        alt="SceneSmith Studio logo"
        className={`${s.img} object-contain shrink-0 drop-shadow-[0_2px_8px_oklch(0_0_0_/_0.45)]`}
      />
      <span className="flex flex-col">
        <span className={`font-display font-semibold tracking-tight text-foreground ${s.name}`}>
          SceneSmith
        </span>
        <span className={`font-sans font-semibold uppercase text-primary ${s.sub}`}>
          Studio
        </span>
      </span>
    </span>
  );
  if (!asLink) return inner;
  return (
    <Link to="/" aria-label="SceneSmith Studio — Home" className="group">
      {inner}
    </Link>
  );
}
