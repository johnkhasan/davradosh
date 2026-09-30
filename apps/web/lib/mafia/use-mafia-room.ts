"use client";

import type {
  MafiaActionResult,
  MafiaClientToServerEvents,
  MafiaRoomResult,
  MafiaRoomStateDTO,
  MafiaServerToClientEvents,
} from "@puzzle/shared/mafia";
import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { Identity } from "@/lib/identity";
import { WS_URL } from "../env";

type MafiaSocket = Socket<MafiaServerToClientEvents, MafiaClientToServerEvents>;

export type MafiaConnection =
  "connecting" | "ready" | "reconnecting" | "not_found" | "banned" | "kicked" | "removed";

/**
 * Connects to the "/mafia" namespace, (re)joins the room and keeps the latest state the
 * server pushed for this person. `clockOffset` turns server times (endsAt) into local ones.
 */
export function useMafiaRoom(roomId: string, identity: Identity) {
  const [state, setState] = useState<MafiaRoomStateDTO | null>(null);
  const [connection, setConnection] = useState<MafiaConnection>("connecting");
  const [clockOffset, setClockOffset] = useState(0);
  const socketRef = useRef<MafiaSocket | null>(null);

  useEffect(() => {
    const socket: MafiaSocket = io(`${WS_URL}/mafia`, {
      transports: ["websocket"],
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    });
    socketRef.current = socket;
    let stopped = false;

    const accept = (next: MafiaRoomStateDTO) => {
      setClockOffset(Date.now() - next.serverNow);
      setState(next);
    };

    const join = async () => {
      const ack = await socket.emitWithAck("mafia:join", {
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
    socket.on("mafia:state", accept);
    socket.on("mafia:kicked", (reason) => {
      // Another tab of ours took over, or the host removed us (for good with a ban).
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
    type Result = MafiaActionResult | MafiaRoomResult;
    const call = (event: keyof MafiaClientToServerEvents, ...args: unknown[]): Promise<Result> => {
      const socket = socketRef.current;
      if (!socket?.connected) return Promise.resolve({ ok: false, error: "invalid" });
      // The events are typed in the shared protocol; this is the one untyped bridge to them.
      const emitWithAck = socket.emitWithAck.bind(socket) as (
        event: string,
        ...rest: unknown[]
      ) => Promise<Result>;
      return emitWithAck(event, ...args);
    };
    return {
      ready: (ready: boolean) => call("mafia:ready", { ready }),
      start: () => call("mafia:start"),
      rematch: () => call("mafia:rematch"),
      pass: () => call("mafia:pass"),
      nominate: (seat: number) => call("mafia:nominate", { seat }),
      vote: (seat: number) => call("mafia:vote", { seat }),
      liftAll: (agree: boolean) => call("mafia:lift-all", { agree }),
      shoot: (seat: number) => call("mafia:shoot", { seat }),
      check: (seat: number) => call("mafia:check", { seat }),
      bestMove: (seats: number[]) => call("mafia:best-move", { seats }),
      say: (text: string) => call("mafia:say", { text }),
      kick: (playerId: string, ban: boolean) => call("mafia:kick", { playerId, ban }),
      transferHost: (playerId: string) => call("mafia:transfer-host", { playerId }),
      foul: (seat: number) => call("mafia:foul", { seat }),
    };
  }, []);

  return { state, connection, clockOffset, actions };
}

export type MafiaActions = ReturnType<typeof useMafiaRoom>["actions"];
