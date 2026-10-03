"use client";

import {
  UNO_COLORS,
  type UnoCard,
  type UnoColor,
  type UnoLogEntry,
  type UnoView,
} from "@puzzle/shared/games/uno";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/game/ui";
import type { BoardProps } from "@/components/table/board-types";
import { cn } from "@/lib/utils";
import { UNO_COLOR_NAMES, UNO_HEX, UnoCardBack, UnoCardFace, cardName } from "./card";

/** Animations of this board (also switched off by the site's global reduced-motion rule). */
const STYLES = `
@keyframes uno-drop { from { opacity: 0; transform: translateY(-18px) scale(1.18) rotate(-10deg); } to { opacity: 1; transform: none; } }
@keyframes uno-deal { from { opacity: 0; transform: translateY(-26px) scale(0.9); } to { opacity: 1; transform: none; } }
@keyframes uno-pop { 0% { transform: scale(1); } 40% { transform: scale(1.3); } 100% { transform: scale(1); } }
@keyframes uno-glow { 0%, 100% { box-shadow: 0 0 0 0 rgb(242 181 27 / 0.75); } 50% { box-shadow: 0 0 0 8px rgb(242 181 27 / 0); } }
.uno-drop { animation: uno-drop 280ms cubic-bezier(.2,.9,.3,1.2) both; }
.uno-deal { animation: uno-deal 260ms ease-out both; }
.uno-pop { animation: uno-pop 320ms ease-out; }
.uno-glow { animation: uno-glow 1.2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .uno-drop, .uno-deal, .uno-pop, .uno-glow { animation: none; }
}
`;

/** The local clock, refreshed a few times a second (for the turn rings). */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/** Width of an element, kept up to date. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** A ring that empties as the turn runs out. */
function TimerRing({
  fraction,
  size,
  className,
}: {
  fraction: number;
  size: number;
  className?: string;
}) {
  const r = size / 2 - 2;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fraction));
  const color = f > 0.5 ? "#2fbf8f" : f > 0.2 ? "#f2b51b" : "#e5484d";
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("pointer-events-none -rotate-90", className)}
      aria-hidden
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgb(128 128 128 / 0.3)"
        strokeWidth="3"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - f)}
        style={{ transition: "stroke-dashoffset 200ms linear" }}
      />
    </svg>
  );
}

function logText(entry: UnoLogEntry, name: (seat: number) => string): string {
  const who = name(entry.seat);
  switch (entry.kind) {
    case "play": {
      const color = entry.color ? `, rang: ${UNO_COLOR_NAMES[entry.color]}` : "";
      const uno = entry.uno ? " va «Uno!» dedi" : "";
      return `${who} ${cardName(entry.card)} qo'ydi${color}${uno}`;
    }
    case "draw":
      return entry.count > 0 ? `${who} karta oldi` : `${who} karta ololmadi: dasta bo'sh`;
    case "penalty":
      return `${who} ${entry.count} ta karta oldi`;
    case "pass":
      return `${who} yurishni o'tkazdi`;
    case "timeout":
      return `${who} vaqtida yurmadi`;
    case "color":
      return `${who} rang tanladi: ${UNO_COLOR_NAMES[entry.color]}`;
    case "catch":
      return `${who} ${name(entry.target)}ni ushladi: «Uno!» demagan, +${entry.count}`;
    case "leave":
      return `${who} o'yindan chiqdi`;
  }
}

export default function UnoBoard({ view, game, clockOffset, move }: BoardProps<UnoView>) {
  const now = useNow();
  const [handRef, handWidth] = useWidth<HTMLDivElement>();
  const [wildFor, setWildFor] = useState<number | null>(null);
  const [unoArmedFor, setUnoArmedFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const n = view.counts.length;
  const me = view.you;
  const over = view.winner !== null || game.result !== null;
  const playing = me !== null && !view.left[me] && !over;
  const myTurn = playing && view.turn === me;
  const name = (seat: number) => game.seats[seat]?.name ?? `${seat + 1}-o'yinchi`;

  const handKey = view.hand.map((c) => c.id).join(",");
  const unoReady = playing && view.hand.length === 2;
  const armed = unoReady && unoArmedFor === handKey;
  const playable = new Set(view.playable);

  const left = view.deadline + clockOffset - now;
  const fraction = over ? 0 : left / (view.options.turnSeconds * 1000);
  const secondsLeft = Math.max(0, Math.ceil(left / 1000));

  const send = async (m: unknown) => {
    if (busy) return;
    setBusy(true);
    try {
      await move(m);
    } finally {
      setBusy(false);
    }
  };

  const playCard = (card: UnoCard) => {
    if (!myTurn || !playable.has(card.id)) return;
    if (card.color === "wild") setWildFor(card.id);
    else void send({ type: "play", card: card.id, uno: armed });
  };

  const pickerOpen = myTurn && (wildFor !== null || view.choosingColor);
  const pickColor = (color: UnoColor) => {
    if (wildFor !== null) {
      const card = wildFor;
      setWildFor(null);
      void send({ type: "play", card, color, uno: armed });
    } else void send({ type: "color", color });
  };

  const canDraw = myTurn && !view.hasDrawn && !view.choosingColor;
  const draw = () => {
    if (canDraw) void send({ type: "draw" });
  };

  // Opponents around the top of the table, in play order starting after the viewer.
  const others =
    me !== null
      ? Array.from({ length: n - 1 }, (_, k) => (me + k + 1) % n)
      : Array.from({ length: n }, (_, k) => k);
  const unoSaid = new Set(view.unoSaid);
  const catchable = new Set(view.catchable);

  // The hand: an overlapping fan that fits the width, scrolling only when it must.
  const wide = handWidth >= 520;
  const cardW = wide ? 76 : 60;
  const cardH = cardW * 1.5;
  const count = view.hand.length;
  const avail = handWidth || 360;
  const step =
    count > 1 ? Math.max(wide ? 26 : 22, Math.min(cardW + 6, (avail - cardW) / (count - 1))) : 0;
  const fanWidth = cardW + step * Math.max(0, count - 1);
  const offset = Math.max(0, (avail - fanWidth) / 2);

  const turnName = name(view.turn);
  let status: string;
  if (over) status = "O'yin tugadi";
  else if (myTurn) {
    if (view.choosingColor) status = "Birinchi karta joker: rangni tanlang";
    else if (view.pendingDraw > 0)
      status = `${view.pendingType === "wild4" ? "+4" : "+2"} qo'ying yoki ${view.pendingDraw} ta karta oling`;
    else if (view.hasDrawn) status = "Olingan kartani qo'ying yoki o'tkazing";
    else status = "Sizning navbatingiz";
  } else if (view.choosingColor) status = `${turnName} rang tanlayapti`;
  else status = `${turnName} navbati`;

  const recent = view.log.slice(-2);
  const colorHex = view.color ? UNO_HEX[view.color] : "#ffffff";

  return (
    <div className="flex flex-col gap-2">
      <style>{STYLES}</style>

      {/* The table */}
      <div className="table-felt relative aspect-[10/8] w-full overflow-hidden rounded-[44%/40%] shadow-soft-md ring-4 ring-[#1d3f36] sm:aspect-[16/10]">
        {others.map((seat, i) => {
          const k = others.length;
          const angle = Math.PI - ((i + 1) * Math.PI) / (k + 1);
          const x = 50 + 41 * Math.cos(angle);
          const y = 55 - 42 * Math.sin(angle);
          const info = game.seats[seat];
          const cards = view.counts[seat] ?? 0;
          const active = !over && view.turn === seat;
          const gone = view.left[seat];
          return (
            <div
              key={seat}
              className="absolute flex w-[68px] -translate-x-1/2 -translate-y-1/2 flex-col items-center sm:w-[84px]"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <div className="relative flex size-10 items-center justify-center">
                {active && <TimerRing fraction={fraction} size={40} className="absolute inset-0" />}
                <Avatar
                  name={info?.name ?? ""}
                  color={info?.color ?? "#888"}
                  avatar={info?.avatar ?? "🙂"}
                  size="sm"
                  dimmed={gone}
                />
                {unoSaid.has(seat) && (
                  <span className="uno-pop absolute -top-2 -right-6 rounded-full bg-[#f2b51b] px-1.5 py-0.5 text-[10px] font-black text-[#1d1b26] shadow-soft-sm">
                    Uno!
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "mt-0.5 max-w-full truncate rounded-full px-1.5 text-[11px] font-semibold text-white",
                  active && "bg-white/25",
                )}
              >
                {info?.name}
              </span>
              {gone ? (
                <span className="text-[10px] text-white/70">chiqdi</span>
              ) : (
                <div className="relative mt-0.5 flex h-7 items-end">
                  {Array.from({ length: Math.min(cards, 6) }, (_, c) => (
                    <UnoCardBack key={c} className="-ml-3 h-7 w-auto first:ml-0" />
                  ))}
                  <span
                    key={cards}
                    className="uno-pop absolute -right-3 -bottom-1 min-w-5 rounded-full bg-white px-1 text-center text-[11px] font-bold text-[#1d1b26] shadow-soft-sm"
                  >
                    {cards}
                    <span className="sr-only"> ta karta</span>
                  </span>
                </div>
              )}
              {playing && catchable.has(seat) && (
                <button
                  type="button"
                  onClick={() => void send({ type: "catch", seat })}
                  className="uno-glow mt-1 min-h-8 rounded-full bg-danger px-3 text-xs font-bold text-white"
                >
                  Ushla!
                </button>
              )}
            </div>
          );
        })}

        {/* Direction of play: clockwise on screen goes from you (bottom) to the left, over the top. */}
        <svg
          viewBox="0 0 200 120"
          className="pointer-events-none absolute top-[58%] left-1/2 w-[62%] opacity-25 transition-transform duration-500"
          style={{
            transform: `translate(-50%, -50%) scaleX(${view.direction === 1 ? 1 : -1})`,
          }}
          aria-hidden
        >
          <defs>
            <marker
              id="uno-arrow"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="4"
              markerHeight="4"
              orient="auto"
            >
              <path d="M0 0L10 5L0 10Z" fill="#fff" />
            </marker>
          </defs>
          <path
            d="M70 108A92 52 0 0 1 20 40"
            fill="none"
            stroke="#fff"
            strokeWidth="3"
            markerEnd="url(#uno-arrow)"
          />
          <path
            d="M130 12A92 52 0 0 1 180 80"
            fill="none"
            stroke="#fff"
            strokeWidth="3"
            markerEnd="url(#uno-arrow)"
          />
        </svg>
        <span className="sr-only">
          {view.direction === 1 ? "O'yin soat yo'nalishida" : "O'yin teskari yo'nalishda"}
        </span>

        {/* Draw pile and discard pile */}
        <div className="absolute top-[58%] left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-start gap-4 sm:gap-6">
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={draw}
              disabled={!canDraw || busy}
              aria-label={`Karta olish, dastada ${view.deckCount} ta`}
              className={cn(
                "relative h-[78px] w-[52px] rounded-[7px] sm:h-[114px] sm:w-[76px]",
                canDraw && "uno-glow cursor-pointer",
              )}
            >
              {view.deckCount > 1 && (
                <UnoCardBack className="absolute top-1 left-1 h-full w-full opacity-70" />
              )}
              {view.deckCount > 0 ? (
                <UnoCardBack className="absolute inset-0 h-full w-full drop-shadow-md" />
              ) : (
                <span className="absolute inset-0 rounded-[7px] border-2 border-dashed border-white/30" />
              )}
            </button>
            <span className="text-[11px] font-semibold text-white/80">{view.deckCount} ta</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div
              className="relative rounded-[9px] transition-shadow duration-300"
              style={{ boxShadow: `0 0 0 3px ${colorHex}, 0 0 22px ${colorHex}` }}
            >
              <UnoCardFace
                key={view.top.id}
                card={view.top}
                className="uno-drop h-[96px] w-[64px] drop-shadow-lg sm:h-[132px] sm:w-[88px]"
              />
              {view.pendingDraw > 0 && (
                <span
                  key={view.pendingDraw}
                  className="uno-pop absolute -top-3 -right-3 rounded-full bg-danger px-2 py-0.5 text-sm font-black text-white shadow-soft-md"
                >
                  +{view.pendingDraw}
                </span>
              )}
            </div>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-white/90">
              <span
                className="size-2.5 rounded-full ring-1 ring-white/70"
                style={{ backgroundColor: colorHex }}
              />
              {view.color ? `Rang: ${UNO_COLOR_NAMES[view.color]}` : "Rang tanlanmoqda"}
            </span>
          </div>
        </div>

        {/* The last actions */}
        <ol
          aria-live="polite"
          className="absolute inset-x-[14%] bottom-[5%] flex flex-col items-center text-center text-[11px] leading-tight text-white/75 sm:text-xs"
        >
          {recent.map((entry, i) => (
            <li
              key={entry.n}
              className={cn("max-w-full truncate", i === recent.length - 1 && "text-white")}
            >
              {logText(entry, name)}
            </li>
          ))}
        </ol>
      </div>

      {/* Status, actions and the hand */}
      <div
        className={cn(
          "rounded-card border border-border bg-surface p-3 shadow-soft-sm transition-colors",
          myTurn && "border-primary bg-primary-soft",
        )}
      >
        <div className="flex items-center gap-2">
          {myTurn && (
            <div className="relative flex size-10 shrink-0 items-center justify-center">
              <TimerRing fraction={fraction} size={40} className="absolute inset-0" />
              <span className="text-sm font-bold tabular-nums">{secondsLeft}</span>
            </div>
          )}
          <p className="min-w-0 flex-1 text-sm font-semibold">
            {me === null ? "Siz tomoshabinsiz" : status}
          </p>
          {playing && (
            <>
              {myTurn && view.hasDrawn ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void send({ type: "pass" })}
                  className="min-h-10 rounded-control border border-border bg-surface px-3 text-sm font-semibold hover:bg-surface-muted"
                >
                  O&apos;tkazish
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!canDraw || busy}
                  onClick={draw}
                  className="min-h-10 rounded-control border border-border bg-surface px-3 text-sm font-semibold hover:bg-surface-muted disabled:opacity-40"
                >
                  {view.pendingDraw > 0 && myTurn ? `+${view.pendingDraw} olish` : "Karta olish"}
                </button>
              )}
              <button
                type="button"
                disabled={!unoReady}
                aria-pressed={armed}
                onClick={() => setUnoArmedFor(armed ? null : handKey)}
                className={cn(
                  "min-h-10 rounded-control px-3 text-sm font-black transition-colors",
                  armed
                    ? "bg-[#f2b51b] text-[#1d1b26] shadow-soft-md"
                    : unoReady
                      ? "uno-glow bg-[#e5484d] text-white"
                      : "bg-surface-muted text-muted",
                )}
              >
                {armed ? "Uno! ✓" : "Uno!"}
              </button>
            </>
          )}
        </div>
        {me !== null && catchable.has(me) && (
          <p className="mt-2 text-xs font-medium text-danger">
            «Uno!» demadingiz: boshqalar sizni ushlab qolishi mumkin.
          </p>
        )}
        {armed && (
          <p className="mt-2 text-xs text-muted">
            Kartani qo&apos;yganingizda «Uno!» deb aytiladi.
          </p>
        )}

        {me !== null && (
          <div ref={handRef} className="mt-1 overflow-x-auto overflow-y-hidden">
            <div
              className="relative"
              style={{ height: cardH + 18, width: Math.max(avail, fanWidth) }}
            >
              {handWidth > 0 &&
                view.hand.map((card, i) => {
                  const can = myTurn && playable.has(card.id);
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => playCard(card)}
                      aria-label={`${cardName(card)}${can ? ", qo'yish mumkin" : ""}`}
                      aria-disabled={!can}
                      className={cn(
                        "uno-deal absolute top-[14px] rounded-[7px] transition-[translate,filter,opacity] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                        can && "-translate-y-3 cursor-pointer hover:-translate-y-4",
                        myTurn && !can && "opacity-55 brightness-75",
                        view.drawnCard === card.id && "ring-4 ring-[#f2b51b]",
                      )}
                      style={{ left: offset + i * step, width: cardW, zIndex: i }}
                    >
                      <UnoCardFace card={card} className="h-auto w-full drop-shadow-md" />
                    </button>
                  );
                })}
              {count === 0 && !over && (
                <p className="absolute inset-0 flex items-center justify-center text-sm text-muted">
                  Kartalar yo&apos;q
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Colour picker */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setWildFor(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="uno-color-title"
            className="mafia-enter w-full max-w-sm rounded-card bg-surface p-5 shadow-soft-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="uno-color-title" className="font-display text-xl font-bold">
              Rangni tanlang
            </h2>
            <p className="mt-1 text-sm text-muted">
              Keyingi o&apos;yinchi shu rangdagi kartani qo&apos;yishi kerak.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {UNO_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  disabled={busy}
                  onClick={() => pickColor(color)}
                  className="flex h-16 items-center justify-center rounded-control text-lg font-bold text-white capitalize shadow-soft-sm transition-transform hover:scale-[1.03]"
                  style={{ backgroundColor: UNO_HEX[color] }}
                >
                  {UNO_COLOR_NAMES[color]}
                </button>
              ))}
            </div>
            {wildFor !== null && (
              <button
                type="button"
                onClick={() => setWildFor(null)}
                className="mt-3 w-full rounded-control border border-border px-4 py-3 font-medium"
              >
                Bekor qilish
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
