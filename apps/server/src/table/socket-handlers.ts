import {
  TableChatPayloadSchema,
  TableJoinPayloadSchema,
  TableKickPayloadSchema,
  TableMovePayloadSchema,
  TablePlayerTargetSchema,
  TableReadyPayloadSchema,
  type TableClientToServerEvents,
  type TableResult,
  type TableServerToClientEvents,
} from "@puzzle/shared/games";
import type { FastifyBaseLogger } from "fastify";
import type { Namespace, Socket } from "socket.io";
import type { z } from "zod";
import { TokenBucket } from "../lib/rate-limit";
import type { TableRoomManager } from "./table-manager";
import type { TableRoom, TableRoomEmitter } from "./table-room";

interface SocketData {
  roomId?: string;
  playerId?: string;
}

export type TableNamespace = Namespace<
  TableClientToServerEvents,
  TableServerToClientEvents,
  Record<string, never>,
  SocketData
>;
type TableSocket = Socket<
  TableClientToServerEvents,
  TableServerToClientEvents,
  Record<string, never>,
  SocketData
>;

/** States always go to one socket at a time: views differ per person (hidden cards, ships). */
export function createTableEmitter(nsp: TableNamespace): TableRoomEmitter {
  return { state: (socketId, state) => nsp.to(socketId).emit("table:state", state) };
}

const invalid: TableResult = { ok: false, error: "invalid" };

/** Wires the validated, rate-limited "/table" namespace to table rooms. */
export function registerTableHandlers(
  nsp: TableNamespace,
  manager: TableRoomManager,
  logger: FastifyBaseLogger,
) {
  nsp.on("connection", (socket: TableSocket) => {
    // Turn based: a few actions a second is plenty (a fast uno player included).
    const bucket = new TokenBucket(20, 6);
    const talk = new TokenBucket(5, 1);

    const parse = <T extends z.ZodType>(schema: T, payload: unknown): z.output<T> | null => {
      if (!bucket.take()) return null;
      const result = schema.safeParse(payload);
      return result.success ? result.data : null;
    };

    const current = async (): Promise<{ room: TableRoom; playerId: string } | null> => {
      const { roomId, playerId } = socket.data;
      if (!roomId || !playerId) return null;
      const room = await manager.get(roomId);
      if (!room || !room.isCurrentSocket(playerId, socket.id)) return null;
      return { room, playerId };
    };

    socket.on("table:join", async (payload, ack) => {
      if (typeof ack !== "function") return;
      const data = parse(TableJoinPayloadSchema, payload);
      if (!data) return ack({ ok: false, error: "invalid" });
      const room = await manager.get(data.roomId);
      if (!room) return ack({ ok: false, error: "not_found" });
      const result = room.join(data, socket.id);
      if (!result.ok) return ack(result);
      if (result.replacedSocketId && result.replacedSocketId !== socket.id) {
        // The same person opened the room in another tab: the new tab wins.
        const old = nsp.sockets.get(result.replacedSocketId);
        old?.emit("table:kicked", "other-tab");
        old?.disconnect(true);
      }
      socket.data.roomId = data.roomId;
      socket.data.playerId = result.state.you;
      ack({ ok: true, state: result.state });
      logger.info({ roomId: data.roomId, kind: room.kind }, "table member joined");
    });

    socket.on("table:ready", async (payload, ack) => {
      if (typeof ack !== "function") return;
      const data = parse(TableReadyPayloadSchema, payload);
      const ctx = data && (await current());
      ack(ctx ? ctx.room.setReady(ctx.playerId, data.ready) : invalid);
    });

    socket.on("table:start", async (ack) => {
      if (typeof ack !== "function") return;
      const ctx = bucket.take() && (await current());
      if (!ctx) return ack(invalid);
      const result = ctx.room.start(ctx.playerId);
      if (result.ok) {
        logger.info({ roomId: ctx.room.id, kind: ctx.room.kind }, "table game started");
        void manager.save(ctx.room);
      }
      ack(result);
    });

    socket.on("table:rematch", async (ack) => {
      if (typeof ack !== "function") return;
      const ctx = bucket.take() && (await current());
      ack(ctx ? ctx.room.rematch(ctx.playerId) : invalid);
    });

    socket.on("table:move", async (payload, ack) => {
      if (typeof ack !== "function") return;
      const data = parse(TableMovePayloadSchema, payload);
      const ctx = data && (await current());
      ack(ctx ? ctx.room.move(ctx.playerId, data.move) : invalid);
    });

    socket.on("table:resign", async (ack) => {
      if (typeof ack !== "function") return;
      const ctx = bucket.take() && (await current());
      ack(ctx ? ctx.room.resign(ctx.playerId) : invalid);
    });

    socket.on("table:chat", async (payload, ack) => {
      if (typeof ack !== "function") return;
      if (!talk.take()) return ack({ ok: false, error: "rate_limited" });
      const data = parse(TableChatPayloadSchema, payload);
      const ctx = data && (await current());
      ack(ctx ? ctx.room.say(ctx.playerId, data.text) : invalid);
    });

    socket.on("table:kick", async (payload, ack) => {
      if (typeof ack !== "function") return;
      const data = parse(TableKickPayloadSchema, payload);
      const ctx = data && (await current());
      if (!ctx) return ack(invalid);
      const result = ctx.room.kick(ctx.playerId, data.playerId, data.ban);
      if (!result.ok) return ack(result);
      if (result.socketId) {
        const target = nsp.sockets.get(result.socketId);
        target?.emit("table:kicked", data.ban ? "banned" : "host");
        target?.disconnect(true);
      }
      void manager.save(ctx.room);
      ack({ ok: true });
    });

    socket.on("table:transfer-host", async (payload, ack) => {
      if (typeof ack !== "function") return;
      const data = parse(TablePlayerTargetSchema, payload);
      const ctx = data && (await current());
      ack(ctx ? ctx.room.transferHost(ctx.playerId, data.playerId) : invalid);
    });

    socket.on("disconnect", async () => {
      const ctx = await current();
      ctx?.room.disconnect(ctx.playerId, socket.id);
    });
  });
}
