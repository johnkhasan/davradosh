"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IdentityDialog } from "@/components/identity-dialog";
import { API_URL } from "@/lib/env";
import { loadIdentity, type Identity } from "@/lib/identity";

/** Creates a mafia table (asking for a name first if needed) and opens it. */
export function CreateTableButton() {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (identity: Identity) => {
    setAsking(false);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/mafia/rooms`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId: identity.clientId }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { id } = (await res.json()) as { id: string };
      router.push(`/mafia/${id}`);
    } catch {
      setError("Stolni yaratib bo'lmadi. Birozdan keyin qayta urinib ko'ring.");
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          const identity = loadIdentity();
          if (identity) void create(identity);
          else setAsking(true);
        }}
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
      {asking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <IdentityDialog
            title="Stol yaratishdan oldin"
            description="Ismingiz boshqa o'yinchilarga stolda ko'rinadi."
            submitLabel="Stol yaratish"
            onSubmit={(identity) => void create(identity)}
            onCancel={() => setAsking(false)}
          />
        </div>
      )}
    </>
  );
}
