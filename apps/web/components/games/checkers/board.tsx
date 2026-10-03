"use client";

import type { CheckersView, CheckersViewPiece } from "@puzzle/shared/games/checkers";
import { Handshake, Timer } from "lucide-react";
import { useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useCountdown } from "@/components/mafia/use-countdown";
import type { BoardProps } from "@/components/table/board-types";
import { cn } from "@/lib/utils";
import { BoardFrame, PieceArt, PieceDefs, cellStyle, displayCell, squareAt } from "./board-art";

const FILES = "abcdefgh";
const squareName = (square: number) => `${FILES[square % 8]}${Math.floor(square / 8) + 1}`;
const SIDE = ["Oqlar", "Qoralar"] as const;
/** Pointer travel (px) that turns a press into a drag. */
const DRAG_THRESHOLD = 6;

interface Drag {
  pointerId: number;
  from: number;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  moved: boolean;
}

export default function CheckersBoard({ view, game, clockOffset, move }: BoardProps<CheckersView>) {
  const prefix = `ck${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const boardRef = useRef<HTMLDivElement>(null);
  const me = view.seat;
  const flipped = me === 1;
  const over = Boolean(game.result ?? view.result);
  const myTurn = me !== null && view.turn === me && !over;

  // A key of the position: selections and optimistic moves live only as long as it does
  // (a chat message re-sends the view without changing it).
  const positionKey = `${view.turn}|${view.continuing}|${view.pieces
    .map((p) => `${p.id}:${p.square}:${p.king ? 1 : 0}`)
    .join(",")}`;

  const [selection, setSelection] = useState<{ square: number; key: string } | null>(null);
  const [pending, setPending] = useState<{ id: number; to: number; key: string } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  const legal = myTurn ? view.legal : [];
  const movable = new Set(legal.map((s) => s.from));
  const waiting = pending?.key === positionKey;
  const selected =
    view.continuing !== null && myTurn
      ? view.continuing
      : selection?.key === positionKey && movable.has(selection.square)
        ? selection.square
        : null;
  const activeFrom = drag ? drag.from : selected;
  const targets = activeFrom === null || waiting ? [] : legal.filter((s) => s.from === activeFrom);
  const bySquare = new Map(view.pieces.map((p) => [p.square, p]));

  const send = (from: number, to: number) => {
    const piece = bySquare.get(from);
    if (!piece) return;
    setPending({ id: piece.id, to, key: positionKey });
    setSelection(null);
    void move({ type: "step", from, to }).then((result) => {
      if (!result.ok) setPending(null);
    });
  };

  /** A tap (or keyboard press) on a square. */
  const tap = (square: number) => {
    if (!myTurn || waiting) return;
    if (activeFrom !== null && targets.some((t) => t.to === square)) {
      send(activeFrom, square);
      return;
    }
    if (movable.has(square)) {
      setSelection(selected === square ? null : { square, key: positionKey });
      return;
    }
    setSelection(null);
  };

  const squareFromPoint = (clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = Math.floor(((clientX - rect.left) / rect.width) * 8);
    const y = Math.floor(((clientY - rect.top) / rect.height) * 8);
    if (x < 0 || x > 7 || y < 0 || y > 7) return null;
    return squareAt(x, y, flipped);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !myTurn || waiting) return;
    const square = squareFromPoint(e.clientX, e.clientY);
    if (square === null) return;
    if (!movable.has(square)) {
      tap(square);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({
      pointerId: e.pointerId,
      from: square,
      startX: e.clientX,
      startY: e.clientY,
      dx: 0,
      dy: 0,
      moved: false,
    });
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setDrag({ ...drag, dx, dy, moved: drag.moved || Math.hypot(dx, dy) > DRAG_THRESHOLD });
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    setDrag(null);
    if (!drag.moved) {
      tap(drag.from);
      return;
    }
    const square = squareFromPoint(e.clientX, e.clientY);
    if (square !== null && legal.some((s) => s.from === drag.from && s.to === square)) {
      send(drag.from, square);
    } else {
      setSelection({ square: drag.from, key: positionKey });
    }
  };

  const lastPath = new Set(view.lastMove?.path ?? []);
  const lastCaptured = view.continuing === null ? (view.lastMove?.captured ?? []) : [];
  const capturing = new Set(view.capturing);
  const forced = myTurn && view.mustCapture && !waiting ? movable : new Set<number>();

  const bottomSeat = me ?? 0;
  const topSeat = bottomSeat === 0 ? 1 : 0;
  const seconds = useCountdown(over ? null : view.deadline, clockOffset);

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col gap-2">
      <PlayerBar
        seat={topSeat}
        name={game.seats[topSeat]?.name ?? SIDE[topSeat]}
        count={view.counts[topSeat]}
        taken={12 - view.counts[bottomSeat]}
        turn={!over && view.turn === topSeat}
        seconds={view.turn === topSeat ? seconds : null}
        prefix={prefix}
      />

      <BoardFrame flipped={flipped}>
        <PieceDefs prefix={prefix} />
        <div
          ref={boardRef}
          className={cn("absolute inset-0 touch-none select-none", myTurn && "cursor-pointer")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDrag(null)}
        >
          {/* Dark squares: last move, selection, captures and hint dots. */}
          {Array.from({ length: 64 }, (_, square) => {
            const { x, y } = displayCell(square, flipped);
            if ((x + y) % 2 === 0) return null;
            const target = targets.find((t) => t.to === square);
            const piece = bySquare.get(square);
            return (
              <button
                key={square}
                type="button"
                tabIndex={myTurn && (movable.has(square) || target) ? 0 : -1}
                aria-label={squareLabel(square, piece, Boolean(target))}
                // Pointer presses are handled by the board; this is for the keyboard.
                onClick={(e) => {
                  if (e.detail === 0) tap(square);
                }}
                className="absolute top-0 left-0 flex items-center justify-center outline-none focus-visible:ring-3 focus-visible:ring-[#ffd166] focus-visible:ring-inset"
                style={cellStyle(x, y)}
              >
                {lastPath.has(square) && <span className="absolute inset-0 bg-[#ffd166]/25" />}
                {selected === square && (
                  <span className="absolute inset-0 bg-[#ffd166]/40 ring-2 ring-[#ffd166] ring-inset" />
                )}
                {lastCaptured.includes(square) && (
                  <span className="absolute text-[min(6vw,30px)] leading-none font-bold text-[#ff9b8a]/75">
                    ×
                  </span>
                )}
                {target &&
                  (target.capture ? (
                    <span className="absolute inset-[14%] rounded-full border-[min(1.1vw,6px)] border-[#ffd166]/90" />
                  ) : (
                    <span className="absolute size-[30%] rounded-full bg-[#f6e7c3]/75 shadow-[0_0_0_2px_rgba(0,0,0,0.15)]" />
                  ))}
              </button>
            );
          })}

          {view.pieces.map((piece) => {
            const dragging = drag?.moved === true && drag.from === piece.square;
            const square = waiting && pending?.id === piece.id ? pending.to : piece.square;
            const { x, y } = displayCell(square, flipped);
            const offset = dragging
              ? `translate(${drag.dx}px, ${drag.dy}px) scale(1.12)`
              : undefined;
            const taken = capturing.has(piece.square);
            return (
              <div
                key={piece.id}
                className={cn(
                  "pointer-events-none absolute top-0 left-0 flex items-center justify-center",
                  dragging
                    ? "z-20"
                    : "z-10 transition-transform duration-300 ease-out motion-reduce:transition-none",
                )}
                style={cellStyle(x, y, offset)}
              >
                <div
                  className={cn(
                    "relative size-[86%] rounded-full",
                    taken && "opacity-45",
                    forced.has(piece.square) &&
                      "shadow-[0_0_0_3px_#ffb703,0_0_14px_3px_rgba(255,183,3,0.7)] motion-safe:animate-pulse",
                    view.continuing === piece.square &&
                      "shadow-[0_0_0_3px_#ffd166,0_0_16px_4px_rgba(255,209,102,0.8)]",
                  )}
                >
                  <PieceArt owner={piece.owner} king={piece.king} prefix={prefix} />
                  {taken && (
                    <span className="absolute inset-0 flex items-center justify-center text-[min(7vw,36px)] leading-none font-bold text-[#e5484d]">
                      ×
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </BoardFrame>

      <PlayerBar
        seat={bottomSeat}
        name={game.seats[bottomSeat]?.name ?? SIDE[bottomSeat]}
        count={view.counts[bottomSeat]}
        taken={12 - view.counts[topSeat]}
        turn={!over && view.turn === bottomSeat}
        seconds={view.turn === bottomSeat ? seconds : null}
        you={me !== null}
        prefix={prefix}
      />

      {!over && <Status view={view} myTurn={myTurn} />}
      {!over && me !== null && <DrawControls view={view} me={me} move={move} />}
      {!over && me === null && view.drawOffer !== null && (
        <p className="text-center text-sm text-muted">
          {SIDE[view.drawOffer]} durang taklif qildi.
        </p>
      )}
    </div>
  );
}

function squareLabel(square: number, piece: CheckersViewPiece | undefined, target: boolean) {
  const what = piece
    ? `${piece.owner === 0 ? "oq" : "qora"} ${piece.king ? "damka" : "dona"}`
    : "bo'sh";
  return `${squareName(square)}, ${what}${target ? ", yurish mumkin" : ""}`;
}

function PlayerBar({
  seat,
  name,
  count,
  taken,
  turn,
  seconds,
  you = false,
  prefix,
}: {
  seat: 0 | 1;
  name: string;
  count: number;
  taken: number;
  turn: boolean;
  seconds: number | null;
  you?: boolean;
  prefix: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-card border bg-surface px-3 py-2 transition-colors",
        turn ? "border-primary/60 shadow-soft-sm" : "border-border",
      )}
    >
      <span className="size-7 shrink-0">
        <PieceArt owner={seat} king={false} prefix={prefix} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">
          {name}
          {you && <span className="font-normal text-muted"> (siz)</span>}
        </div>
        <div className="text-xs text-muted">
          {SIDE[seat]} · {count} dona{taken > 0 ? ` · ${taken} ta urdi` : ""}
        </div>
      </div>
      {turn && seconds !== null && (
        <span
          className={cn(
            "flex items-center gap-1 rounded-control px-2 py-1 font-mono text-sm font-semibold tabular-nums",
            seconds <= 10 ? "bg-danger/15 text-danger" : "bg-surface-muted",
          )}
        >
          <Timer className="size-4" aria-hidden />
          {seconds}
        </span>
      )}
      {turn && seconds === null && (
        <span className="size-2.5 shrink-0 rounded-full bg-snap" aria-label="Navbat" />
      )}
    </div>
  );
}

function Status({ view, myTurn }: { view: CheckersView; myTurn: boolean }) {
  let text: string;
  if (myTurn && view.continuing !== null) text = "Urishni davom ettiring: shu dona yana uradi";
  else if (myTurn && view.mustCapture)
    text = "Urish majburiy! Belgilangan donalardan birini tanlang";
  else if (myTurn) text = "Sizning navbatingiz";
  else if (view.seat !== null) text = "Raqib yurmoqda…";
  else text = `${SIDE[view.turn]} yuradi`;
  const movesLeft = Math.ceil((30 - view.kingsOnlyPlies) / 2);
  return (
    <div className="text-center">
      <p
        className={cn(
          "text-sm font-medium",
          myTurn ? "text-foreground" : "text-muted",
          myTurn && view.mustCapture && "text-[#b7791f] dark:text-[#ffd166]",
        )}
      >
        {text}
      </p>
      {view.kingsOnlyPlies >= 10 && (
        <p className="mt-0.5 text-xs text-muted">
          Faqat damkalar yurmoqda: yana {movesLeft} yurishda urish bo&apos;lmasa, durang.
        </p>
      )}
    </div>
  );
}

function DrawControls({
  view,
  me,
  move,
}: {
  view: CheckersView;
  me: 0 | 1;
  move: BoardProps["move"];
}) {
  const [busy, setBusy] = useState(false);
  const run = (type: "offer-draw" | "accept-draw" | "decline-draw") => {
    setBusy(true);
    void move({ type }).finally(() => setBusy(false));
  };
  const button =
    "rounded-control border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-muted disabled:opacity-50";

  if (view.drawOffer !== null && view.drawOffer !== me) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-card border border-primary/40 bg-primary-soft px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Handshake className="size-4" aria-hidden />
          Raqib durang taklif qildi
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => run("accept-draw")}
          className="rounded-control bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          Qabul qilish
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run("decline-draw")}
          className={button}
        >
          Rad etish
        </button>
      </div>
    );
  }
  if (view.drawOffer === me) {
    return (
      <p className="text-center text-sm text-muted">
        Durang taklif qildingiz. Raqib javobini kutyapmiz…
      </p>
    );
  }
  return (
    <div className="flex justify-center">
      <button
        type="button"
        disabled={busy || !view.canOfferDraw}
        onClick={() => run("offer-draw")}
        className={cn(button, "flex items-center gap-1.5")}
      >
        <Handshake className="size-4" aria-hidden />
        Durang taklif qilish
      </button>
    </div>
  );
}
