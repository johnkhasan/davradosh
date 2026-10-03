"use client";

import type {
  TableClientToServerEvents,
  TableResult,
  TableRoomStateDTO,
  TableServerToClientEvents,
} from "@puzzle/shared/games";
import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { Identity } from "@/lib/identity";
import { WS_URL } from "../env";

type TableSocket = Socket<TableServerToClientEvents, TableClientToServerEvents>;

export type TableConnection =
  "connecting" | "ready" | "reconnecting" | "not_found" | "banned" | "kicked" | "removed";

/**
 * Connects to the "/table" namespace, (re)joins the room and keeps the latest state the
 * server pushed for this person. `clockOffset` turns server times into local ones.
 */
export function useTableRoom(roomId: string, identity: Identity) {
  const [state, setState] = useState<TableRoomStateDTO | null>(null);
  const [connection, setConnection] = useState<TableConnection>("connecting");
  const [clockOffset, setClockOffset] = useState(0);
  const socketRef = useRef<TableSocket | null>(null);

  useEffect(() => {
    const socket: TableSocket = io(`${WS_URL}/table`, {
      transports: ["websocket"],
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    });
    socketRef.current = socket;
    let stopped = false;

    const accept = (next: TableRoomStateDTO) => {
      setClockOffset(Date.now() - next.serverNow);
      setState(next);
    };

    const join = async () => {
      const ack = await socket.emitWithAck("table:join", {
        roomId,
        clientId: identity.clientId,
        name: identity.name,
        color: identity.color,
        avatar: identity.avatar,
      });
      if (stopped) return;
      if (!ack.ok) {
        setConnection(ack.error === "banned" ? "banned" : "not_found");
        socket.disconnect();
        return;
      }
      accept(ack.state);
      setConnection("ready");
    };

    socket.on("connect", () => void join());
    socket.on("disconnect", () => {
      if (!stopped) setConnection((c) => (c === "ready" ? "reconnecting" : c));
    });
    socket.on("table:state", accept);
    socket.on("table:kicked", (reason) => {
      setConnection(reason === "other-tab" ? "kicked" : reason === "banned" ? "banned" : "removed");
      socket.disconnect();
    });

    return () => {
      stopped = true;
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, identity]);

  const actions = useMemo(() => {
    const call = (
      event: keyof TableClientToServerEvents,
      ...args: unknown[]
    ): Promise<TableResult> => {
      const socket = socketRef.current;
      if (!socket?.connected) return Promise.resolve({ ok: false, error: "invalid" });
      // The events are typed in the shared protocol; this is the one untyped bridge to them.
      const emitWithAck = socket.emitWithAck.bind(socket) as (
        event: string,
        ...rest: unknown[]
      ) => Promise<TableResult>;
      return emitWithAck(event, ...args);
    };
    return {
      ready: (ready: boolean) => call("table:ready", { ready }),
      start: () => call("table:start"),
      rematch: () => call("table:rematch"),
      move: (move: unknown) => call("table:move", { move }),
      resign: () => call("table:resign"),
      chat: (text: string) => call("table:chat", { text }),
      kick: (playerId: string, ban: boolean) => call("table:kick", { playerId, ban }),
      transferHost: (playerId: string) => call("table:transfer-host", { playerId }),
    };
  }, []);

  return { state, connection, clockOffset, actions };
}

export type TableActions = ReturnType<typeof useTableRoom>["actions"];
