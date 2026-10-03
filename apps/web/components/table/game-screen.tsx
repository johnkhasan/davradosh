"use client";

import {
  TABLE_GAMES,
  type TableGameDTO,
  type TableResult,
  type TableRoomStateDTO,
} from "@puzzle/shared/games";
import { Check, Copy, Flag } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/game/ui";
import { errorText } from "@/lib/table/text";
import type { TableActions } from "@/lib/table/use-table-room";
import { cn } from "@/lib/utils";
import { TableChat } from "./chat";
import { BOARDS, GAME_TEXTS } from "./games";

/** A running (or just finished) game: the board, the players, the result and the chat. */
export function TableGameScreen({
  state,
  game,
  clockOffset,
  actions,
}: {
  state: TableRoomStateDTO;
  game: TableGameDTO;
  clockOffset: number;
  actions: TableActions;
}) {
  const info = TABLE_GAMES[state.kind];
  const texts = GAME_TEXTS[state.kind];
  const Board = BOARDS[state.kind];
  const [error, setError] = useState<string | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [copied, setCopied] = useState(false);
  const errorTimer = useRef<number | undefined>(undefined);
  const me = state.members.find((m) => m.id === state.you);
  const mySeat = game.yourSeat;
  const playing = mySeat !== null && !game.seats[mySeat]?.left && !game.result;

  const showError = useCallback(
    (code: string) => {
      setError(errorText(code, texts.ERRORS));
      window.clearTimeout(errorTimer.current);
      errorTimer.current = window.setTimeout(() => setError(null), 2500);
    },
    [texts],
  );
  useEffect(() => () => window.clearTimeout(errorTimer.current), []);

  const move = useCallback(
    async (m: unknown): Promise<TableResult> => {
      const result = await actions.move(m);
      if (!result.ok) showError(result.error);
      return result;
    },
    [actions, showError],
  );

  const run = async (call: () => Promise<TableResult>) => {
    const result = await call();
    if (!result.ok) showError(result.error);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      showError("invalid");
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-3">
        <Link href={info.path} className="font-display text-lg font-bold whitespace-nowrap">
          {info.emoji} {info.name}
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void copy()}
            className="flex items-center gap-1.5 rounded-control border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-muted"
          >
            {copied ? (
              <Check className="size-4" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
            <span className="hidden sm:inline">{copied ? "Nusxalandi" : "Havola"}</span>
          </button>
          {playing && (
            <button
              type="button"
              onClick={() => setConfirmResign(true)}
              className="flex items-center gap-1.5 rounded-control border border-border bg-surface px-3 py-1.5 text-sm font-medium text-danger hover:bg-surface-muted"
            >
              <Flag className="size-4" aria-hidden />
              <span className="hidden sm:inline">Taslim bo&apos;lish</span>
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-4 px-3 pb-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-3">
          {game.result && (
            <ResultCard
              state={state}
              game={game}
              isHost={Boolean(me?.isHost)}
              onRematch={() => void run(actions.rematch)}
            />
          )}
          <Board view={game.view} game={game} room={state} clockOffset={clockOffset} move={move} />
          <p
            role="status"
            aria-live="polite"
            className={cn(
              "min-h-5 text-center text-sm font-medium text-danger transition-opacity",
              error ? "opacity-100" : "opacity-0",
            )}
          >
            {error}
          </p>
        </div>

        <aside className="flex min-w-0 flex-col gap-3">
          <PlayerList state={state} game={game} />
          <TableChat
            className="h-64 lg:h-auto lg:min-h-64 lg:flex-1"
            messages={state.chat}
            you={state.you}
            onSend={(text) => run(() => actions.chat(text))}
          />
        </aside>
      </main>

      {confirmResign && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setConfirmResign(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="resign-title"
            className="mafia-enter w-full max-w-sm rounded-card bg-surface p-5 shadow-soft-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="resign-title" className="font-display text-xl font-bold">
              Taslim bo&apos;lasizmi?
            </h2>
            <p className="mt-1 text-sm text-muted">Bu o&apos;yinni yutqazgan hisoblanasiz.</p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmResign(false)}
                className="flex-1 rounded-control border border-border px-4 py-3 font-medium"
              >
                Yo&apos;q
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmResign(false);
                  void run(actions.resign);
                }}
                className="flex-1 rounded-control bg-danger px-4 py-3 font-semibold text-white"
              >
                Ha, taslim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerList({ state, game }: { state: TableRoomStateDTO; game: TableGameDTO }) {
  const spectators = state.members.filter((m) => !game.seats.some((s) => s.playerId === m.id));
  return (
    <section aria-label="O'yinchilar" className="rounded-card border border-border bg-surface p-3">
      <ol className="flex flex-col gap-1.5">
        {game.seats.map((seat, i) => {
          const member = state.members.find((m) => m.id === seat.playerId);
          const active = game.active.includes(i);
          const winner = game.result?.winners.includes(i);
          return (
            <li
              key={seat.playerId}
              className={cn(
                "flex items-center gap-2 rounded-control px-2 py-1.5",
                active && "bg-primary-soft",
                seat.left && "opacity-50",
              )}
            >
              <Avatar
                name={seat.name}
                color={seat.color}
                avatar={seat.avatar}
                size="sm"
                dimmed={!seat.connected}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {seat.name}
                {seat.playerId === state.you && " (siz)"}
              </span>
              {seat.left && <span className="text-xs text-muted">chiqdi</span>}
              {!seat.left && !seat.connected && <span className="text-xs text-muted">uzildi</span>}
              {active && (
                <span
                  className="size-2 animate-pulse rounded-full bg-primary"
                  aria-label="Navbat"
                />
              )}
              {winner && <span aria-label="G'olib">🏆</span>}
              {member && member.wins > 0 && (
                <span className="text-xs text-muted tabular-nums" title="Shu stoldagi g'alabalar">
                  {member.wins}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {spectators.length > 0 && (
        <p className="mt-2 border-t border-border pt-2 text-xs text-muted">
          Tomoshabinlar: {spectators.map((m) => m.name).join(", ")}
        </p>
      )}
    </section>
  );
}

function ResultCard({
  state,
  game,
  isHost,
  onRematch,
}: {
  state: TableRoomStateDTO;
  game: TableGameDTO;
  isHost: boolean;
  onRematch: () => void;
}) {
  const result = game.result!;
  const texts = GAME_TEXTS[state.kind];
  const youWon = game.yourSeat !== null && result.winners.includes(game.yourSeat);
  const names = result.winners.map((s) => game.seats[s]?.name ?? "?");
  const title = result.draw
    ? "Durang"
    : youWon
      ? "Siz yutdingiz!"
      : names.length > 0
        ? `${names.join(", ")} yutdi`
        : "O'yin tugadi";
  const reason = texts.RESULT_REASONS[result.reason];
  return (
    <div
      role="status"
      className={cn(
        "mafia-enter flex flex-col items-center gap-3 rounded-card border p-4 text-center shadow-soft-md sm:flex-row sm:text-left",
        youWon ? "border-snap bg-snap/10" : "border-border bg-surface",
      )}
    >
      <div className="text-4xl" aria-hidden>
        {result.draw ? "🤝" : youWon ? "🏆" : "🏁"}
      </div>
      <div className="flex-1">
        <p className="font-display text-xl font-bold">{title}</p>
        {reason && <p className="text-sm text-muted">{reason}</p>}
      </div>
      {isHost ? (
        <button
          type="button"
          onClick={onRematch}
          className="rounded-control bg-primary px-5 py-2.5 font-semibold text-primary-foreground shadow-soft-sm"
        >
          Yana o&apos;ynash
        </button>
      ) : (
        <p className="text-sm text-muted">Stol egasi yangi o&apos;yinni boshlaydi</p>
      )}
    </div>
  );
}
