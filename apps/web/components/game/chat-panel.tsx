"use client";

import { CHAT_MAX_LENGTH, type ChatMessageDTO } from "@puzzle/shared";
import { MessageCircle, SendHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { RoomController } from "@/lib/realtime/room-controller";
import { cn } from "@/lib/utils";

const time = (at: number) =>
  new Date(at).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });

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
}: {
  controller: RoomController;
  messages: ChatMessageDTO[];
  me: string;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    controller.setChatOpen(true);
    inputRef.current?.focus();
    return () => controller.setChatOpen(false);
  }, [controller]);

  // Keep the newest message in view.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (controller.sendChat(text)) setText("");
  };

  return (
    <section
      aria-label="Chat"
      className="absolute top-14 right-3 z-30 flex h-[min(28rem,calc(100%-5rem))] w-[min(22rem,calc(100vw-1.5rem))] flex-col rounded-card border border-border bg-surface shadow-soft-lg motion-safe:animate-[pop_150ms_ease-out] max-sm:inset-x-3 max-sm:top-auto max-sm:bottom-3 max-sm:h-[60dvh] max-sm:w-auto"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="font-display font-bold">Chat</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          className="rounded-md p-1 text-muted hover:text-foreground"
        >
          <X className="size-4" />
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
                  "max-w-[85%] rounded-2xl px-3 py-1.5 text-sm break-words",
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

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-border p-2">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={CHAT_MAX_LENGTH}
          placeholder="Xabar yozing…"
          aria-label="Xabar"
          enterKeyHint="send"
          className="min-w-0 flex-1 rounded-control border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Yuborish"
          className="flex size-9 shrink-0 items-center justify-center rounded-control bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
        >
          <SendHorizontal className="size-4" aria-hidden />
        </button>
      </form>
    </section>
  );
}
