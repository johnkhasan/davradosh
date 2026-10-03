"use client";

import type { ChessView, PromotionPiece } from "@puzzle/shared/games/chess";
import type { TableSeatDTO } from "@puzzle/shared/games";
import { Handshake } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { Avatar } from "@/components/game/ui";
import type { BoardProps } from "@/components/table/board-types";
import { cn } from "@/lib/utils";
import { ChessPiece, DARK_SQUARE, HIGHLIGHT, LIGHT_SQUARE, parsePlacement } from "./pieces";

const FILES = "abcdefgh";
const PIECE_NAMES: Record<string, string> = {
  p: "piyoda",
  n: "ot",
  b: "fil",
  r: "rux",
  q: "farzin",
  k: "shoh",
};
const PROMOTIONS: PromotionPiece[] = ["q", "r", "b", "n"];
const CAPTURE_ORDER = "pnbrq";
const SELECTED = "rgb(108 92 231 / 0.5)";
const DOT = "rgb(28 20 36 / 0.26)";
const CHECK =
  "radial-gradient(circle, rgb(229 72 77 / 0.95) 0%, rgb(229 72 77 / 0.55) 40%, rgb(229 72 77 / 0) 72%)";

/** Drag starts after the pointer travelled this far (px), so taps stay taps. */
const DRAG_THRESHOLD = 6;

interface Pending {
  fen: string;
  from: string;
  to: string;
  promotion?: PromotionPiece;
}

interface Drag {
  from: string;
  pointerId: number;
  startX: number;
  startY: number;
  /** Pointer position in % of the board. */
  x: number;
  y: number;
  moved: boolean;
  wasSelected: boolean;
}

function squareName(row: number, col: number, flipped: boolean): string {
  const file = flipped ? 7 - col : col;
  const rank = flipped ? row + 1 : 8 - row;
  return `${FILES[file]}${rank}`;
}

function pieceAt(board: (string | null)[][], square: string): string | null {
  const file = FILES.indexOf(square[0]!);
  const rank = Number(square[1]);
  return board[8 - rank]?.[file] ?? null;
}

/** The position after our own move, shown until the server confirms it (castling/en passant
 * extras appear a moment later). */
function applyPending(board: (string | null)[][], pending: Pending) {
  const next = board.map((row) => [...row]);
  const piece = pieceAt(board, pending.from);
  const set = (square: string, value: string | null) => {
    next[8 - Number(square[1])]![FILES.indexOf(square[0]!)] = value;
  };
  set(pending.from, null);
  if (piece && pending.promotion) {
    const letter = pending.promotion;
    set(pending.to, piece === piece.toUpperCase() ? letter.toUpperCase() : letter);
  } else set(pending.to, piece);
  return next;
}

export default function Board({ view, game, clockOffset, move }: BoardProps<ChessView>) {
  const mySeat = game.yourSeat;
  const playing = mySeat !== null && !game.result && !game.seats[mySeat]?.left;
  const flipped = mySeat === 1;
  const boardRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<{ fen: string; square: string } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [promotion, setPromotion] = useState<{ fen: string; from: string; to: string } | null>(
    null,
  );
  const [drag, setDrag] = useState<Drag | null>(null);

  const livePending = pending && pending.fen === view.fen ? pending : null;
  const canMove = playing && view.turn === mySeat && !livePending && !view.result;
  const legal = canMove ? view.legal : {};
  const selected =
    selection && selection.fen === view.fen && legal[selection.square] ? selection.square : null;
  const targets = selected ? (legal[selected] ?? []) : [];
  const promo = promotion && promotion.fen === view.fen ? promotion : null;

  const parsed = parsePlacement(view.fen);
  const board = livePending ? applyPending(parsed, livePending) : parsed;
  const lastMove = livePending ? { from: livePending.from, to: livePending.to } : view.lastMove;
  const check = livePending ? null : view.check;

  const send = (from: string, to: string, piece?: PromotionPiece) => {
    const fen = view.fen;
    setSelection(null);
    setPromotion(null);
    setPending({ fen, from, to, promotion: piece });
    void move({ type: "move", from, to, promotion: piece }).then((result) => {
      if (!result.ok) setPending(null);
    });
  };

  const tryMove = (from: string, to: string) => {
    if (!legal[from]?.includes(to)) return false;
    const piece = pieceAt(board, from);
    const lastRank = to[1] === "8" || to[1] === "1";
    if (piece?.toLowerCase() === "p" && lastRank) {
      setSelection(null);
      setPromotion({ fen: view.fen, from, to });
    } else send(from, to);
    return true;
  };

  const squareFromPoint = (clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const col = Math.floor(((clientX - rect.left) / rect.width) * 8);
    const row = Math.floor(((clientY - rect.top) / rect.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    return squareName(row, col, flipped);
  };

  const percent = (clientX: number, clientY: number) => {
    const rect = boardRef.current!.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  };

  /** Shared by taps and keyboard: select a piece, or move the selected one. */
  const pick = (square: string) => {
    if (selected && square !== selected && tryMove(selected, square)) return;
    if (legal[square]) setSelection(square === selected ? null : { fen: view.fen, square });
    else setSelection(null);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!canMove || promo || (e.pointerType === "mouse" && e.button !== 0)) return;
    const square = squareFromPoint(e.clientX, e.clientY);
    if (!square) return;
    e.preventDefault();
    if (selected && square !== selected && tryMove(selected, square)) return;
    if (!legal[square]) {
      setSelection(null);
      return;
    }
    const wasSelected = square === selected;
    setSelection({ fen: view.fen, square });
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({
      from: square,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      ...percent(e.clientX, e.clientY),
      moved: false,
      wasSelected,
    });
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const moved =
      drag.moved || Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > DRAG_THRESHOLD;
    setDrag({ ...drag, ...percent(e.clientX, e.clientY), moved });
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    setDrag(null);
    const square = squareFromPoint(e.clientX, e.clientY);
    if (drag.moved) {
      if (square && square !== drag.from && tryMove(drag.from, square)) return;
      // Dropped back or somewhere illegal: keep the piece selected for a tap-move.
      return;
    }
    if (drag.wasSelected && square === drag.from) setSelection(null);
  };

  const onPointerCancel = () => setDrag(null);

  // Keyboard users: Enter/Space on a square (pointer users never reach onClick with detail 0).
  const onSquareClick = (e: MouseEvent<HTMLButtonElement>, square: string) => {
    if (e.detail === 0 && canMove && !promo) pick(square);
  };
  const onBoardKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") setSelection(null);
  };

  const topSeat = flipped ? 0 : 1;
  const bottomSeat = flipped ? 1 : 0;
  const dragging = drag?.moved ? drag : null;
  const dragPiece = dragging ? pieceAt(board, dragging.from) : null;
  const hoverSquare = dragging ? squareAtPercent(dragging.x, dragging.y, flipped) : null;

  const squares = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = squareName(row, col, flipped);
      const piece = pieceAt(board, square);
      const light = (row + col) % 2 === 0;
      const target = targets.includes(square);
      const highlight =
        square === selected
          ? SELECTED
          : lastMove && (square === lastMove.from || square === lastMove.to)
            ? HIGHLIGHT
            : null;
      const coordColor = light ? DARK_SQUARE : LIGHT_SQUARE;
      squares.push(
        <button
          key={square}
          type="button"
          tabIndex={canMove ? 0 : -1}
          aria-label={`${square}${piece ? `, ${piece === piece.toUpperCase() ? "oq" : "qora"} ${PIECE_NAMES[piece.toLowerCase()]}` : ""}`}
          onClick={(e) => onSquareClick(e, square)}
          className="relative block size-full cursor-default outline-none focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-primary focus-visible:ring-inset"
          style={{ backgroundColor: light ? LIGHT_SQUARE : DARK_SQUARE }}
        >
          {highlight && (
            <span className="absolute inset-0" style={{ backgroundColor: highlight }} />
          )}
          {square === check && <span className="absolute inset-0" style={{ background: CHECK }} />}
          {hoverSquare === square && target && (
            <span className="absolute inset-0 shadow-[inset_0_0_0_3px_rgb(255_255_255/0.75)]" />
          )}
          {col === 0 && (
            <span
              className="absolute top-0.5 left-0.5 text-[9px] leading-none font-bold sm:text-[11px]"
              style={{ color: coordColor }}
            >
              {square[1]}
            </span>
          )}
          {row === 7 && (
            <span
              className="absolute right-0.5 bottom-0.5 text-[9px] leading-none font-bold sm:text-[11px]"
              style={{ color: coordColor }}
            >
              {square[0]}
            </span>
          )}
          {piece && (
            <ChessPiece
              piece={piece}
              className={cn(
                "pointer-events-none relative size-full",
                legal[square] && "cursor-grab",
                dragging?.from === square && "opacity-30",
              )}
            />
          )}
          {target &&
            (piece ? (
              <span
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(circle, transparent 0 62%, ${DOT} 64% 100%)`,
                }}
              />
            ) : (
              <span
                className="absolute top-1/2 left-1/2 size-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ backgroundColor: DOT }}
              />
            ))}
        </button>,
      );
    }
  }

  return (
    <div className="flex w-full flex-col gap-3 md:flex-row md:items-start md:justify-center">
      <div
        className="mx-auto flex w-full min-w-0 flex-col gap-2 md:mx-0"
        style={{ maxWidth: "min(600px, max(288px, calc(100dvh - 15rem)))" }}
      >
        <PlayerBar
          seat={topSeat}
          info={game.seats[topSeat]}
          view={view}
          clockOffset={clockOffset}
          you={mySeat === topSeat}
        />
        <div
          ref={boardRef}
          role="grid"
          aria-label="Shaxmat taxtasi"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onKeyDown={onBoardKey}
          className={cn(
            "relative grid aspect-square w-full touch-none grid-cols-8 grid-rows-8 overflow-hidden rounded-[10px] shadow-soft-md select-none",
            dragging && "cursor-grabbing",
          )}
        >
          {squares}
          {dragging && dragPiece && (
            <ChessPiece
              piece={dragPiece}
              className="pointer-events-none absolute z-20 size-[12.5%] scale-125 drop-shadow-lg"
              style={{ left: `${dragging.x - 6.25}%`, top: `${dragging.y - 6.25}%` }}
            />
          )}
          {promo && mySeat !== null && (
            <div
              className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 p-4"
              onPointerDown={(e) => {
                e.stopPropagation();
                if (e.target === e.currentTarget) setPromotion(null);
              }}
            >
              <div
                role="dialog"
                aria-label="Piyoda nimaga aylansin"
                className="rounded-card bg-surface p-3 shadow-soft-lg"
              >
                <p className="mb-2 text-center text-sm font-semibold">Qaysi dona bo&apos;lsin?</p>
                <div className="flex gap-2">
                  {PROMOTIONS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      aria-label={PIECE_NAMES[p]}
                      onClick={() => send(promo.from, promo.to, p)}
                      className="size-14 rounded-control bg-surface-muted p-1 hover:bg-primary-soft sm:size-16"
                    >
                      <ChessPiece
                        piece={mySeat === 0 ? p.toUpperCase() : p}
                        className="size-full"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        <PlayerBar
          seat={bottomSeat}
          info={game.seats[bottomSeat]}
          view={view}
          clockOffset={clockOffset}
          you={mySeat === bottomSeat}
        />
      </div>

      <aside className="flex w-full min-w-0 flex-col gap-2 md:w-52 md:shrink-0">
        <Status view={view} mySeat={playing ? mySeat : null} pending={Boolean(livePending)} />
        {playing && mySeat !== null && <DrawControls view={view} mySeat={mySeat} move={move} />}
        <MoveList san={view.san} />
      </aside>
    </div>
  );
}

function squareAtPercent(x: number, y: number, flipped: boolean): string | null {
  const col = Math.floor(x / 12.5);
  const row = Math.floor(y / 12.5);
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  return squareName(row, col, flipped);
}

// ------------------------------------------------------------------ players and clocks

function PlayerBar({
  seat,
  info,
  view,
  clockOffset,
  you,
}: {
  seat: number;
  info: TableSeatDTO | undefined;
  view: ChessView;
  clockOffset: number;
  you: boolean;
}) {
  const taken = [...(seat === 0 ? view.captured.white : view.captured.black)].sort(
    (a, b) => CAPTURE_ORDER.indexOf(a.toLowerCase()) - CAPTURE_ORDER.indexOf(b.toLowerCase()),
  );
  const advantage = seat === 0 ? view.material : -view.material;
  const active = !view.result && view.turn === seat;
  return (
    <div className="flex min-h-11 items-center gap-2">
      {info && (
        <Avatar
          name={info.name}
          color={info.color}
          avatar={info.avatar}
          size="sm"
          dimmed={!info.connected || info.left}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <span
            aria-hidden
            className={cn(
              "size-3 shrink-0 rounded-full border border-foreground/40",
              seat === 0 ? "bg-[#fffaf0]" : "bg-[#33293f]",
            )}
          />
          <span className="truncate">
            {info?.name ?? (seat === 0 ? "Oqlar" : "Qoralar")}
            {you && <span className="font-normal text-muted"> (siz)</span>}
          </span>
          {active && (
            <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Navbat" />
          )}
        </div>
        <div className="flex h-4 items-center">
          {taken.map((p, i) => (
            <ChessPiece
              key={`${p}-${i}`}
              piece={p}
              className={cn(
                "size-4 shrink-0",
                i > 0 && taken[i - 1] === p ? "-ml-2.5" : i > 0 && "-ml-0.5",
              )}
            />
          ))}
          {advantage > 0 && (
            <span className="ml-1 text-xs font-semibold text-muted">+{advantage}</span>
          )}
        </div>
      </div>
      {view.clock && (
        <Clock
          ms={view.clock.remaining[seat]!}
          running={view.clock.running === seat}
          turnStartedAt={view.clock.turnStartedAt}
          clockOffset={clockOffset}
        />
      )}
    </div>
  );
}

function useNow(active: boolean, interval: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, interval);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [active, interval]);
  return now;
}

function formatClock(ms: number): string {
  const clamped = Math.max(0, ms);
  if (clamped < 10_000) {
    const tenths = Math.floor(clamped / 100);
    return `0:0${Math.floor(tenths / 10)}.${tenths % 10}`;
  }
  const total = Math.ceil(clamped / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function Clock({
  ms,
  running,
  turnStartedAt,
  clockOffset,
}: {
  ms: number;
  running: boolean;
  turnStartedAt: number;
  clockOffset: number;
}) {
  const now = useNow(running, 100);
  const elapsed = running ? Math.max(0, now - (turnStartedAt + clockOffset)) : 0;
  const left = Math.max(0, ms - elapsed);
  const low = left < 20_000;
  return (
    <div
      role="timer"
      aria-label={running ? "Yurish vaqti" : "Qolgan vaqt"}
      className={cn(
        "min-w-[5.5rem] rounded-control px-3 py-1.5 text-right font-mono text-xl font-bold tabular-nums transition-colors",
        running
          ? low
            ? "bg-danger text-white"
            : "bg-foreground text-background"
          : "bg-surface-muted text-muted",
      )}
    >
      {formatClock(left)}
    </div>
  );
}

// ------------------------------------------------------------------ side panel

function Status({
  view,
  mySeat,
  pending,
}: {
  view: ChessView;
  mySeat: number | null;
  pending: boolean;
}) {
  if (view.result) return null;
  const mine = mySeat !== null && view.turn === mySeat && !pending;
  const text =
    mySeat === null
      ? view.turn === 0
        ? "Oqlar yuradi"
        : "Qoralar yuradi"
      : mine
        ? "Sizning navbatingiz"
        : "Raqib o'ylamoqda…";
  return (
    <p
      className={cn(
        "rounded-control px-3 py-2 text-center text-sm font-semibold",
        mine ? "bg-primary text-primary-foreground" : "bg-surface-muted text-muted",
      )}
    >
      {text}
      {view.check && " · Shoh!"}
    </p>
  );
}

function DrawControls({
  view,
  mySeat,
  move,
}: {
  view: ChessView;
  mySeat: number;
  move: BoardProps["move"];
}) {
  if (view.drawOffer !== null && view.drawOffer !== mySeat) {
    return (
      <div className="rounded-card border border-primary/40 bg-primary-soft p-3 text-sm">
        <p className="flex items-center gap-1.5 font-semibold">
          <Handshake className="size-4" aria-hidden /> Raqib durang taklif qilmoqda
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => void move({ type: "accept-draw" })}
            className="min-h-10 flex-1 rounded-control bg-primary px-3 font-semibold text-primary-foreground"
          >
            Qabul qilish
          </button>
          <button
            type="button"
            onClick={() => void move({ type: "decline-draw" })}
            className="min-h-10 flex-1 rounded-control border border-border bg-surface px-3 font-medium"
          >
            Rad etish
          </button>
        </div>
      </div>
    );
  }
  if (view.drawOffer === mySeat) {
    return (
      <p className="rounded-control border border-dashed border-border px-3 py-2 text-center text-sm text-muted">
        Durang taklifi yuborildi
      </p>
    );
  }
  return (
    <button
      type="button"
      disabled={!view.canOfferDraw}
      onClick={() => void move({ type: "offer-draw" })}
      className="flex min-h-10 items-center justify-center gap-1.5 rounded-control border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-muted disabled:opacity-50"
    >
      <Handshake className="size-4" aria-hidden /> Durang taklif qilish
    </button>
  );
}

function MoveList({ san }: { san: string[] }) {
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
    el.scrollTop = el.scrollHeight;
  }, [san.length]);

  const pairs: [string, string | undefined][] = [];
  for (let i = 0; i < san.length; i += 2) pairs.push([san[i]!, san[i + 1]]);

  return (
    <section
      aria-label="Yurishlar"
      className="rounded-card border border-border bg-surface md:flex md:max-h-[min(28rem,calc(100dvh-20rem))] md:min-h-40 md:flex-col"
    >
      <h2 className="hidden px-3 pt-2 text-xs font-semibold tracking-wide text-muted uppercase md:block">
        Yurishlar
      </h2>
      {pairs.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted">Hali yurish qilinmadi</p>
      ) : (
        <ol
          ref={listRef}
          className="flex gap-3 overflow-x-auto px-3 py-2 text-sm whitespace-nowrap md:flex-1 md:flex-col md:gap-0 md:overflow-x-hidden md:overflow-y-auto"
        >
          {pairs.map(([white, black], i) => {
            const last = i === pairs.length - 1;
            return (
              <li key={i} className="flex shrink-0 gap-1.5 md:py-0.5">
                <span className="w-6 text-right text-muted tabular-nums">{i + 1}.</span>
                <span
                  className={cn(
                    "md:w-16",
                    last && black === undefined && "rounded bg-primary-soft px-1 font-semibold",
                  )}
                >
                  {white}
                </span>
                {black !== undefined && (
                  <span className={cn(last && "rounded bg-primary-soft px-1 font-semibold")}>
                    {black}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
