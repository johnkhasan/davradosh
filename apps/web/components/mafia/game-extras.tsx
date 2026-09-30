"use client";

import {
  MAFIA_FOULS_OUT,
  MAFIA_SAY_MAX,
  type MafiaCheckView,
  type MafiaView,
} from "@puzzle/shared/mafia";
import { Gavel, Send, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { errorText } from "@/lib/mafia/text";
import type { MafiaActions } from "@/lib/mafia/use-mafia-room";
import { cn } from "@/lib/utils";

/** The speaker's latest typed line in the current minute, for the bubble on their seat. */
export function currentSaying(view: MafiaView, seat: number): string | null {
  if (view.speaker !== seat) return null;
  for (let i = view.log.length - 1; i >= 0; i--) {
    const event = view.log[i]!;
    if (event.type === "said") {
      if (event.seat === seat) return event.text;
      return null; // someone else spoke since: this minute has nothing typed yet
    }
    if (event.type === "day" || event.type === "night" || event.type === "votes") return null;
  }
  return null;
}

/** One-line text box: typed speech for players without a microphone, or the black team's chat. */
export function SayBox({
  onSay,
  placeholder,
  dark = false,
}: {
  onSay: (text: string) => Promise<{ ok: boolean; error?: string }>;
  placeholder: string;
  dark?: boolean;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    const result = await onSay(clean);
    if (result.ok) setText("");
    else setError(errorText(result.error ?? ""));
  };
  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          maxLength={MAFIA_SAY_MAX}
          placeholder={placeholder}
          aria-label={placeholder}
          className={cn(
            "min-w-0 flex-1 rounded-control border px-3 py-2.5 text-base focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
            dark
              ? "border-white/15 bg-white/10 text-white placeholder:text-white/50"
              : "border-border bg-surface",
          )}
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Yuborish"
          className="flex size-11 shrink-0 items-center justify-center rounded-control bg-primary text-primary-foreground disabled:opacity-40"
        >
          <Send className="size-4" aria-hidden />
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

/** Zero night: the black team's private text chat (next to the night voice room). */
export function TeamChat({ view, actions }: { view: MafiaView; actions: MafiaActions }) {
  return (
    <section className="mafia-enter mt-4 rounded-card border border-white/10 bg-white/5 p-4">
      <h2 className="font-display text-lg font-bold">Jamoa chati</h2>
      <p className="text-sm text-white/60">
        Faqat qoralar ko&apos;radi. Otish tartibini kelishib oling.
      </p>
      <ol className="mt-3 max-h-48 space-y-1.5 overflow-y-auto text-sm">
        {view.teamChat.length === 0 && <li className="text-white/50">Hali xabar yo&apos;q.</li>}
        {view.teamChat.map((m, i) => (
          <li key={i}>
            <span className="font-semibold">{m.seat}-raqam:</span> {m.text}
          </li>
        ))}
      </ol>
      {view.actions.includes("say") && (
        <div className="mt-3">
          <SayBox dark placeholder="Jamoaga yozing…" onSay={actions.say} />
        </div>
      )}
    </section>
  );
}

/** Host tools during a game: a foul for a seat, or removing someone from the table. */
export function HostTools({
  view,
  actions,
  dark,
}: {
  view: MafiaView;
  actions: MafiaActions;
  dark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (call: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    const result = await call();
    if (!result.ok) setError(errorText(result.error ?? ""));
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Stol egasi vositalari"
        title="Foll va chiqarish"
        className={cn(
          "flex size-9 items-center justify-center rounded-full",
          dark ? "bg-white/10 text-white" : "bg-surface-muted text-foreground",
        )}
      >
        <Gavel className="size-4" aria-hidden />
      </button>
      {/* Portal: the phase bar uses backdrop-blur, which would trap a fixed overlay inside it. */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Stol egasi vositalari"
              className="mafia-enter w-full max-w-md rounded-card bg-surface p-5 text-foreground shadow-soft-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold">Foll va chiqarish</h2>
                <button type="button" onClick={() => setOpen(false)} aria-label="Yopish">
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <p className="mt-1 text-sm text-muted">
                3 foll: keyingi daqiqada gapira olmaydi. {MAFIA_FOULS_OUT} foll: darhol stoldan
                chiqadi.
              </p>
              {error && (
                <p role="alert" className="mt-2 text-sm text-danger">
                  {error}
                </p>
              )}
              <ol className="mt-4 max-h-[55dvh] space-y-1.5 overflow-y-auto">
                {view.seats
                  .filter((s) => s.alive)
                  .map((s) => (
                    <li
                      key={s.seat}
                      className="flex items-center gap-2 rounded-control bg-surface-muted px-3 py-2"
                    >
                      <span className="w-7 font-mono text-sm text-muted">{s.seat}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                      <span className="text-sm text-muted tabular-nums">⚠️ {s.fouls}</span>
                      <button
                        type="button"
                        onClick={() => void run(() => actions.foul(s.seat))}
                        className="rounded-control bg-amber-500 px-2.5 py-1.5 text-sm font-semibold text-white"
                      >
                        + foll
                      </button>
                      {s.seat !== view.me && (
                        <button
                          type="button"
                          onClick={() => void run(() => actions.kick(s.playerId, false))}
                          className="rounded-control border border-border px-2.5 py-1.5 text-sm"
                        >
                          Chiqarish
                        </button>
                      )}
                    </li>
                  ))}
              </ol>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

const checkLabel = (check: MafiaCheckView) =>
  check.result === "red"
    ? "qizil"
    : check.result === "black"
      ? "qora"
      : check.result === "sheriff"
        ? "Sherif!"
        : "Sherif emas";

/** Game over: every night as it really happened. */
export function GameHistory({ view }: { view: MafiaView }) {
  if (!view.history || view.history.length === 0) return null;
  const name = (seat: number) => view.seats.find((s) => s.seat === seat)?.name ?? "";
  return (
    <section className="mafia-enter mt-4 rounded-card border border-border bg-surface p-4 shadow-soft-sm">
      <h2 className="font-display text-lg font-bold">Tunlarda nima bo&apos;ldi</h2>
      <ol className="mt-3 space-y-4">
        {view.history.map((night) => (
          <li key={night.night} className="text-sm">
            <p className="font-semibold">🌙 {night.night}-tun</p>
            <ul className="mt-1 space-y-0.5 text-muted">
              {night.shots.map((shot) => (
                <li key={shot.seat}>
                  🔫 {shot.seat}-raqam ({name(shot.seat)}) →{" "}
                  {shot.target === null ? "otmadi" : `${shot.target}-raqam`}
                </li>
              ))}
              <li className="font-medium text-foreground">
                {night.killed === null
                  ? "O'q tegmadi"
                  : `O'ldirildi: ${night.killed}-raqam (${name(night.killed)})`}
              </li>
              <li>
                🎩 Don:{" "}
                {night.don ? `${night.don.seat}-raqam — ${checkLabel(night.don)}` : "tekshirmadi"}
              </li>
              <li>
                ⭐ Sherif:{" "}
                {night.sheriff
                  ? `${night.sheriff.seat}-raqam — ${checkLabel(night.sheriff)}`
                  : "tekshirmadi"}
              </li>
              {night.bestMove && (
                <li>🎯 Eng yaxshi yurish: {night.bestMove.map((s) => `${s}-raqam`).join(", ")}</li>
              )}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
