"use client";

import { ArrowRight, LoaderCircle, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { api, ApiError } from "@/lib/api";

/** Joins a room by the 4-digit code shown next to the invite button. */
export function JoinByCode({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const id = useId();
  const [code, setCode] = useState(() => initialCode.replace(/\D/g, "").slice(0, 4));
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
    <div
      className="fixed inset-0 flex items-center justify-center bg-background p-4"
      onKeyDown={(e) => e.key === "Escape" && router.push("/")}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-snap/10 to-success/10" />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-text`}
        onSubmit={(e) => {
          e.preventDefault();
          void join(code);
        }}
        className="relative w-full max-w-sm rounded-card border border-border bg-surface p-6 text-center shadow-soft-lg motion-safe:animate-[pop_180ms_ease-out] sm:p-8"
      >
        <Link
          href="/"
          aria-label="Yopish"
          className="absolute top-3 right-3 rounded-control p-2 text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          <X className="size-5" aria-hidden />
        </Link>
        <span className="text-4xl" aria-hidden>
          🧩
        </span>
        <h1 id={`${id}-title`} className="mt-3 font-display text-2xl font-bold">
          Xonaga qo&apos;shilish
        </h1>
        <p id={`${id}-text`} className="mt-1.5 text-sm text-muted">
          Do&apos;stingiz yuborgan 4 xonali kodni kiriting.
        </p>
        <label htmlFor={`${id}-code`} className="sr-only">
          Xona kodi
        </label>
        <input
          id={`${id}-code`}
          value={code}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, "").slice(0, 4);
            setCode(value);
            setError(null);
            // Four digits are all there is, so go right away.
            if (value.length === 4) void join(value);
          }}
          autoFocus
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          placeholder="0000"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-6 w-full rounded-control border border-border bg-background py-3 pr-4 pl-[calc(1rem+0.5em)] text-center font-mono text-4xl font-bold tracking-[0.5em] tabular-nums placeholder:text-muted/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none aria-invalid:border-danger"
        />
        <p id={`${id}-error`} role="alert" className="mt-2 min-h-5 text-sm text-danger">
          {error}
        </p>
        <button
          type="submit"
          disabled={code.length !== 4 || pending}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-control bg-primary px-5 py-3 text-lg font-semibold text-primary-foreground shadow-soft-md transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
        >
          {pending ? (
            <LoaderCircle className="size-5 animate-spin" aria-hidden />
          ) : (
            <ArrowRight className="size-5" aria-hidden />
          )}
          Qo&apos;shilish
        </button>
        <p className="mt-5 text-sm text-muted">
          Kodingiz yo&apos;qmi?{" "}
          <Link href="/create" className="font-medium text-primary hover:underline">
            O&apos;zingiz yarating
          </Link>
        </p>
      </form>
    </div>
  );
}
