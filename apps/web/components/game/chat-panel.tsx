"use client";

import {
  CHAT_MAX_LENGTH,
  REACTION_EMOJIS,
  type ChatMessageDTO,
  type ReactionEmoji,
} from "@puzzle/shared";
import { MessageCircle, SendHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { RoomController } from "@/lib/realtime/room-controller";
import { cn } from "@/lib/utils";
import { ReactionButton } from "./reactions";

const time = (at: number) =>
  new Date(at).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });

/**
 * How much of the page the on-screen keyboard covers. iOS Safari overlays the
 * keyboard without resizing the page, so a bottom sheet would sit under it.
 */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () =>
      setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

/** Header button with the unread badge. */
export function ChatButton({
  unread,
  open,
  onClick,
}: {
  unread: number;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      data-chat-toggle
      title="Chat (Enter)"
      aria-label={unread ? `Chat, ${unread} ta yangi xabar` : "Chat"}
      className={cn(
        "relative flex items-center rounded-control px-2 py-1.5 text-muted transition-colors hover:bg-surface-muted hover:text-foreground",
        open && "bg-surface-muted text-foreground",
      )}
    >
      <MessageCircle className="size-4" aria-hidden />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white tabular-nums">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

/** Room chat: recent messages and a single-line input. Players and viewers can write. */
export function ChatPanel({
  controller,
  messages,
  me,
  onClose,
  onReact,
}: {
  controller: RoomController;
  messages: ChatMessageDTO[];
  me: string;
  onClose: () => void;
  onReact: (emoji: ReactionEmoji) => void;
}) {
  const [text, setText] = useState("");
  const keyboard = useKeyboardInset();
  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    controller.setChatOpen(true);
    // Phones: no automatic keyboard over the table; a tap on the field opens it.
    if (!window.matchMedia("(pointer: coarse)").matches) inputRef.current?.focus();
    return () => controller.setChatOpen(false);
  }, [controller]);

  // Keep the newest message in view.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length]);

  // The keyboard makes the list shorter (Android resizes the page, iOS moves the sheet): stay at the bottom.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const observer = new ResizeObserver(() => (list.scrollTop = list.scrollHeight));
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (controller.sendChat(text)) setText("");
    // Keep the keyboard up for the next message.
    inputRef.current?.focus();
  };

  return (
    <section
      aria-label="Chat"
      style={
        keyboard > 0
          ? { bottom: keyboard + 8, maxHeight: `calc(100% - ${keyboard + 16}px)` }
          : undefined
      }
      className="absolute top-14 right-3 z-30 flex h-[min(28rem,calc(100%-5rem))] w-[min(22rem,calc(100vw-1.5rem))] flex-col rounded-card border border-border bg-surface shadow-soft-lg motion-safe:animate-[pop_150ms_ease-out] max-sm:inset-x-2 max-sm:top-auto max-sm:bottom-2 max-sm:h-[min(60dvh,32rem)] max-sm:w-auto"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <header className="flex items-center justify-between border-b border-border py-1.5 pr-1.5 pl-4">
        <h2 className="font-display font-bold">Chat</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          className="flex size-10 items-center justify-center rounded-control text-muted hover:bg-surface-muted hover:text-foreground"
        >
          <X className="size-5" />
        </button>
      </header>

      <ol ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3" aria-live="polite">
        {messages.length === 0 && (
          <li className="mt-8 text-center text-sm text-muted">
            Hali xabar yo&apos;q. Birinchi bo&apos;lib yozing! 👋
          </li>
        )}
        {messages.map((message, index) => {
          const mine = message.playerId === me;
          const grouped =
            index > 0 &&
            messages[index - 1]!.playerId === message.playerId &&
            message.at - messages[index - 1]!.at < 60_000;
          return (
            <li
              key={message.id}
              className={cn(
                "flex flex-col",
                mine ? "items-end" : "items-start",
                grouped && "-mt-1.5",
              )}
            >
              {!grouped && (
                <span className="mb-0.5 flex items-center gap-1.5 px-1 text-xs text-muted">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: message.color }}
                    aria-hidden
                  />
                  <span className="font-medium text-foreground">{mine ? "Siz" : message.name}</span>
                  <time dateTime={new Date(message.at).toISOString()}>{time(message.at)}</time>
                </span>
              )}
              <p
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-1.5 break-words max-sm:text-[15px] sm:text-sm",
                  mine
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md bg-surface-muted",
                )}
              >
                {message.text}
              </p>
            </li>
          );
        })}
      </ol>

      {/* Phones only: the reaction bar under the table is desktop-only. */}
      <div
        role="toolbar"
        aria-label="Reaksiyalar"
        className="flex justify-between gap-0.5 border-t border-border px-1.5 py-1 sm:hidden"
      >
        {REACTION_EMOJIS.map((emoji, index) => (
          <ReactionButton key={emoji} emoji={emoji} index={index} onReact={onReact} />
        ))}
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-border p-2">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={CHAT_MAX_LENGTH}
          placeholder="Xabar yozing…"
          aria-label="Xabar"
          enterKeyHint="send"
          autoComplete="off"
          // 16px on phones: smaller text makes iOS zoom the page in on focus.
          className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 sm:py-2 sm:text-sm"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Yuborish"
          // Keeps the keyboard open: without this the tap blurs the field first.
          onPointerDown={(e) => e.preventDefault()}
          className="flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40 sm:size-9"
        >
          <SendHorizontal className="size-5 sm:size-4" aria-hidden />
        </button>
      </form>
    </section>
  );
}
