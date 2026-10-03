"use client";

import type { MafiaMemberDTO, MafiaRoomStateDTO } from "@puzzle/shared/mafia";
import { Check, Copy, Crown, Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/game/ui";
import { castText, errorText, seatColumns } from "@/lib/mafia/text";
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
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const [managed, setManaged] = useState<MafiaMemberDTO | null>(null);
  const me = state.members.find((m) => m.id === state.you);
  const seated = state.members.filter((m) => !m.spectator);
  const spectators = state.members.filter((m) => m.spectator);
  const notReady = seated.filter((m) => !m.isHost && (!m.ready || !m.connected)).length;
  const missing = state.tableSize - seated.length;
  const canStart = me?.isHost && missing === 0 && notReady === 0;
  const link = typeof window === "undefined" ? "" : window.location.href;

  const run = async (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    const result = await action();
    if (!result.ok) setError(errorText(result.error ?? ""));
  };

  const copy = async (what: "link" | "code") => {
    try {
      await navigator.clipboard.writeText(what === "code" ? (state.code ?? "") : link);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setError(what === "code" ? "Kodni nusxalab bo'lmadi" : "Havolani nusxalab bo'lmadi");
    }
  };
  const shareText = state.code
    ? `Mafia o'ynaymizmi? Stol kodi: ${state.code}. Yoki havola orqali qo'shil:`
    : "Mafia o'ynaymizmi? Stolga qo'shil:";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-6">
      <header className="flex items-center justify-between">
        <Link href="/mafia" className="font-display text-xl font-bold">
          🕵️ Mafia
        </Link>
        <div className="flex items-center gap-3">
          {/* New tab: the rules must not take anyone away from the table. */}
          <a
            href="/mafia/qoidalar"
            target="_blank"
            rel="noopener"
            className="text-sm font-medium text-primary hover:underline"
          >
            📖 Qoidalar
          </a>
          <span className="text-sm text-muted tabular-nums">
            {seated.length}/{state.tableSize} o&apos;yinchi
          </span>
          <VoiceControls handle={voice} />
        </div>
      </header>

      <h1 className="mt-8 font-display text-3xl font-bold">Stol yig&apos;ilmoqda</h1>
      <p className="mt-2 text-muted">
        {state.tableSize} kishilik stol: {castText(state.tableSize)}.{" "}
        {state.code
          ? "Kodni yoki havolani do'stlaringizga yuboring."
          : "Havolani do'stlaringizga yuboring."}
      </p>

      {state.code && (
        <button
          type="button"
          onClick={() => void copy("code")}
          title="Nusxalash"
          aria-label={copied === "code" ? "Kod nusxalandi" : `Stol kodi ${state.code}, nusxalash`}
          className="mt-5 flex w-full items-center justify-between gap-4 rounded-card border border-border bg-surface px-5 py-4 text-left shadow-soft-sm transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          <span>
            <span className="block text-sm font-medium">Stol kodi</span>
            <span className="block text-xs text-muted">
              davradosh.uz/join sahifasida kiritiladi
            </span>
          </span>
          <span className="flex items-center gap-2 font-mono text-3xl font-bold tracking-[0.3em] tabular-nums">
            {state.code}
            {copied === "code" ? (
              <Check className="size-5 text-success" aria-hidden />
            ) : (
              <Copy className="size-5 text-muted" aria-hidden />
            )}
          </span>
        </button>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => void copy("link")}
          className="flex flex-1 items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 py-2.5 font-medium shadow-soft-sm hover:bg-surface-muted"
        >
          {copied === "link" ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          {copied === "link" ? "Nusxalandi" : "Havolani nusxalash"}
        </button>
        <a
          href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-control bg-[#229ED9] px-4 py-2.5 font-medium text-white shadow-soft-sm hover:opacity-90"
        >
          <Send className="size-4" aria-hidden /> Telegram&apos;da yuborish
        </a>
      </div>

      <ol className={cn("mt-8 grid grid-cols-2 gap-2", seatColumns(state.tableSize))}>
        {Array.from({ length: state.tableSize }, (_, i) => (
          <SeatSlot
            key={i}
            member={seated[i]}
            you={state.you}
            speaking={seated[i] ? Boolean(voice.snapshot.speaking[seated[i]!.id]) : false}
            onManage={me?.isHost ? setManaged : undefined}
          />
        ))}
      </ol>

      {spectators.length > 0 && (
        <p className="mt-4 flex flex-wrap items-center gap-1.5 text-sm text-muted">
          Tomoshabinlar:
          {spectators.map((m) =>
            me?.isHost ? (
              <button
                key={m.id}
                type="button"
                onClick={() => setManaged(m)}
                className="rounded-full bg-surface-muted px-2.5 py-0.5 text-foreground"
              >
                {m.name}
              </button>
            ) : (
              <span key={m.id}>{m.name}</span>
            ),
          )}
        </p>
      )}

      {managed && (
        <MemberMenu
          member={managed}
          onClose={() => setManaged(null)}
          onAction={(call) => {
            setManaged(null);
            void run(call);
          }}
          actions={actions}
        />
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

/** Host menu for one member: hand the room over, remove, or remove for good. */
function MemberMenu({
  member,
  onClose,
  onAction,
  actions,
}: {
  member: MafiaMemberDTO;
  onClose: () => void;
  onAction: (call: () => Promise<{ ok: boolean; error?: string }>) => void;
  actions: MafiaActions;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${member.name}: stol egasi amallari`}
        className="mafia-enter w-full max-w-sm rounded-card bg-surface p-5 shadow-soft-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <Avatar name={member.name} color={member.color} avatar={member.avatar} size="md" />
          <h2 className="font-display text-xl font-bold">{member.name}</h2>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {member.connected && (
            <button
              type="button"
              onClick={() => onAction(() => actions.transferHost(member.id))}
              className="flex items-center gap-2 rounded-control border border-border px-4 py-3 text-left font-medium"
            >
              <Crown className="size-4 text-amber-500" aria-hidden /> Stol egasi qilish
            </button>
          )}
          <button
            type="button"
            onClick={() => onAction(() => actions.kick(member.id, false))}
            className="rounded-control border border-border px-4 py-3 text-left font-medium"
          >
            👋 Stoldan chiqarish
          </button>
          <button
            type="button"
            onClick={() => onAction(() => actions.kick(member.id, true))}
            className="rounded-control bg-danger px-4 py-3 text-left font-semibold text-white"
          >
            🚫 Ban qilish (qayta kira olmaydi)
          </button>
          <button type="button" onClick={onClose} className="mt-1 px-4 py-2 text-muted">
            Bekor qilish
          </button>
        </div>
      </div>
    </div>
  );
}

function SeatSlot({
  member,
  you,
  speaking,
  onManage,
}: {
  member: MafiaMemberDTO | undefined;
  you: string;
  speaking: boolean;
  /** Set for the host: tapping another member opens the host menu. */
  onManage?: (member: MafiaMemberDTO) => void;
}) {
  if (!member) {
    return (
      <li className="flex h-24 items-center justify-center rounded-card border border-dashed border-border text-sm text-muted">
        bo&apos;sh o&apos;rin
      </li>
    );
  }
  const manage = onManage && member.id !== you ? () => onManage(member) : undefined;
  return (
    <li
      onClick={manage}
      onKeyDown={(e) => {
        if (manage && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          manage();
        }
      }}
      role={manage ? "button" : undefined}
      tabIndex={manage ? 0 : undefined}
      aria-label={manage ? `${member.name}: amallar` : undefined}
      className={cn(
        "relative flex h-24 flex-col items-center justify-center gap-1 rounded-card border bg-surface p-2 text-center shadow-soft-sm",
        member.id === you ? "border-primary" : "border-border",
        !member.connected && "opacity-50",
        speaking && "ring-2 ring-snap",
        manage &&
          "cursor-pointer hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
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
