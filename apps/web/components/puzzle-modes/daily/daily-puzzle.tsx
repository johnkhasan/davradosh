"use client";

import { CalendarDays, Clock, Loader2, Play, Puzzle, RefreshCw, Send, Users } from "lucide-react";
import { gridForPieceCount } from "@puzzle/shared";
import { useCallback, useEffect, useState } from "react";
import { IdentityDialog } from "@/components/identity-dialog";
import {
  ApiError,
  dailyApi,
  type DailyLeaderboardDTO,
  type DailyPuzzleDTO,
  type DailySubmitDTO,
} from "@/lib/api";
import { SITE_URL } from "@/lib/env";
import { getClientId, loadIdentity, type Identity } from "@/lib/identity";
import { cn } from "@/lib/utils";
import { formatClock, hasModeSave } from "../save";
import { useNow } from "../use-now";
import { DailyPlay } from "./daily-play";
import { loadDailyDone, saveDailyDone } from "./done-store";
import { DailyLeaderboard } from "./leaderboard";

type Submit =
  | { status: "idle" | "naming" | "sending" }
  | { status: "sent"; result: DailySubmitDTO }
  | { status: "error"; message: string };

const SUBMIT_ERRORS: Record<string, string> = {
  too_fast: "Natija juda tez ko'rindi va qabul qilinmadi.",
  time_mismatch: "Vaqt server hisobiga to'g'ri kelmadi, natija qabul qilinmadi.",
  wrong_day: "Bu puzzle'ning kuni tugadi.",
};

function submitError(error: unknown): string {
  const code = error instanceof ApiError ? /"error":"([a-z_]+)"/.exec(error.message)?.[1] : null;
  return (
    (code && SUBMIT_ERRORS[code]) ??
    "Natijani yuborib bo'lmadi. Internetni tekshirib qayta urining."
  );
}

const MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];

function dayLabel(day: string) {
  const [, month, date] = day.split("-").map(Number);
  return `${date}-${MONTHS[(month ?? 1) - 1]}`;
}

/** The daily puzzle page: start card → solving → result with the leaderboard. */
export function DailyPuzzle() {
  const [clientId] = useState(() => getClientId());
  const [data, setData] = useState<{ puzzle: DailyPuzzleDTO; nextAt: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [board, setBoard] = useState<DailyLeaderboardDTO | null>(null);
  const [playing, setPlaying] = useState(false);
  const [finishedMs, setFinishedMs] = useState<number | null>(null);
  const [submit, setSubmit] = useState<Submit>({ status: "idle" });

  const refreshBoard = useCallback(
    (day: string) =>
      dailyApi
        .leaderboard(day, clientId)
        .then((result) => {
          setBoard(result);
          // Solved on this device before (storage cleared) or the result is already saved.
          if (result.you) setFinishedMs((ms) => ms ?? result.you!.ms);
        })
        .catch(() => undefined),
    [clientId],
  );

  const load = useCallback(() => {
    dailyApi
      .get()
      .then((puzzle) => {
        setData({ puzzle, nextAt: Date.now() + puzzle.nextInMs });
        const done = loadDailyDone(puzzle.day);
        if (done) setFinishedMs(done.ms);
        return refreshBoard(puzzle.day);
      })
      .catch(() => setFailed(true));
  }, [refreshBoard]);

  useEffect(() => {
    load();
  }, [load]);

  const send = useCallback(
    async (identity: Identity, puzzle: DailyPuzzleDTO, ms: number) => {
      setSubmit({ status: "sending" });
      try {
        const result = await dailyApi.submit({
          clientId: identity.clientId,
          name: identity.name,
          color: identity.color,
          avatar: identity.avatar,
          ms: Math.round(ms),
          day: puzzle.day,
        });
        saveDailyDone({ day: puzzle.day, ms, submitted: true });
        setSubmit({ status: "sent", result });
        await refreshBoard(puzzle.day);
      } catch (error) {
        setSubmit({ status: "error", message: submitError(error) });
      }
    },
    [refreshBoard],
  );

  const onComplete = useCallback(
    (ms: number) => {
      if (!data) return;
      setFinishedMs(ms);
      saveDailyDone({ day: data.puzzle.day, ms, submitted: false });
      const identity = loadIdentity();
      if (identity) void send(identity, data.puzzle, ms);
      else setSubmit({ status: "naming" });
    },
    [data, send],
  );

  const start = () => {
    if (!data) return;
    setPlaying(true);
    // Lets the server check the time later; the puzzle works without it.
    void dailyApi.start(clientId, data.puzzle.day).catch(() => undefined);
  };

  if (failed) {
    return (
      <div className="mx-auto max-w-md rounded-card border border-border bg-surface p-6 text-center shadow-soft-sm">
        <p className="font-medium">Bugungi puzzle&apos;ni yuklab bo&apos;lmadi.</p>
        <button
          type="button"
          onClick={() => {
            setFailed(false);
            load();
          }}
          className="mt-4 inline-flex items-center gap-2 rounded-control bg-primary px-5 py-2.5 font-medium text-primary-foreground"
        >
          <RefreshCw className="size-4" aria-hidden /> Qayta urinish
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto grid max-w-3xl animate-pulse gap-4 md:grid-cols-2" aria-busy>
        <div className="aspect-[4/3] rounded-card bg-surface-muted" />
        <div className="h-64 rounded-card bg-surface-muted" />
      </div>
    );
  }

  const { puzzle } = data;
  const unsent = finishedMs !== null && submit.status !== "sent" && !board?.you;

  return (
    <>
      <div className="mx-auto grid w-full max-w-4xl gap-5 md:grid-cols-[1.1fr_1fr]">
        <section className="overflow-hidden rounded-card border border-border bg-surface shadow-soft-md">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={puzzle.image.thumbUrl || puzzle.image.url}
              alt="Bugungi puzzle rasmi"
              className={cn("w-full object-cover", finishedMs === null && "blur-[2px] saturate-75")}
              style={{ aspectRatio: `${puzzle.image.width} / ${puzzle.image.height}` }}
            />
            <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1 text-sm font-semibold shadow-soft-sm">
              <CalendarDays className="size-4 text-primary" aria-hidden /> {dayLabel(puzzle.day)}
            </span>
          </div>
          <div className="p-5">
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
              <span className="flex items-center gap-1.5">
                <Puzzle className="size-4" aria-hidden /> {pieceCount(puzzle)} bo&apos;lak
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="size-4" aria-hidden /> {board?.total ?? 0} kishi yig&apos;di
              </span>
            </div>
            {finishedMs === null ? (
              <StartBlock puzzle={puzzle} onStart={start} />
            ) : (
              <ResultBlock
                ms={finishedMs}
                submit={submit}
                board={board}
                unsent={unsent}
                onSend={() => {
                  const identity = loadIdentity();
                  if (identity) void send(identity, puzzle, finishedMs);
                  else setSubmit({ status: "naming" });
                }}
                imageUrl={puzzle.image.url}
              />
            )}
            {puzzle.image.credit && (
              <p className="mt-4 text-xs text-muted">Rasm: {puzzle.image.credit}</p>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold">Bugungi reyting</h2>
          {board ? (
            <DailyLeaderboard board={board} limit={finishedMs === null ? 3 : undefined} />
          ) : (
            <div className="h-40 animate-pulse rounded-card bg-surface-muted" />
          )}
          {finishedMs === null && board && board.total > 3 && (
            <p className="text-sm text-muted">
              To&apos;liq reyting puzzle&apos;ni yig&apos;gandan keyin ochiladi.
            </p>
          )}
          <NextPuzzle nextAt={data.nextAt} />
        </section>
      </div>

      {playing && (
        <DailyPlay
          puzzle={puzzle}
          finishedMs={finishedMs}
          onComplete={onComplete}
          onExit={() => setPlaying(false)}
        />
      )}

      {submit.status === "naming" && finishedMs !== null && (
        <IdentityDialog
          title="Natijangizni saqlaymiz"
          description="Ismingiz kunlik reytingda ko'rinadi."
          submitLabel="Reytingga qo'shish"
          onSubmit={(identity) => void send(identity, puzzle, finishedMs)}
          onCancel={() => setSubmit({ status: "idle" })}
        />
      )}
    </>
  );
}

function StartBlock({ puzzle, onStart }: { puzzle: DailyPuzzleDTO; onStart: () => void }) {
  const [resume] = useState(() => hasModeSave(`daily:${puzzle.day}`));
  return (
    <div className="mt-4">
      <p className="text-muted">
        Bugun hamma bir xil rasm va bir xil bo&apos;laklarni yig&apos;adi. Vaqtingiz kunlik
        reytingga tushadi.
      </p>
      <button
        type="button"
        onClick={onStart}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-control bg-primary px-6 py-3.5 text-lg font-semibold text-primary-foreground shadow-soft-lg transition-transform hover:-translate-y-0.5 sm:w-auto"
      >
        <Play className="size-5" aria-hidden /> {resume ? "Davom etish" : "Boshlash"}
      </button>
      <p className="mt-2 text-xs text-muted">
        Soat birinchi bo&apos;lak bilan emas, shu tugmadan boshlanadi.
      </p>
    </div>
  );
}

function ResultBlock({
  ms,
  submit,
  board,
  unsent,
  onSend,
  imageUrl,
}: {
  ms: number;
  submit: Submit;
  board: DailyLeaderboardDTO | null;
  unsent: boolean;
  onSend: () => void;
  imageUrl: string;
}) {
  const rank = submit.status === "sent" ? submit.result.rank : board?.you?.rank;
  const best = submit.status === "sent" ? submit.result.ms : (board?.you?.ms ?? ms);
  const shareText = `Bugungi kunlik puzzle'ni ${formatClock(best)} da yig'dim${
    rank ? ` (${rank}-o'rin)` : ""
  }! Siz-chi?`;
  const shareUrl = `${SITE_URL}/puzzle/kunlik`;
  return (
    <div className="mt-4">
      <p className="text-sm text-muted">Sizning vaqtingiz</p>
      <p className="font-display text-4xl font-extrabold tabular-nums">{formatClock(best)}</p>
      {rank && (
        <p className="mt-1 font-medium">
          🏅 {rank}-o&apos;rin
          {board ? <span className="text-muted"> · {board.total} kishidan</span> : null}
        </p>
      )}
      {submit.status === "sent" && !submit.result.improved && (
        <p className="mt-1 text-sm text-muted">
          Oldingi natijangiz yaxshiroq edi, o&apos;sha saqlandi.
        </p>
      )}
      {submit.status === "sending" && (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Natija yuborilmoqda
        </p>
      )}
      {submit.status === "error" && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {submit.message}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {unsent && submit.status !== "sending" && (
          <button
            type="button"
            onClick={onSend}
            className="inline-flex items-center gap-2 rounded-control bg-primary px-4 py-2.5 font-medium text-primary-foreground"
          >
            <Send className="size-4" aria-hidden /> Reytingga yuborish
          </button>
        )}
        <a
          href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-control bg-[#229ED9] px-4 py-2.5 font-medium text-white"
        >
          <Send className="size-4" aria-hidden /> Telegram&apos;da ulashish
        </a>
        <a
          href={imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-control border border-border px-4 py-2.5 font-medium hover:bg-surface-muted"
        >
          Rasmni ochish
        </a>
      </div>
    </div>
  );
}

function NextPuzzle({ nextAt }: { nextAt: number }) {
  const now = useNow(1000);
  const left = nextAt - now;
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-4">
      <Clock className="size-6 shrink-0 text-primary" aria-hidden />
      {left > 0 ? (
        <p className="text-sm">
          Ertaga yangi puzzle:{" "}
          <span className="font-mono font-semibold tabular-nums">{formatClock(left)}</span> dan
          keyin
        </p>
      ) : (
        <p className="flex flex-1 items-center justify-between gap-2 text-sm">
          Yangi puzzle tayyor!
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-control bg-primary px-3 py-1.5 font-medium text-primary-foreground"
          >
            Ochish
          </button>
        </p>
      )}
    </div>
  );
}

/** The exact number of pieces the cut makes (the API gives the target count). */
function pieceCount(puzzle: { pieces: number; image: { width: number; height: number } }) {
  const { cols, rows } = gridForPieceCount(puzzle.pieces, puzzle.image.width / puzzle.image.height);
  return cols * rows;
}
