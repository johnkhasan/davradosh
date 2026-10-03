"use client";

import { TABLE_CHAT_MAX, type TableChatMessage } from "@puzzle/shared/games";
import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** The room chat: last messages and a one-line input. */
export function TableChat({
  messages,
  you,
  onSend,
  className,
}: {
  messages: TableChatMessage[];
  you: string;
  onSend: (text: string) => Promise<unknown>;
  className?: string;
}) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLOListElement>(null);
  const last = messages.at(-1)?.id;

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [last]);

  const send = () => {
    const value = text.trim();
    if (!value) return;
    setText("");
    void onSend(value);
  };

  return (
    <section
      aria-label="Chat"
      className={cn(
        "flex min-h-0 flex-col rounded-card border border-border bg-surface",
        className,
      )}
    >
      <ol
        ref={listRef}
        className="flex min-h-24 flex-1 flex-col gap-1.5 overflow-y-auto p-3 text-sm"
      >
        {messages.length === 0 && <li className="m-auto text-muted">Hali xabar yo&apos;q</li>}
        {messages.map((m) => (
          <li key={m.id} className="break-words">
            <span className="font-semibold" style={{ color: m.color }}>
              {m.playerId === you ? "Siz" : m.name}:
            </span>{" "}
            {m.text}
          </li>
        ))}
      </ol>
      <form
        className="flex gap-2 border-t border-border p-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={TABLE_CHAT_MAX}
          placeholder="Xabar yozing…"
          aria-label="Xabar"
          className="min-w-0 flex-1 rounded-control bg-surface-muted px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <button
          type="submit"
          aria-label="Yuborish"
          className="rounded-control bg-primary px-3 text-primary-foreground disabled:opacity-50"
          disabled={!text.trim()}
        >
          <Send className="size-4" aria-hidden />
        </button>
      </form>
    </section>
  );
}
