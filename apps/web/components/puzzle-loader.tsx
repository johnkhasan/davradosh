import { type CSSProperties, useId } from "react";
import { cn } from "@/lib/utils";

const S = 48; // piece size in the 100×100 grid
const KNOB = 7;
const HOLE = KNOB + 1.5;

/** Each piece: where it sits, its knobs (sticking into neighbours), its holes (from neighbours). */
const PIECES = [
  {
    x: 0,
    y: 0,
    color: "var(--primary)",
    knobs: [
      [50, 24],
      [24, 50],
    ],
    holes: [],
    dx: -26,
    dy: -22,
    r: -24,
  },
  {
    x: 52,
    y: 0,
    color: "var(--snap)",
    knobs: [[76, 50]],
    holes: [[50, 24]],
    dx: 26,
    dy: -24,
    r: 20,
  },
  { x: 0, y: 52, color: "#E84393", knobs: [[50, 76]], holes: [[24, 50]], dx: -24, dy: 26, r: 18 },
  {
    x: 52,
    y: 52,
    color: "var(--success)",
    knobs: [],
    holes: [
      [76, 50],
      [50, 76],
    ],
    dx: 26,
    dy: 24,
    r: -20,
  },
] as const;

/** Four jigsaw pieces that fly in, lock together and scatter again, on a loop. */
export function PuzzleMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="-12 -12 124 124" className={cn("overflow-visible", className)} aria-hidden>
      <defs>
        {PIECES.map((piece, i) => (
          <mask
            key={i}
            id={`${id}-m${i}`}
            maskUnits="userSpaceOnUse"
            x={-20}
            y={-20}
            width={140}
            height={140}
          >
            <rect x={-20} y={-20} width={140} height={140} fill="white" />
            {piece.holes.map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={HOLE} fill="black" />
            ))}
          </mask>
        ))}
      </defs>
      <g className="puzzle-loader">
        {PIECES.map((piece, i) => (
          <g
            key={i}
            className="puzzle-loader-piece"
            style={
              {
                "--dx": `${piece.dx}px`,
                "--dy": `${piece.dy}px`,
                "--r": `${piece.r}deg`,
                "--delay": `${i * 0.12}s`,
              } as CSSProperties
            }
          >
            <g mask={`url(#${id}-m${i})`} fill={piece.color}>
              <rect x={piece.x} y={piece.y} width={S} height={S} rx={9} />
              {piece.knobs.map(([cx, cy]) => (
                <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={KNOB} />
              ))}
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
}

/**
 * Loading state with the animated puzzle mark and a label.
 * `screen` fills the viewport (route/chunk loading); `overlay` centres a card over its parent.
 */
export function PuzzleLoader({
  label = "Yuklanmoqda",
  variant = "screen",
  tone = "default",
  className,
}: {
  label?: string;
  variant?: "screen" | "overlay";
  /** "onTable" for dark/coloured play surfaces behind the loader. */
  tone?: "default" | "onTable";
  className?: string;
}) {
  const content = (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center gap-4",
        variant === "overlay" &&
          "rounded-card bg-surface/95 px-8 py-6 shadow-soft-lg backdrop-blur",
      )}
    >
      <PuzzleMark className="size-16" />
      <p
        className={cn(
          "flex items-baseline text-sm font-medium",
          tone === "onTable" && variant === "screen" ? "text-white/85" : "text-muted",
        )}
      >
        {label}
        <span aria-hidden className="ml-0.5 inline-flex">
          {[0, 1, 2].map((i) => (
            <span key={i} className="puzzle-loader-dot" style={{ animationDelay: `${i * 0.16}s` }}>
              .
            </span>
          ))}
        </span>
      </p>
    </div>
  );

  return (
    <div
      className={cn(
        "flex items-center justify-center",
        variant === "screen" ? "fixed inset-0" : "absolute inset-0",
        className,
      )}
    >
      {content}
    </div>
  );
}
