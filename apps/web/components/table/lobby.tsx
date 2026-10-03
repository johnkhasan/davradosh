"use client";

import { TABLE_GAMES, type TableMemberDTO, type TableRoomStateDTO } from "@puzzle/shared/games";
import { Check, Copy, Crown, Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/game/ui";
import { errorText, playersText } from "@/lib/table/text";
import type { TableActions } from "@/lib/table/use-table-room";
import { cn } from "@/lib/utils";
import { TableChat } from "./chat";
import { GAME_TEXTS } from "./games";
import { MemberMenu } from "./member-menu";

/** Gathering players: seats, invite link, ready flags, chat and the host's start button. */
export function TableLobby({
  state,
  actions,
}: {
  state: TableRoomStateDTO;
  actions: TableActions;
}) {
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [managed, setManaged] = useState<TableMemberDTO | null>(null);
  const info = TABLE_GAMES[state.kind];
  const texts = GAME_TEXTS[state.kind];
  const me = state.members.find((m) => m.id === state.you);
  const seated = state.members.filter((m) => !m.spectator);
  const spectators = state.members.filter((m) => m.spectator);
  const notReady = seated.filter((m) => !m.isHost && (!m.ready || !m.connected)).length;
  const missing = Math.max(0, state.minPlayers - seated.length);
  const canStart = me?.isHost && missing === 0 && notReady === 0;
  const link = typeof window === "undefined" ? "" : window.location.href;
  const optionsLine = texts.optionsText?.(state.options) ?? null;
  const slots = Math.max(state.minPlayers, Math.min(state.maxPlayers, seated.length + 1));

  const run = async (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    const result = await action();
    if (!result.ok) setError(errorText(result.error ?? "", texts.ERRORS));
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
        <Link href={info.path} className="font-display text-xl font-bold">
          {info.emoji} {info.name}
        </Link>
        <span className="text-sm text-muted tabular-nums">
          {seated.length}/{state.maxPlayers} o&apos;yinchi
        </span>
      </header>

      <h1 className="mt-8 font-display text-3xl font-bold">Stol yig&apos;ilmoqda</h1>
      <p className="mt-2 text-muted">
        {playersText(state.minPlayers, state.maxPlayers)} o&apos;yin
        {optionsLine ? ` · ${optionsLine}` : ""}. Havolani do&apos;stlaringizga yuboring.
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
          href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(`${info.name} o'ynaymizmi? Stolga qo'shil:`)}`}
          target="_blank"
          rel="noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-control bg-[#229ED9] px-4 py-2.5 font-medium text-white shadow-soft-sm hover:opacity-90"
        >
          <Send className="size-4" aria-hidden /> Telegram&apos;da yuborish
        </a>
      </div>

      <ol
        className={cn("mt-8 grid gap-2", slots <= 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}
      >
        {Array.from({ length: slots }, (_, i) => (
          <SeatSlot
            key={seated[i]?.id ?? `empty-${i}`}
            member={seated[i]}
            you={state.you}
            onManage={me?.isHost ? setManaged : undefined}
          />
        ))}
      </ol>

      {spectators.length > 0 && (
        <p className="mt-4 flex flex-wrap items-center gap-1.5 text-sm text-muted">
          Tomoshabinlar:
          {spectators.map((m) =>
            me?.isHost && m.id !== state.you ? (
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

      {texts.HOW_TO && (
        <p className="mt-6 rounded-card bg-surface-muted px-4 py-3 text-sm leading-relaxed">
          <span className="font-semibold">Qanday o&apos;ynaladi: </span>
          {texts.HOW_TO}
        </p>
      )}

      <TableChat
        className="mt-6 h-56"
        messages={state.chat}
        you={state.you}
        onSend={(text) => run(() => actions.chat(text))}
      />

      {managed && (
        <MemberMenu
          member={managed}
          actions={actions}
          onClose={() => setManaged(null)}
          onAction={(call) => {
            setManaged(null);
            void run(call);
          }}
        />
      )}

      <div className="sticky bottom-0 -mx-4 mt-6 flex flex-col gap-3 border-t border-border bg-background/95 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
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
  onManage,
}: {
  member: TableMemberDTO | undefined;
  you: string;
  onManage?: (member: TableMemberDTO) => void;
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
        manage &&
          "cursor-pointer hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
      )}
    >
      <Avatar name={member.name} color={member.color} avatar={member.avatar} size="md" />
      <span className="max-w-full truncate text-sm font-medium">
        {member.name}
        {member.id === you && " (siz)"}
      </span>
      {member.wins > 0 && (
        <span className="absolute top-2 left-2 text-xs font-semibold text-muted tabular-nums">
          🏆{member.wins}
        </span>
      )}
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
