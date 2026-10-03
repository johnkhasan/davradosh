import type { UnoCard, UnoColor } from "@puzzle/shared/games/uno";
import { useId } from "react";
import { cn } from "@/lib/utils";

/** Card colours: saturated enough to read on the dark felt, light and dark site themes. */
export const UNO_HEX: Record<UnoColor, string> = {
  red: "#e5484d",
  yellow: "#f2b51b",
  green: "#2f9e62",
  blue: "#3b74f0",
};

export const UNO_COLOR_NAMES: Record<UnoColor, string> = {
  red: "qizil",
  yellow: "sariq",
  green: "yashil",
  blue: "ko'k",
};

const WHEEL: UnoColor[] = ["red", "yellow", "green", "blue"];

/** Short name for logs and screen readers, e.g. "qizil 7", "ko'k +2", "+4". */
export function cardName(card: UnoCard): string {
  if (card.value === "wild") return "joker";
  if (card.value === "wild4") return "+4";
  const color = UNO_COLOR_NAMES[card.color as UnoColor];
  const value =
    card.value === "skip"
      ? "o'tkazish"
      : card.value === "reverse"
        ? "teskari"
        : card.value === "draw2"
          ? "+2"
          : card.value;
  return `${color} ${value}`;
}

/** Four quarter slices around (cx, cy). */
function Wheel({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      {WHEEL.map((color, i) => {
        const a0 = (i * Math.PI) / 2 - Math.PI / 2;
        const a1 = a0 + Math.PI / 2;
        const x0 = cx + r * Math.cos(a0);
        const y0 = cy + r * Math.sin(a0);
        const x1 = cx + r * Math.cos(a1);
        const y1 = cy + r * Math.sin(a1);
        return (
          <path
            key={color}
            d={`M${cx} ${cy}L${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z`}
            fill={UNO_HEX[color]}
          />
        );
      })}
    </g>
  );
}

/** The symbol of a coloured card, centred on (x, y) with height about `size`. */
function CardSymbol({
  card,
  x,
  y,
  size,
  fill,
}: {
  card: UnoCard;
  x: number;
  y: number;
  size: number;
  fill: string;
}) {
  if (card.value === "skip") {
    const r = size * 0.36;
    return (
      <g stroke={fill} strokeWidth={size * 0.12} fill="none" strokeLinecap="round">
        <circle cx={x} cy={y} r={r} />
        <line x1={x - r * 0.7} y1={y + r * 0.7} x2={x + r * 0.7} y2={y - r * 0.7} />
      </g>
    );
  }
  if (card.value === "reverse") {
    const w = size * 0.42;
    const h = size * 0.2;
    const s = size * 0.11;
    return (
      <g stroke={fill} strokeWidth={s} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={`M${x - w} ${y - h}H${x + w}M${x + w - h} ${y - 2 * h}L${x + w} ${y - h}`} />
        <path d={`M${x + w} ${y + h}H${x - w}M${x - w + h} ${y + 2 * h}L${x - w} ${y + h}`} />
      </g>
    );
  }
  const text = card.value === "draw2" ? "+2" : card.value === "wild4" ? "+4" : card.value;
  const underline = card.value === "6" || card.value === "9";
  return (
    <text
      x={x}
      y={y}
      fill={fill}
      fontSize={text.length > 1 ? size * 0.78 : size}
      fontWeight={900}
      textAnchor="middle"
      dominantBaseline="central"
      fontFamily="ui-rounded, 'Arial Rounded MT Bold', system-ui, sans-serif"
      textDecoration={underline ? "underline" : undefined}
    >
      {text}
    </text>
  );
}

/** One card face, drawn in SVG (60 × 90 units). */
export function UnoCardFace({
  card,
  className,
  title,
}: {
  card: UnoCard;
  className?: string;
  title?: string;
}) {
  const uid = useId();
  const wild = card.color === "wild";
  const base = wild ? "#1d1b26" : UNO_HEX[card.color as UnoColor];
  const gloss = `${uid}-g`;
  return (
    <svg
      viewBox="0 0 60 90"
      className={cn("block select-none", className)}
      role="img"
      aria-label={title ?? cardName(card)}
    >
      <defs>
        <linearGradient id={gloss} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.12" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="59" height="89" rx="7" fill="#fff" />
      <rect x="3" y="3" width="54" height="84" rx="5.5" fill={base} />
      <rect x="3" y="3" width="54" height="84" rx="5.5" fill={`url(#${gloss})`} />
      {wild ? (
        <>
          <circle cx="30" cy="45" r="19" fill="#fff" />
          <Wheel cx={30} cy={45} r={16.5} />
          {card.value === "wild4" && (
            <text
              x="30"
              y="45.5"
              fill="#fff"
              stroke="#1d1b26"
              strokeWidth="2.6"
              paintOrder="stroke"
              fontSize="17"
              fontWeight={900}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="ui-rounded, 'Arial Rounded MT Bold', system-ui, sans-serif"
            >
              +4
            </text>
          )}
          {card.value === "wild4" ? (
            <>
              <CardSymbol card={card} x={11} y={12} size={10} fill="#fff" />
              <g transform="rotate(180 49 78)">
                <CardSymbol card={card} x={49} y={78} size={10} fill="#fff" />
              </g>
            </>
          ) : (
            <>
              <Wheel cx={11} cy={12} r={5} />
              <Wheel cx={49} cy={78} r={5} />
            </>
          )}
        </>
      ) : (
        <>
          {/* A white diamond carries the big symbol. */}
          <rect
            x="13"
            y="28"
            width="34"
            height="34"
            rx="7"
            fill="#fff"
            transform="rotate(45 30 45)"
          />
          <CardSymbol
            card={card}
            x={30}
            y={45}
            size={24}
            fill={card.color === "yellow" ? "#d18f00" : base}
          />
          <CardSymbol card={card} x={10.5} y={12} size={11} fill="#fff" />
          <g transform="rotate(180 49.5 78)">
            <CardSymbol card={card} x={49.5} y={78} size={11} fill="#fff" />
          </g>
        </>
      )}
    </svg>
  );
}

/** The back of a card: dark with a small four-colour wheel. */
export function UnoCardBack({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 90" className={cn("block select-none", className)} aria-hidden>
      <rect x="0.5" y="0.5" width="59" height="89" rx="7" fill="#fff" />
      <rect x="3" y="3" width="54" height="84" rx="5.5" fill="#2a2540" />
      <rect
        x="7"
        y="7"
        width="46"
        height="76"
        rx="4"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.18"
        strokeWidth="1.5"
      />
      <rect x="18" y="33" width="24" height="24" rx="5" fill="#fff" transform="rotate(45 30 45)" />
      <Wheel cx={30} cy={45} r={10} />
    </svg>
  );
}
