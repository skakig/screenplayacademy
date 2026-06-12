import scenesmithMarkAsset from "@/assets/scenesmith-mark.png.asset.json";

type SceneSmithLogoProps = {
  className?: string;
  iconClassName?: string;
  wordmarkClassName?: string;
  stacked?: boolean;
};

export function SceneSmithLogo({
  className = "",
  iconClassName = "h-10 w-10",
  wordmarkClassName = "",
  stacked = false,
}: SceneSmithLogoProps) {
  return (
    <div
      className={`inline-flex items-center gap-3 ${stacked ? "flex-col items-start gap-2" : ""} ${className}`.trim()}
    >
      <img
        src={scenesmithMarkAsset.url}
        alt="SceneSmith Studio logo"
        className={`${iconClassName} shrink-0 object-contain`.trim()}
        loading="eager"
      />
      <div className={`leading-none ${wordmarkClassName}`.trim()}>
        <div className="font-display text-[1.9rem] font-semibold text-foreground">SceneSmith</div>
        <div className="mt-1 text-[0.7rem] font-medium uppercase tracking-[0.45em] text-primary">
          Studio
        </div>
      </div>
    </div>
  );
}
