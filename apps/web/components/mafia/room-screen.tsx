"use client";

import Link from "next/link";
import { useState } from "react";
import { IdentityDialog } from "@/components/identity-dialog";
import { PuzzleLoader } from "@/components/puzzle-loader";
import { loadIdentity, type Identity } from "@/lib/identity";
import { useMafiaRoom } from "@/lib/mafia/use-mafia-room";
import { MafiaGameScreen } from "./game-screen";
import { MafiaLobby } from "./lobby";

/** Asks for a name once, then connects to the room and shows the lobby or the table. */
export function MafiaRoomScreen({ roomId }: { roomId: string }) {
  const [identity, setIdentity] = useState<Identity | null>(() => loadIdentity());

  if (!identity) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-4">
        <IdentityDialog
          title="Stolga o'tirishdan oldin"
          description="Ismingiz boshqa o'yinchilarga stolda ko'rinadi."
          submitLabel="Stolga o'tirish"
          onSubmit={setIdentity}
        />
      </div>
    );
  }
  return <ConnectedRoom roomId={roomId} identity={identity} />;
}

function ConnectedRoom({ roomId, identity }: { roomId: string; identity: Identity }) {
  const { state, connection, clockOffset, actions } = useMafiaRoom(roomId, identity);

  if (connection === "not_found" || connection === "banned" || connection === "kicked") {
    const text = {
      not_found: ["🔍", "Stol topilmadi", "Havola noto'g'ri yoki stol muddati tugagan."],
      banned: ["🚫", "Kirish taqiqlangan", "Stol egasi sizni chiqarib yuborgan."],
      kicked: ["🪟", "Boshqa oynada ochildi", "Bu stol boshqa tab yoki qurilmada ochildi."],
    }[connection];
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <div className="text-5xl" aria-hidden>
          {text[0]}
        </div>
        <h1 className="font-display text-2xl font-bold">{text[1]}</h1>
        <p className="max-w-sm text-muted">{text[2]}</p>
        <Link
          href="/mafia"
          className="mt-3 rounded-control bg-primary px-5 py-2.5 font-medium text-primary-foreground"
        >
          Yangi stol
        </Link>
      </div>
    );
  }

  if (!state) return <PuzzleLoader label="Stolga ulanmoqda" />;

  return (
    <>
      {connection === "reconnecting" && (
        <div
          role="status"
          className="fixed top-3 left-1/2 z-50 -translate-x-1/2 rounded-full bg-amber-500 px-4 py-1.5 text-sm font-medium text-white shadow-soft-md"
        >
          Aloqa uzildi. Qayta ulanmoqda…
        </div>
      )}
      {state.status === "lobby" || !state.game ? (
        <MafiaLobby state={state} actions={actions} />
      ) : (
        <MafiaGameScreen state={state} clockOffset={clockOffset} actions={actions} />
      )}
    </>
  );
}
