import { cn } from "@/lib/utils";

/** Players' colours, sitting in a circle ("davra"): the Davradosh mark. */
const DOTS = ["#6C5CE7", "#00B894", "#E84393", "#FDAA2C", "#0984E3", "#E17055"];

export function DavradoshMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("shrink-0", className)} aria-hidden>
      <rect width="64" height="64" rx="16" fill="#1C1A24" />
      {DOTS.map((color, i) => {
        const angle = (i / DOTS.length) * Math.PI * 2 - Math.PI / 2;
        return (
          <circle
            key={color}
            cx={32 + Math.cos(angle) * 17}
            cy={32 + Math.sin(angle) * 17}
            r={6.5}
            fill={color}
          />
        );
      })}
    </svg>
  );
}
