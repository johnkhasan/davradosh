"use client";

import { MAFIA_PLAYERS, type MafiaMemberDTO, type MafiaRoomStateDTO } from "@puzzle/shared/mafia";
import { Check, Copy, Crown, Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/game/ui";
import { errorText } from "@/lib/mafia/text";
import type { MafiaActions } from "@/lib/mafia/use-mafia-room";
import type { MafiaVoiceHandle } from "@/lib/mafia/use-mafia-voice";
import { cn } from "@/lib/utils";
import { VoiceControls } from "./voice-controls";

/** Gathering ten players: seats, invite link, ready flags and the host's start button. */
export function MafiaLobby({
  state,
  actions,
  voice,
}: {
  state: MafiaRoomStateDTO;
  actions: MafiaActions;
  voice: MafiaVoiceHandle;
}) {
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const me = state.members.find((m) => m.id === state.you);
  const seated = state.members.filter((m) => !m.spectator);
  const spectators = state.members.filter((m) => m.spectator);
  const notReady = seated.filter((m) => !m.isHost && (!m.ready || !m.connected)).length;
  const missing = MAFIA_PLAYERS - seated.length;
  const canStart = me?.isHost && missing === 0 && notReady === 0;
  const link = typeof window === "undefined" ? "" : window.location.href;

  const run = async (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    const result = await action();
    if (!result.ok) setError(errorText(result.error ?? ""));
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Havolani nusxalab bo'lmadi");
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-6">
      <header className="flex items-center justify-between">
        <Link href="/mafia" className="font-display text-xl font-bold">
          🕵️ Mafia
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted tabular-nums">
            {seated.length}/{MAFIA_PLAYERS} o&apos;yinchi
          </span>
          <VoiceControls handle={voice} />
        </div>
      </header>

      <h1 className="mt-8 font-display text-3xl font-bold">Stol yig&apos;ilmoqda</h1>
      <p className="mt-2 text-muted">
        O&apos;yin uchun aniq {MAFIA_PLAYERS} kishi kerak. Havolani do&apos;stlaringizga yuboring.
      </p>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => void copy()}
          className="flex flex-1 items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 py-2.5 font-medium shadow-soft-sm hover:bg-surface-muted"
        >
          {copied ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          {copied ? "Nusxalandi" : "Havolani nusxalash"}
        </button>
        <a
          href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("Mafia o'ynaymizmi? Stolga qo'shil:")}`}
          target="_blank"
          rel="noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-control bg-[#229ED9] px-4 py-2.5 font-medium text-white shadow-soft-sm hover:opacity-90"
        >
          <Send className="size-4" aria-hidden /> Telegram&apos;da yuborish
        </a>
      </div>

      <ol className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {Array.from({ length: MAFIA_PLAYERS }, (_, i) => (
          <SeatSlot
            key={i}
            member={seated[i]}
            you={state.you}
            speaking={seated[i] ? Boolean(voice.snapshot.speaking[seated[i]!.id]) : false}
          />
        ))}
      </ol>

      {spectators.length > 0 && (
        <p className="mt-4 text-sm text-muted">
          Tomoshabinlar: {spectators.map((m) => m.name).join(", ")}
        </p>
      )}

      {/* Sticky, so the main button stays in reach on a phone without scrolling past the seats. */}
      <div className="sticky bottom-0 -mx-4 mt-auto flex flex-col gap-3 border-t border-border bg-background/95 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        {error && (
          <p role="alert" className="text-center text-sm text-danger">
            {error}
          </p>
        )}
        {me?.isHost ? (
          <>
            <button
              type="button"
              disabled={!canStart}
              onClick={() => void run(actions.start)}
              className="rounded-control bg-primary px-6 py-3.5 text-lg font-semibold text-primary-foreground shadow-soft-lg transition-opacity disabled:opacity-50"
            >
              O&apos;yinni boshlash
            </button>
            <p className="text-center text-sm text-muted">
              {missing > 0
                ? `Yana ${missing} kishi kerak`
                : notReady > 0
                  ? `${notReady} kishi hali tayyor emas`
                  : "Hamma tayyor!"}
            </p>
          </>
        ) : me && !me.spectator ? (
          <button
            type="button"
            onClick={() => void run(() => actions.ready(!me.ready))}
            className={cn(
              "rounded-control px-6 py-3.5 text-lg font-semibold shadow-soft-lg transition-colors",
              me.ready
                ? "border border-border bg-surface text-foreground"
                : "bg-primary text-primary-foreground",
            )}
          >
            {me.ready ? "Tayyor emasman" : "Tayyorman"}
          </button>
        ) : (
          <p className="text-center text-muted">
            Stol to&apos;lgan: siz tomoshabinsiz. Joy bo&apos;shasa, stolga o&apos;tasiz.
          </p>
        )}
      </div>
    </div>
  );
}

function SeatSlot({
  member,
  you,
  speaking,
}: {
  member: MafiaMemberDTO | undefined;
  you: string;
  speaking: boolean;
}) {
  if (!member) {
    return (
      <li className="flex h-24 items-center justify-center rounded-card border border-dashed border-border text-sm text-muted">
        bo&apos;sh o&apos;rin
      </li>
    );
  }
  return (
    <li
      className={cn(
        "relative flex h-24 flex-col items-center justify-center gap-1 rounded-card border bg-surface p-2 text-center shadow-soft-sm",
        member.id === you ? "border-primary" : "border-border",
        !member.connected && "opacity-50",
        speaking && "ring-2 ring-snap",
      )}
    >
      <Avatar name={member.name} color={member.color} avatar={member.avatar} size="md" />
      <span className="max-w-full truncate text-sm font-medium">
        {member.name}
        {member.id === you && " (siz)"}
      </span>
      {member.isHost ? (
        <Crown className="absolute top-2 right-2 size-4 text-amber-500" aria-label="Stol egasi" />
      ) : (
        member.ready && (
          <Check className="absolute top-2 right-2 size-4 text-snap" aria-label="Tayyor" />
        )
      )}
    </li>
  );
}
