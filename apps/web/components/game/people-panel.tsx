"use client";

import type { PlayerDTO, PlayerRole } from "@puzzle/shared";
import {
  Ban,
  Crown,
  Eye,
  RotateCcw,
  UserMinus,
  UserRoundPlus,
  UserX,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { RoomController } from "@/lib/realtime/room-controller";
import { cn } from "@/lib/utils";
import { Avatar } from "./ui";

interface PeoplePanelProps {
  controller: RoomController;
  players: PlayerDTO[];
  me: string;
  maxPlayers: number;
  following: string | null;
  onClose: () => void;
}

/**
 * Everyone in the room, split into players (seats) and viewers. The host can
 * move people between the two, kick (optionally banning) and restart the puzzle.
 */
export function PeoplePanel({
  controller,
  players,
  me,
  maxPlayers,
  following,
  onClose,
}: PeoplePanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isHost = players.find((p) => p.id === me)?.isHost ?? false;
  const seated = players.filter((p) => p.role === "player");
  const viewers = players.filter((p) => p.role === "viewer");
  const freeSeat = seated.length < maxPlayers;
  const [confirmRestart, setConfirmRestart] = useState(false);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Element;
      // The header toggle handles its own clicks.
      if (target.closest?.("[data-people-toggle]")) return;
      if (ref.current && !ref.current.contains(target)) onClose();
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const row = (player: PlayerDTO) => (
    <PersonRow
      key={player.id}
      player={player}
      isMe={player.id === me}
      isHost={isHost}
      freeSeat={freeSeat}
      following={following === player.id}
      controller={controller}
    />
  );

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Xonadagilar"
      className="absolute top-14 right-3 z-30 w-[min(22rem,calc(100vw-1.5rem))] rounded-card border border-border bg-surface p-3 shadow-soft-lg motion-safe:animate-[pop_150ms_ease-out]"
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="font-display font-bold">Xonadagilar</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          className="rounded-md p-1 text-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <Section title={`O'yinchilar`} count={`${seated.length}/${maxPlayers}`}>
        {seated.map(row)}
        {freeSeat && (
          <p className="px-2 py-1.5 text-xs text-muted">
            {maxPlayers - seated.length} ta bo&apos;sh joy · havolani ulashing yoki tomoshabinni
            o&apos;yinchi qiling
          </p>
        )}
      </Section>

      <Section title="Tomoshabinlar" count={String(viewers.length)}>
        {viewers.length ? (
          viewers.map(row)
        ) : (
          <p className="px-2 py-1.5 text-xs text-muted">
            Joylar to&apos;lganda keyingilar shu yerda kuzatib turadi.
          </p>
        )}
      </Section>

      {isHost && (
        <div className="mt-2 border-t border-border pt-2">
          {confirmRestart ? (
            <div className="flex items-center gap-2 rounded-control bg-danger/10 p-2 text-sm">
              <span className="flex-1">
                Hamma bo&apos;laklar qayta aralashtiriladi. Davom etamizmi?
              </span>
              <button
                type="button"
                onClick={() => {
                  setConfirmRestart(false);
                  void controller.restart();
                  onClose();
                }}
                className="rounded-md bg-danger px-2.5 py-1 font-medium text-white"
              >
                Ha
              </button>
              <button
                type="button"
                onClick={() => setConfirmRestart(false)}
                className="rounded-md px-2 py-1 font-medium"
              >
                Yo&apos;q
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmRestart(true)}
              className="flex w-full items-center gap-2 rounded-control px-2 py-2 text-sm font-medium hover:bg-surface-muted"
            >
              <RotateCcw className="size-4" aria-hidden /> Puzzle&apos;ni qaytadan boshlash
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-2">
      <h3 className="flex items-center justify-between px-2 py-1 text-xs font-semibold tracking-wide text-muted uppercase">
        {title} <span className="tabular-nums">{count}</span>
      </h3>
      <ul>{children}</ul>
    </section>
  );
}

function PersonRow({
  player,
  isMe,
  isHost,
  freeSeat,
  following,
  controller,
}: {
  player: PlayerDTO;
  isMe: boolean;
  isHost: boolean;
  freeSeat: boolean;
  following: boolean;
  controller: RoomController;
}) {
  const [confirmKick, setConfirmKick] = useState(false);
  const moveTo = (role: PlayerRole) => void controller.setRole(player.id, role);

  return (
    <li className="group rounded-control px-2 py-1.5 hover:bg-surface-muted">
      <div className="flex items-center gap-2">
        <Avatar
          name={player.name}
          color={player.color}
          avatar={player.avatar}
          size="sm"
          dimmed={!player.connected}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {player.name}
            {isMe && <span className="text-muted"> (siz)</span>}
            {player.isHost && <span title="Host"> 👑</span>}
          </div>
          {!player.connected && (
            <div className="text-xs text-muted">uzilgan · joyi saqlanmoqda</div>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {!isMe && player.connected && player.role === "player" && (
            <IconButton
              label={following ? "Kuzatishni to'xtatish" : "Ekranini kuzatish"}
              active={following}
              onClick={() => controller.follow(following ? null : player.id)}
            >
              <Eye />
            </IconButton>
          )}
          {isMe && player.role === "player" && !player.isHost && (
            <IconButton
              label="Joyni bo'shatib, tomosha qilish"
              onClick={() => void controller.leaveSeat()}
            >
              <UserMinus />
            </IconButton>
          )}
          {isMe && player.role === "viewer" && freeSeat && (
            <IconButton label="O'yinchi bo'lish" onClick={() => void controller.claimSeat()}>
              <UserRoundPlus />
            </IconButton>
          )}
          {isHost && !isMe && player.role === "player" && (
            <IconButton label="Tomoshabinga o'tkazish" onClick={() => moveTo("viewer")}>
              <UserMinus />
            </IconButton>
          )}
          {isHost && !isMe && player.role === "viewer" && (
            <IconButton
              label={freeSeat ? "O'yinchi qilish" : "Bo'sh joy yo'q"}
              disabled={!freeSeat}
              onClick={() => moveTo("player")}
            >
              <UserRoundPlus />
            </IconButton>
          )}
          {isHost && !isMe && player.connected && (
            <IconButton label="Host qilish" onClick={() => void controller.transferHost(player.id)}>
              <Crown />
            </IconButton>
          )}
          {isHost && !isMe && (
            <IconButton
              label="Chiqarib yuborish"
              onClick={() => setConfirmKick((v) => !v)}
              active={confirmKick}
            >
              <UserX />
            </IconButton>
          )}
        </div>
      </div>

      {confirmKick && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-9 text-xs">
          <button
            type="button"
            onClick={() => void controller.kick(player.id, false)}
            className="rounded-md border border-border px-2 py-1 font-medium hover:bg-surface"
          >
            Chiqarish
          </button>
          <button
            type="button"
            onClick={() => void controller.kick(player.id, true)}
            className="flex items-center gap-1 rounded-md bg-danger px-2 py-1 font-medium text-white"
          >
            <Ban className="size-3" aria-hidden /> Chiqarish va bloklash
          </button>
          <button
            type="button"
            onClick={() => setConfirmKick(false)}
            className="px-1.5 py-1 text-muted"
          >
            Bekor
          </button>
        </div>
      )}
    </li>
  );
}

function IconButton({
  label,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:opacity-40 [&_svg]:size-4",
        active && "bg-primary-soft text-primary",
      )}
    >
      {children}
    </button>
  );
}

/** Shown to viewers: explains why they can't grab pieces and offers a free seat. */
export function ViewerBanner({
  controller,
  seated,
  maxPlayers,
}: {
  controller: RoomController;
  seated: number;
  maxPlayers: number;
}) {
  const free = seated < maxPlayers;
  return (
    <div
      role="status"
      className="absolute top-3 left-1/2 z-20 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-surface/95 py-1.5 pr-1.5 pl-4 text-sm shadow-soft-md backdrop-blur"
    >
      <Eye className="size-4 shrink-0 text-primary" aria-hidden />
      <span className="truncate">
        {free
          ? "Siz tomoshabinsiz · bo'sh joy bor"
          : `Tomoshabin rejimi · o'yinchilar to'la (${seated}/${maxPlayers})`}
      </span>
      {free && (
        <button
          type="button"
          onClick={() => void controller.claimSeat()}
          className="shrink-0 rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground"
        >
          O&apos;yinchi bo&apos;lish
        </button>
      )}
    </div>
  );
}

/** Header button that opens the people panel; shows the viewer count. */
export function PeopleButton({
  viewers,
  onClick,
  open,
}: {
  viewers: number;
  onClick: () => void;
  open: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      data-people-toggle
      title="Xonadagilar"
      className={cn(
        "flex items-center gap-1 rounded-control px-2 py-1.5 text-sm text-muted transition-colors hover:bg-surface-muted hover:text-foreground",
        open && "bg-surface-muted text-foreground",
      )}
    >
      <Users className="size-4" aria-hidden />
      {viewers > 0 && (
        <span className="flex items-center gap-0.5 tabular-nums">
          <Eye className="size-3.5" aria-hidden /> {viewers}
        </span>
      )}
    </button>
  );
}
