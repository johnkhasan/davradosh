"use client";

import type { TableGameKind } from "@puzzle/shared/games";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { IdentityDialog } from "@/components/identity-dialog";
import { loadIdentity, type Identity } from "@/lib/identity";
import { createTableRoom } from "@/lib/table/api";
import { cn } from "@/lib/utils";

/**
 * Creates a room of `kind` and opens it, asking for a name first when needed. Games with
 * options pass `getOptions` (it may open their own dialog and return null to cancel).
 */
export function CreateTableButton({
  kind,
  options,
  getOptions,
  children = "Stol yaratish",
  className,
}: {
  kind: TableGameKind;
  options?: unknown;
  getOptions?: () => Promise<unknown | null>;
  children?: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const [naming, setNaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (identity: Identity) => {
    setNaming(false);
    setBusy(true);
    setError(null);
    try {
      const chosen = getOptions ? await getOptions() : options;
      if (chosen === null) return setBusy(false);
      router.push(await createTableRoom(kind, identity.clientId, chosen));
    } catch {
      setError("Stolni yaratib bo'lmadi. Birozdan keyin qayta urinib ko'ring.");
      setBusy(false);
    }
  };

  const start = () => {
    const identity = loadIdentity();
    if (identity) void create(identity);
    else setNaming(true);
  };

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={start}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-control bg-primary px-7 py-3.5 text-lg font-semibold text-primary-foreground shadow-soft-lg transition-transform hover:-translate-y-0.5 disabled:opacity-60",
          className,
        )}
      >
        {busy && <Loader2 className="size-5 animate-spin" aria-hidden />}
        {children}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      {naming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <IdentityDialog
            title="O'ynashdan oldin"
            description="Ismingiz boshqa o'yinchilarga ko'rinadi."
            submitLabel="Davom etish"
            onSubmit={(identity) => void create(identity)}
            onCancel={() => setNaming(false)}
          />
        </div>
      )}
    </>
  );
}
