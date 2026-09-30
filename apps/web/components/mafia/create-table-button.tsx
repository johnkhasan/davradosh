"use client";

import { MAFIA_MAX_PLAYERS, MAFIA_MIN_PLAYERS, MAFIA_PLAYERS } from "@puzzle/shared/mafia";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IdentityDialog } from "@/components/identity-dialog";
import { API_URL } from "@/lib/env";
import { loadIdentity, type Identity } from "@/lib/identity";
import { castText } from "@/lib/mafia/text";
import { cn } from "@/lib/utils";

const SIZES = Array.from(
  { length: MAFIA_MAX_PLAYERS - MAFIA_MIN_PLAYERS + 1 },
  (_, i) => MAFIA_MIN_PLAYERS + i,
);

/** Creates a mafia table: pick the table size, give a name if needed, then open it. */
export function CreateTableButton() {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "size" | "name">("idle");
  const [size, setSize] = useState(MAFIA_PLAYERS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (identity: Identity) => {
    setStep("idle");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/mafia/rooms`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId: identity.clientId, tableSize: size }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { id } = (await res.json()) as { id: string };
      router.push(`/mafia/${id}`);
    } catch {
      setError("Stolni yaratib bo'lmadi. Birozdan keyin qayta urinib ko'ring.");
      setBusy(false);
    }
  };

  const next = () => {
    const identity = loadIdentity();
    if (identity) void create(identity);
    else setStep("name");
  };

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => setStep("size")}
        className="inline-flex items-center justify-center gap-2 rounded-control bg-primary px-7 py-3.5 text-lg font-semibold text-primary-foreground shadow-soft-lg transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      >
        {busy && <Loader2 className="size-5 animate-spin" aria-hidden />}
        Stol yaratish
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      {step === "size" && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setStep("idle")}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="table-size-title"
            className="mafia-enter w-full max-w-md rounded-card bg-surface p-6 text-left shadow-soft-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="table-size-title" className="font-display text-2xl font-bold">
              Necha kishilik stol?
            </h2>
            <p className="mt-1 text-sm text-muted">
              Rasmiy o&apos;yin {MAFIA_PLAYERS} kishi bilan o&apos;ynaladi. Kamroq yoki ko&apos;proq
              bo&apos;lsa, qoidalar o&apos;sha-o&apos;sha, faqat qoralar soni o&apos;zgaradi.
            </p>
            <div
              className="mt-5 grid grid-cols-4 gap-2"
              role="radiogroup"
              aria-label="O'yinchilar soni"
            >
              {SIZES.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={size === n}
                  onClick={() => setSize(n)}
                  className={cn(
                    "relative rounded-control border px-2 py-3 text-lg font-semibold tabular-nums transition-colors",
                    size === n
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-surface-muted",
                  )}
                >
                  {n}
                  {n === MAFIA_PLAYERS && (
                    <span
                      className={cn(
                        "absolute -top-2 left-1/2 -translate-x-1/2 rounded-full px-1.5 text-[10px] font-bold uppercase",
                        size === n ? "bg-white text-primary" : "bg-primary-soft text-primary",
                      )}
                    >
                      rasmiy
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p className="mt-4 rounded-control bg-surface-muted px-3 py-2 text-sm">
              {size} kishi: {castText(size)}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setStep("idle")}
                className="flex-1 rounded-control border border-border px-4 py-3 font-medium"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={next}
                className="flex-1 rounded-control bg-primary px-4 py-3 font-semibold text-primary-foreground"
              >
                Yaratish
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "name" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <IdentityDialog
            title="Stol yaratishdan oldin"
            description="Ismingiz boshqa o'yinchilarga stolda ko'rinadi."
            submitLabel="Stol yaratish"
            onSubmit={(identity) => void create(identity)}
            onCancel={() => setStep("idle")}
          />
        </div>
      )}
    </>
  );
}
