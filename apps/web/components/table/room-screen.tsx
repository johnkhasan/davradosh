"use client";

import { TABLE_GAMES, type TableGameKind } from "@puzzle/shared/games";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IdentityDialog } from "@/components/identity-dialog";
import { PuzzleLoader } from "@/components/puzzle-loader";
import { loadIdentity, type Identity } from "@/lib/identity";
import { useTableRoom } from "@/lib/table/use-table-room";
import { TableGameScreen } from "./game-screen";
import { TableLobby } from "./lobby";

/** Asks for a name once, then connects to the room and shows the lobby or the game. */
export function TableRoomScreen({ roomId, kind }: { roomId: string; kind: TableGameKind }) {
  const [identity, setIdentity] = useState<Identity | null>(() => loadIdentity());

  if (!identity) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-4">
        <IdentityDialog
          title="Stolga o'tirishdan oldin"
          description="Ismingiz boshqa o'yinchilarga ko'rinadi."
          submitLabel="Stolga o'tirish"
          onSubmit={setIdentity}
        />
      </div>
    );
  }
  return <ConnectedRoom roomId={roomId} kind={kind} identity={identity} />;
}

function ConnectedRoom({
  roomId,
  kind,
  identity,
}: {
  roomId: string;
  kind: TableGameKind;
  identity: Identity;
}) {
  const router = useRouter();
  const { state, connection, clockOffset, actions } = useTableRoom(roomId, identity);
  const info = TABLE_GAMES[kind];

  // A link with the wrong game in its path still opens the right page.
  const actualKind = state?.kind;
  useEffect(() => {
    if (actualKind && actualKind !== kind)
      router.replace(`${TABLE_GAMES[actualKind].path}/${roomId}`);
  }, [actualKind, kind, roomId, router]);

  if (connection !== "ready" && connection !== "reconnecting" && connection !== "connecting") {
    const text = {
      not_found: ["🔍", "Stol topilmadi", "Havola noto'g'ri yoki stol muddati tugagan."],
      banned: ["🚫", "Kirish taqiqlangan", "Stol egasi sizni chiqarib yuborgan."],
      kicked: ["🪟", "Boshqa oynada ochildi", "Bu stol boshqa tab yoki qurilmada ochildi."],
      removed: [
        "👋",
        "Sizni stoldan chiqarishdi",
        "Stol egasi sizni chiqardi. Qayta kirishingiz mumkin.",
      ],
    }[connection];
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <div className="text-5xl" aria-hidden>
          {text[0]}
        </div>
        <h1 className="font-display text-2xl font-bold">{text[1]}</h1>
        <p className="max-w-sm text-muted">{text[2]}</p>
        <Link
          href={info.path}
          className="mt-3 rounded-control bg-primary px-5 py-2.5 font-medium text-primary-foreground"
        >
          Yangi stol
        </Link>
      </div>
    );
  }

  if (!state || state.kind !== kind) return <PuzzleLoader label="Stolga ulanmoqda" />;

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
        <TableLobby state={state} actions={actions} />
      ) : (
        <TableGameScreen
          state={state}
          game={state.game}
          clockOffset={clockOffset}
          actions={actions}
        />
      )}
    </>
  );
}
