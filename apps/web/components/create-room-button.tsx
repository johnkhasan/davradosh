"use client";

import { Loader2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { loadIdentity, type Identity } from "@/lib/identity";
import { cn } from "@/lib/utils";
import { IdentityDialog } from "./identity-dialog";

/** Creates a room with the built-in demo image (until the create wizard exists) and opens it. */
export function CreateRoomButton({
  pieces = 48,
  className,
}: {
  pieces?: number;
  className?: string;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (identity: Identity) => {
    setAsking(false);
    setBusy(true);
    setError(null);
    try {
      const { id } = await api.createRoom({ clientId: identity.clientId, imageId: "demo", pieces });
      router.push(`/room/${id}`);
    } catch {
      setError("Server bilan bog'lanib bo'lmadi. Birozdan keyin urinib ko'ring.");
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
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-control bg-primary px-6 py-3 font-medium text-primary-foreground shadow-soft-md transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none disabled:translate-y-0 disabled:opacity-70",
          className,
        )}
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <Users className="size-5" aria-hidden />
        )}
        Do&apos;stlar bilan o&apos;ynash
      </button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {asking && (
        <IdentityDialog
          onSubmit={(identity) => void create(identity)}
          onCancel={() => setAsking(false)}
        />
      )}
    </>
  );
}
