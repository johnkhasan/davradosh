"use client";

import type { TableSeatDTO } from "@puzzle/shared/games";
import type { RaceView } from "@puzzle/shared/games/race";
import { Timer, Trophy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PuzzleCanvas, type PuzzleCanvasHandle } from "@/components/game/puzzle-canvas";
import { Avatar } from "@/components/game/ui";
import { PuzzleLoader } from "@/components/puzzle-loader";
import { CanvasTools } from "@/components/puzzle-modes/canvas-tools";
import {
  formatClock,
  loadModeSave,
  pruneModeSaves,
  writeModeSave,
} from "@/components/puzzle-modes/save";
import { useNow } from "@/components/puzzle-modes/use-now";
import { usePuzzleImage } from "@/components/puzzle-modes/use-puzzle-image";
import type { BoardProps } from "@/components/table/board-types";
import { cn } from "@/lib/utils";

/** Progress is shared at most this often (and right away when the puzzle is done). */
const SEND_EVERY_MS = 1_000;

export default function Board({ view, game, room, clockOffset, move }: BoardProps<RaceView>) {
  const seat = game.yourSeat;
  const me = seat !== null ? view.racers[seat] : undefined;
  const over = game.result !== null;
  // Seated players solve; spectators (and players who left) watch the panel.
  const solving = seat !== null && Boolean(me) && !me?.left;
  const startsAt = view.startsAt + clockOffset;
  const now = useNow(250, !over);
  const countdown = Math.ceil((startsAt - now) / 1000);
  // A race can also end during the countdown (everyone else left).
  const started = over || countdown <= 0;

  return (
    <div className="flex flex-col gap-3">
      <RacePanel view={view} seats={game.seats} you={seat} now={now - clockOffset} />
      {solving && view.image ? (
        <RaceCanvas
          key={game.startedAt}
          view={view}
          saveKey={`race:${room.id}:${game.startedAt}`}
          startsAt={startsAt}
          countdown={countdown}
          started={started}
          over={over}
          finishedIn={me?.finishedAt != null ? me.finishedAt - view.startsAt : null}
          now={now}
          move={move}
        />
      ) : (
        <Preview view={view} countdown={started ? null : countdown} />
      )}
    </div>
  );
}

function RaceCanvas({
  view,
  saveKey,
  startsAt,
  countdown,
  started,
  over,
  finishedIn,
  now,
  move,
}: {
  view: RaceView;
  saveKey: string;
  startsAt: number;
  countdown: number;
  started: boolean;
  over: boolean;
  finishedIn: number | null;
  now: number;
  move: BoardProps["move"];
}) {
  const canvasRef = useRef<PuzzleCanvasHandle>(null);
  const { image, failed } = usePuzzleImage(view.image);
  const [ghost, setGhost] = useState(false);
  const [edgesOnly, setEdgesOnly] = useState(false);
  const [done, setDone] = useState(false);
  // A reload in the middle of the race continues this exact puzzle.
  const [saved] = useState(() => {
    pruneModeSaves("race:", saveKey);
    return loadModeSave(saveKey, view.seed, view.total);
  });

  // Latest values for the callbacks the canvas keeps.
  const live = useRef({ over, startsAt, move, saveKey, seed: view.seed });
  useEffect(() => {
    live.current = { over, startsAt, move, saveKey, seed: view.seed };
  });

  const sent = useRef(0);
  const pending = useRef(0);
  const lastSentAt = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const flush = useCallback(() => {
    timer.current = undefined;
    if (live.current.over || pending.current <= sent.current) return;
    sent.current = pending.current;
    lastSentAt.current = Date.now();
    void live.current.move({ type: "progress", placed: sent.current });
  }, []);

  const report = useCallback(
    (placed: number) => {
      if (placed <= pending.current) return;
      pending.current = placed;
      if (timer.current !== undefined) return;
      const wait = Math.max(
        SEND_EVERY_MS - (Date.now() - lastSentAt.current),
        live.current.startsAt - Date.now() + 100,
        0,
      );
      timer.current = window.setTimeout(flush, wait);
    },
    [flush],
  );

  const finish = useCallback(() => {
    setDone(true);
    window.clearTimeout(timer.current);
    timer.current = undefined;
    if (live.current.over) return;
    void live.current.move({ type: "finish" });
  }, []);

  const clock = finishedIn ?? (over ? null : now - startsAt);

  return (
    <div className="table-felt relative h-[62dvh] min-h-80 overflow-hidden rounded-card shadow-soft-md sm:h-[min(68dvh,640px)]">
      {image && (
        <PuzzleCanvas
          ref={canvasRef}
          image={image}
          cols={view.cols}
          rows={view.rows}
          seed={view.seed}
          ghost={ghost}
          edgesOnly={edgesOnly}
          initialSnapshot={saved?.snapshot}
          onChange={(snapshot) =>
            writeModeSave(live.current.saveKey, { seed: live.current.seed, snapshot })
          }
          onProgress={(progress) => report(progress.connected)}
          onComplete={finish}
          className="absolute inset-0"
        />
      )}
      {!image && !failed && <PuzzleLoader variant="overlay" label="Rasm yuklanmoqda" />}
      {failed && (
        <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-white">
          Rasmni yuklab bo&apos;lmadi. Sahifani yangilab ko&apos;ring.
        </p>
      )}

      {started && clock !== null && (
        <span
          className={cn(
            "absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-sm font-semibold shadow-soft-md tabular-nums",
            finishedIn !== null ? "bg-snap text-white" : "bg-surface/95 text-foreground",
          )}
        >
          {finishedIn !== null ? (
            <Trophy className="size-4" aria-hidden />
          ) : (
            <Timer className="size-4" aria-hidden />
          )}
          {formatClock(clock)}
        </span>
      )}

      {image && started && (
        <CanvasTools
          canvas={canvasRef}
          ghost={ghost}
          onGhost={setGhost}
          edgesOnly={edgesOnly}
          onEdgesOnly={setEdgesOnly}
          hint={false}
          editing={!done && !over}
          className="absolute right-3 bottom-3 z-10"
        />
      )}

      {!started && <Countdown value={countdown} />}
    </div>
  );
}

function Countdown({ value }: { value: number }) {
  return (
    <div
      role="status"
      aria-live="assertive"
      className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/45 text-white backdrop-blur-md"
    >
      <p className="text-sm font-semibold tracking-wide uppercase opacity-80">Poyga boshlanmoqda</p>
      <span
        key={value}
        className="mt-2 font-display text-8xl font-extrabold tabular-nums motion-safe:animate-[pop_300ms_ease-out]"
      >
        {Math.max(1, value)}
      </span>
      <p className="mt-3 text-sm opacity-80">Hamma bir xil rasm va bir xil bo&apos;laklar bilan</p>
    </div>
  );
}

/** For spectators: the picture everyone is solving. */
function Preview({ view, countdown }: { view: RaceView; countdown: number | null }) {
  const src = view.image?.thumbUrl || view.image?.url;
  return (
    <div className="relative overflow-hidden rounded-card border border-border bg-surface shadow-soft-sm">
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt="Poyga rasmi"
          className="aspect-[4/3] w-full object-cover"
          style={view.image ? { aspectRatio: `${view.image.width} / ${view.image.height}` } : {}}
        />
      )}
      <p className="p-3 text-center text-sm text-muted">
        {countdown !== null
          ? `Poyga ${countdown} soniyadan keyin boshlanadi`
          : `Siz tomosha qilyapsiz: ${view.total} bo'lakli puzzle`}
      </p>
    </div>
  );
}

function RacePanel({
  view,
  seats,
  you,
  now,
}: {
  view: RaceView;
  seats: TableSeatDTO[];
  you: number | null;
  /** Server time. */
  now: number;
}) {
  const order = view.racers
    .map((racer, seat) => ({ racer, seat }))
    .sort(
      (a, b) =>
        Number(b.seat === view.winner) - Number(a.seat === view.winner) ||
        Number(a.racer.left) - Number(b.racer.left) ||
        b.racer.placed - a.racer.placed ||
        a.seat - b.seat,
    );
  return (
    <ol
      aria-label="Poygachilar"
      className="grid gap-1.5 rounded-card border border-border bg-surface p-2 shadow-soft-sm sm:grid-cols-2"
    >
      {order.map(({ racer, seat }) => {
        const info = seats[seat];
        const percent = Math.round((racer.placed / view.total) * 100);
        const won = seat === view.winner;
        return (
          <li
            key={seat}
            className={cn(
              "flex min-w-0 items-center gap-2 rounded-control px-2 py-1.5",
              seat === you && "bg-primary-soft",
              racer.left && "opacity-55",
            )}
          >
            <Avatar
              name={info?.name ?? "?"}
              color={info?.color ?? "#9CA3AF"}
              avatar={info?.avatar ?? "👤"}
              size="sm"
              dimmed={racer.left}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium">
                  {info?.name ?? "?"}
                  {seat === you && <span className="text-muted"> (siz)</span>}
                </span>
                <span className="shrink-0 text-xs text-muted tabular-nums">
                  {racer.finishedAt !== null
                    ? `🏁 ${formatClock(racer.finishedAt - view.startsAt)}`
                    : racer.left
                      ? "chiqdi"
                      : `${percent}%`}
                </span>
              </div>
              <div
                className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${info?.name ?? "?"}: ${percent}%`}
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none",
                    won ? "bg-snap" : "bg-gradient-to-r from-primary to-snap",
                  )}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
            {won && <Trophy className="size-4 shrink-0 text-snap" aria-label="G'olib" />}
          </li>
        );
      })}
      {view.winner === null && now < view.startsAt && (
        <li className="px-2 text-xs text-muted sm:col-span-2">
          {view.total} bo&apos;lak · birinchi yig&apos;gan yutadi
        </li>
      )}
    </ol>
  );
}
