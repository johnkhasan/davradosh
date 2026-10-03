"use client";

import {
  BOARD_SIZE,
  FLEET,
  SHIP_SIZES,
  SHOT_HIT,
  SHOT_NONE,
  canPlace,
  cellName,
  randomFleet,
  shipCells,
  type BattleshipGridView,
  type BattleshipMove,
  type BattleshipView,
  type Ship,
} from "@puzzle/shared/games/battleship";
import { Check, Eraser, Pencil, RotateCw, Shuffle } from "lucide-react";
import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { BoardProps } from "@/components/table/board-types";
import { cn } from "@/lib/utils";
import { MiniShip, SEA_STYLE, SeaGrid, type SeaGhost } from "./sea-grid";

type Move = (move: BattleshipMove) => Promise<{ ok: boolean }>;

export default function Board({ view, game, clockOffset, move }: BoardProps<BattleshipView>) {
  const send = move as Move;
  const names = game.seats.map((seat) => seat.name);
  const deadline = view.deadline === null ? null : view.deadline + clockOffset;
  return (
    <div style={SEA_STYLE} className="flex flex-col gap-3">
      {view.phase === "placement" ? (
        view.you === null ? (
          <SpectatorPlacement view={view} names={names} deadline={deadline} />
        ) : (
          <Placement
            key={game.startedAt}
            view={view}
            you={view.you}
            deadline={deadline}
            move={send}
          />
        )
      ) : (
        <Battle view={view} names={names} deadline={deadline} move={send} />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ clock

function useNow(running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [running]);
  return now;
}

function Countdown({ deadline, total }: { deadline: number | null; total: number }) {
  const now = useNow(deadline !== null);
  if (deadline === null) return null;
  const left = Math.max(0, deadline - now);
  const fraction = total > 0 ? Math.min(1, left / total) : 0;
  const seconds = Math.ceil(left / 1000);
  const urgent = seconds <= 10;
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <span
      className={cn("relative inline-flex size-10 shrink-0", urgent ? "text-danger" : "")}
      aria-label={`${seconds} soniya qoldi`}
      role="timer"
    >
      <svg viewBox="0 0 36 36" className="size-full -rotate-90">
        <circle
          cx={18}
          cy={18}
          r={r}
          fill="none"
          strokeWidth={3}
          style={{ stroke: "currentColor", opacity: 0.2 }}
        />
        <circle
          cx={18}
          cy={18}
          r={r}
          fill="none"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fraction)}
          style={{ stroke: "currentColor", transition: "stroke-dashoffset 250ms linear" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums">
        {seconds > 99
          ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
          : seconds}
      </span>
    </span>
  );
}

// ------------------------------------------------------------------ placement

type Draft = Array<Ship | null>;

/** Puts the given ships into the fleet slots (FLEET order). */
function draftFrom(ships: readonly Ship[]): Draft {
  const left = ships.map((s) => ({ x: s.x, y: s.y, length: s.length, vertical: s.vertical }));
  return FLEET.map((length) => {
    const i = left.findIndex((s) => s.length === length);
    return i < 0 ? null : left.splice(i, 1)[0]!;
  });
}

const nextFree = (draft: Draft, from: number) => {
  for (let k = 0; k < draft.length; k++) {
    const i = (from + k) % draft.length;
    if (!draft[i]) return i;
  }
  return null;
};

interface Drag {
  slot: number;
  dx: number;
  dy: number;
  start: number;
  /** Ghost top-left, null when the pointer is outside the grid. */
  origin: { x: number; y: number } | null;
  moved: boolean;
}

function Placement({
  view,
  you,
  deadline,
  move,
}: {
  view: BattleshipView;
  you: number;
  deadline: number | null;
  move: Move;
}) {
  const own = view.grids[you];
  const opponent = view.grids[1 - you]!;
  const ready = own.ready;
  const [draft, setDraft] = useState<Draft>(() => draftFrom(own.ships));
  const [selected, setSelected] = useState<number | null>(() => nextFree(draftFrom(own.ships), 0));
  const [vertical, setVertical] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hint) return;
    const id = window.setTimeout(() => setHint(null), 2200);
    return () => window.clearTimeout(id);
  }, [hint]);

  const ships = ready ? draftFrom(own.ships) : draft;
  const placed = ships.filter((s): s is Ship => s !== null);
  const complete = placed.length === FLEET.length;
  const others = (slot: number) => draft.filter((s, i): s is Ship => s !== null && i !== slot);

  const cellAt = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * BOARD_SIZE);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * BOARD_SIZE);
    if (x < 0 || y < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE) return null;
    return { x, y };
  };

  const update = (slot: number, ship: Ship | null) =>
    setDraft((d) => d.map((s, i) => (i === slot ? ship : s)));

  const placeSelected = (cell: { x: number; y: number }) => {
    if (selected === null) return;
    const length = FLEET[selected]!;
    const vert = length > 1 && vertical;
    // Near the edge the ship slides back onto the board.
    const ship: Ship = {
      x: vert ? cell.x : Math.min(cell.x, BOARD_SIZE - length),
      y: vert ? Math.min(cell.y, BOARD_SIZE - length) : cell.y,
      length,
      vertical: vert,
    };
    if (!canPlace(others(selected), ship)) {
      setHint("Bu yerga sig'maydi: kemalar bir-biriga tegmasligi kerak");
      return;
    }
    const next = draft.map((s, i) => (i === selected ? ship : s));
    setDraft(next);
    setSelected(nextFree(next, selected));
  };

  const rotate = (slot: number) => {
    const ship = draft[slot];
    if (!ship || ship.length === 1) return;
    const turned = { ...ship, vertical: !ship.vertical };
    if (canPlace(others(slot), turned)) update(slot, turned);
    else setHint("Burish uchun joy yetmaydi");
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (ready || busy) return;
    const cell = cellAt(e);
    if (!cell) return;
    const index = cell.y * BOARD_SIZE + cell.x;
    const slot = draft.findIndex((s) => s !== null && shipCells(s).includes(index));
    if (slot >= 0) {
      const ship = draft[slot]!;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({
        slot,
        dx: cell.x - ship.x,
        dy: cell.y - ship.y,
        start: index,
        origin: { x: ship.x, y: ship.y },
        moved: false,
      });
    } else {
      placeSelected(cell);
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const cell = cellAt(e);
    if (drag) {
      const moved = drag.moved || !cell || cell.y * BOARD_SIZE + cell.x !== drag.start;
      const origin = cell ? { x: cell.x - drag.dx, y: cell.y - drag.dy } : null;
      if (moved !== drag.moved || origin?.x !== drag.origin?.x || origin?.y !== drag.origin?.y)
        setDrag({ ...drag, moved, origin });
    } else if (e.pointerType === "mouse") {
      if (cell?.x !== hover?.x || cell?.y !== hover?.y) setHover(cell);
    }
  };

  const onPointerUp = () => {
    if (!drag) return;
    setDrag(null);
    if (!drag.moved) return rotate(drag.slot);
    const ship = draft[drag.slot]!;
    if (!drag.origin) {
      // Dropped off the sea: back to the tray.
      update(drag.slot, null);
      setSelected(drag.slot);
      return;
    }
    const moved = { ...ship, x: drag.origin.x, y: drag.origin.y };
    if (canPlace(others(drag.slot), moved)) update(drag.slot, moved);
    else setHint("Bu yerga qo'yib bo'lmaydi");
  };

  let ghost: SeaGhost | null = null;
  if (!ready && drag?.moved && drag.origin) {
    const ship = { ...draft[drag.slot]!, ...drag.origin };
    ghost = { ship, valid: canPlace(others(drag.slot), ship) };
  } else if (!ready && !drag && hover && selected !== null) {
    const length = FLEET[selected]!;
    const vert = length > 1 && vertical;
    const ship: Ship = {
      x: vert ? hover.x : Math.min(hover.x, BOARD_SIZE - length),
      y: vert ? Math.min(hover.y, BOARD_SIZE - length) : hover.y,
      length,
      vertical: vert,
    };
    ghost = { ship, valid: canPlace(others(selected), ship) };
  }

  const pickSlot = (slot: number) => {
    if (ready) return;
    if (draft[slot]) update(slot, null);
    setSelected(slot);
  };

  const shuffle = () => {
    const fleet = randomFleet(Math.random);
    setDraft(draftFrom(fleet));
    setSelected(null);
  };

  const clear = () => {
    setDraft(FLEET.map(() => null));
    setSelected(0);
  };

  const submit = async () => {
    if (!complete || busy) return;
    setBusy(true);
    await move({ type: "place", ships: placed });
    setBusy(false);
  };

  const unready = async () => {
    setBusy(true);
    await move({ type: "unready" });
    setBusy(false);
  };

  return (
    <>
      <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-3 shadow-soft-sm">
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold">
            {ready ? "Tayyorsiz! Raqib kutilmoqda" : "Kemalaringizni joylashtiring"}
          </p>
          <p className="text-sm text-muted">
            {opponent.ready ? (
              <span className="font-medium text-snap">✓ Raqib tayyor</span>
            ) : (
              "Raqib kemalarini joylashtirmoqda…"
            )}
          </p>
        </div>
        <Countdown deadline={deadline} total={view.placementMs} />
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,15rem)] md:items-start">
        <div className="mx-auto w-full max-w-[520px]">
          <SeaGrid
            label="Sizning dengizingiz"
            ships={placed.map((s) => ({
              ...s,
              active: drag?.slot !== undefined && draft[drag.slot] === s,
            }))}
            ghost={ghost}
          >
            <div
              className={cn(
                "h-full w-full touch-none",
                ready ? "cursor-default" : "cursor-pointer",
              )}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => setDrag(null)}
              onPointerLeave={() => setHover(null)}
            />
          </SeaGrid>
          <p
            role="status"
            aria-live="polite"
            className={cn(
              "mt-1 min-h-5 text-center text-sm font-medium text-danger transition-opacity",
              hint ? "opacity-100" : "opacity-0",
            )}
          >
            {hint}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {!ready && (
            <div className="rounded-card border border-border bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Kemalar</p>
                <button
                  type="button"
                  onClick={() => setVertical((v) => !v)}
                  className="flex min-h-10 items-center gap-1.5 rounded-control border border-border px-3 text-sm font-medium hover:bg-surface-muted"
                >
                  <RotateCw className="size-4" aria-hidden />
                  {vertical ? "Tik" : "Yotiq"}
                </button>
              </div>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {FLEET.map((length, slot) => (
                  <li key={slot}>
                    <button
                      type="button"
                      onClick={() => pickSlot(slot)}
                      aria-pressed={selected === slot}
                      aria-label={`${length} palubali kema${draft[slot] ? " (joylashgan)" : ""}`}
                      className={cn(
                        "flex min-h-10 items-center rounded-control border px-2 transition-colors",
                        selected === slot
                          ? "border-primary bg-primary-soft"
                          : "border-border hover:bg-surface-muted",
                        draft[slot] && selected !== slot && "opacity-35",
                      )}
                    >
                      <MiniShip length={length} cell={14} />
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">
                Kemani tanlab, dengizdagi katakka bosing. Joylashgan kemani bossangiz buriladi,
                sudrasangiz suriladi, tashqariga olib chiqsangiz qaytadi.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
            {!ready && (
              <>
                <button
                  type="button"
                  onClick={shuffle}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-control border border-border bg-surface px-3 font-medium hover:bg-surface-muted"
                >
                  <Shuffle className="size-4" aria-hidden />
                  Tasodifiy joylash
                </button>
                <button
                  type="button"
                  onClick={clear}
                  disabled={placed.length === 0}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-control border border-border bg-surface px-3 font-medium hover:bg-surface-muted disabled:opacity-50"
                >
                  <Eraser className="size-4" aria-hidden />
                  Tozalash
                </button>
              </>
            )}
            {ready ? (
              <button
                type="button"
                onClick={() => void unready()}
                disabled={busy}
                className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-control border border-border bg-surface px-3 font-medium hover:bg-surface-muted disabled:opacity-60 md:col-span-1"
              >
                <Pencil className="size-4" aria-hidden />
                O&apos;zgartirish
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!complete || busy}
                className="col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-control bg-primary px-4 font-semibold text-primary-foreground shadow-soft-md disabled:opacity-50 md:col-span-1"
              >
                <Check className="size-5" aria-hidden />
                Tayyor {!complete && `(${placed.length}/${FLEET.length})`}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function SpectatorPlacement({
  view,
  names,
  deadline,
}: {
  view: BattleshipView;
  names: string[];
  deadline: number | null;
}) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-soft-sm">
      <div className="min-w-0 flex-1">
        <p className="font-display font-bold">O&apos;yinchilar kemalarini joylashtirmoqda</p>
        <ul className="mt-1 text-sm text-muted">
          {view.grids.map((grid, seat) => (
            <li key={seat}>
              {names[seat]}:{" "}
              {grid.ready ? <span className="text-snap">tayyor</span> : "joylashtirmoqda…"}
            </li>
          ))}
        </ul>
      </div>
      <Countdown deadline={deadline} total={view.placementMs} />
    </div>
  );
}

// ------------------------------------------------------------------ battle

function seaShips(grid: BattleshipGridView, revealAll: boolean) {
  return grid.ships.map((ship) => ({ ...ship, ghost: revealAll && !ship.sunk }));
}

function FleetLeft({ remaining, title }: { remaining: Record<number, number>; title: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span className="font-medium text-muted">{title}:</span>
      {SHIP_SIZES.map((size) => {
        const left = remaining[size] ?? 0;
        return (
          <span
            key={size}
            className={cn("inline-flex items-center gap-1", left === 0 && "opacity-30")}
            aria-label={`${size} palubali: ${left} ta`}
          >
            <MiniShip length={size} cell={8} />
            <span className="font-semibold tabular-nums">×{left}</span>
          </span>
        );
      })}
    </div>
  );
}

function Battle({
  view,
  names,
  deadline,
  move,
}: {
  view: BattleshipView;
  names: string[];
  deadline: number | null;
  move: Move;
}) {
  const [pending, setPending] = useState<number | null>(null);
  const you = view.you;
  const over = view.phase === "over";

  if (you === null) {
    return (
      <>
        <TurnBanner view={view} names={names} deadline={deadline} />
        <div className="grid gap-4 sm:grid-cols-2">
          {view.grids.map((grid, seat) => (
            <section key={seat} className="min-w-0">
              <p className="mb-1 truncate text-sm font-semibold">{names[seat]} dengizi</p>
              <SeaGrid
                label={`${names[seat]} dengizi`}
                ships={seaShips(grid, over)}
                shots={grid.shots}
                lastShot={grid.lastShot}
              />
              <div className="mt-2">
                <FleetLeft remaining={grid.remaining} title="Qolgan kemalar" />
              </div>
            </section>
          ))}
        </div>
      </>
    );
  }

  const enemy = view.grids[1 - you]!;
  const own = view.grids[you]!;
  const myTurn = !over && view.turn === you;

  const shoot = async (cell: number) => {
    if (!myTurn || pending !== null || enemy.shots[cell] !== SHOT_NONE) return;
    setPending(cell);
    await move({ type: "shoot", x: cell % BOARD_SIZE, y: Math.floor(cell / BOARD_SIZE) });
    setPending(null);
  };

  return (
    <>
      <TurnBanner view={view} names={names} deadline={deadline} />
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <section className="w-full min-w-0 md:flex-[1.4]">
          <p className="mb-1 truncate text-sm font-semibold">
            🎯 {names[1 - you] ?? "Raqib"} dengizi
          </p>
          <SeaGrid
            label="Raqib dengizi"
            ships={seaShips(enemy, over)}
            shots={enemy.shots}
            lastShot={enemy.lastShot}
            className={cn(
              "rounded-[10px] transition-shadow",
              myTurn && "shadow-[0_0_0_3px_var(--primary)]",
            )}
          >
            <div className="grid h-full w-full grid-cols-10 grid-rows-10">
              {enemy.shots.map((code, cell) => {
                const free = code === SHOT_NONE;
                return (
                  <button
                    key={cell}
                    type="button"
                    disabled={!myTurn || !free || pending !== null}
                    onClick={() => void shoot(cell)}
                    aria-label={`${cellName(cell)}${free ? "" : code === SHOT_HIT ? ", tegdi" : ", bo'sh"}`}
                    className={cn(
                      "relative m-0 p-0 outline-none",
                      myTurn &&
                        free &&
                        "cursor-crosshair hover:bg-primary/20 focus-visible:bg-primary/25",
                    )}
                  >
                    {pending === cell && (
                      <span className="absolute inset-[30%] rounded-full bg-primary/60 motion-safe:animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          </SeaGrid>
          <div className="mt-2">
            <FleetLeft remaining={enemy.remaining} title="Raqibda qoldi" />
          </div>
        </section>

        <section className="mx-auto w-[64%] max-w-[300px] min-w-0 md:mx-0 md:w-auto md:max-w-none md:flex-1">
          <p className="mb-1 truncate text-sm font-semibold">🚢 Sizning dengizingiz</p>
          <SeaGrid
            label="Sizning dengizingiz"
            ships={seaShips(own, false)}
            shots={own.shots}
            lastShot={own.lastShot}
          />
          <div className="mt-2">
            <FleetLeft remaining={own.remaining} title="Sizda qoldi" />
          </div>
        </section>
      </div>
    </>
  );
}

function TurnBanner({
  view,
  names,
  deadline,
}: {
  view: BattleshipView;
  names: string[];
  deadline: number | null;
}) {
  if (view.phase === "over") return null;
  const you = view.you;
  const myTurn = you !== null && view.turn === you;
  // The shooter's last shot is on the other sea: a hit there means "shoot again".
  const target = view.grids[1 - view.turn]!;
  const last = target.lastShot;
  const hit = last !== null && target.shots[last] === SHOT_HIT;
  const sunk = hit && target.ships.some((s) => s.sunk && shipCells(s).includes(last));

  let title: string;
  if (you === null) title = `${names[view.turn] ?? "O'yinchi"} o'q uzmoqda`;
  else title = myTurn ? "Sizning navbatingiz" : "Raqib o'q uzmoqda";
  let detail: string | null = null;
  if (sunk) detail = myTurn ? "Kema cho'kdi! Yana oting" : "Kema cho'kdi";
  else if (hit) detail = myTurn ? "Tegdi! Yana oting" : "Tegdi";
  else if (myTurn) detail = "Raqib dengizidagi katakni tanlang";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-card p-3 shadow-soft-sm transition-colors",
        myTurn ? "bg-primary text-primary-foreground" : "border border-border bg-surface",
      )}
      aria-live="polite"
    >
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg leading-tight font-bold">{title}</p>
        {detail && (
          <p className={cn("text-sm", myTurn ? "text-primary-foreground/85" : "text-muted")}>
            {detail}
          </p>
        )}
      </div>
      <Countdown deadline={deadline} total={view.turnSeconds * 1000} />
    </div>
  );
}
