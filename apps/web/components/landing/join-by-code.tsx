"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Joins a room by the 4-digit code shown next to the invite button. */
export function JoinByCode({ className }: { className?: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async (value: string) => {
    if (!/^\d{4}$/.test(value) || pending) return;
    setPending(true);
    setError(null);
    try {
      const { id } = await api.findRoomByCode(value);
      router.push(`/room/${id}`);
    } catch (e) {
      setPending(false);
      if (e instanceof ApiError && e.status === 404) setError("Bunday kodli xona topilmadi");
      else if (e instanceof ApiError && e.status === 429)
        setError("Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring");
      else setError("Serverga ulanib bo'lmadi");
    }
  };

  return (
    <form
      className={cn("flex flex-col gap-1.5", className)}
      onSubmit={(e) => {
        e.preventDefault();
        void join(code);
      }}
    >
      <label htmlFor="room-code" className="text-sm text-muted">
        Do&apos;stingiz kod yubordimi?
      </label>
      <div className="flex gap-2">
        <input
          id="room-code"
          value={code}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, "").slice(0, 4);
            setCode(value);
            setError(null);
            // Four digits are all there is, so go right away.
            if (value.length === 4) void join(value);
          }}
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          placeholder="0000"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "room-code-error" : undefined}
          className="w-32 rounded-control border border-border bg-surface px-4 py-2.5 text-center font-mono text-lg font-semibold tracking-[0.4em] tabular-nums shadow-soft-sm placeholder:text-muted/50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none aria-invalid:border-danger"
        />
        <button
          type="submit"
          disabled={code.length !== 4 || pending}
          className="flex items-center gap-1.5 rounded-control bg-foreground px-4 py-2.5 font-medium text-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-40"
        >
          {pending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
          ) : (
            <ArrowRight className="size-4" aria-hidden />
          )}
          Qo&apos;shilish
        </button>
      </div>
      {error && (
        <p id="room-code-error" role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
