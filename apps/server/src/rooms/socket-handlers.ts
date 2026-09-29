import {
  ChatPayloadSchema,
  CursorPayloadSchema,
  DropPayloadSchema,
  GrabPayloadSchema,
  JoinPayloadSchema,
  KickPayloadSchema,
  SetRolePayloadSchema,
  TransferHostPayloadSchema,
  MovePayloadSchema,
  ReactionPayloadSchema,
  ViewportPayloadSchema,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from "@puzzle/shared";
import type { FastifyBaseLogger } from "fastify";
import type { Server, Socket } from "socket.io";
import type { z } from "zod";
import { TokenBucket } from "../lib/rate-limit";
import type { RoomEmitter } from "./room";
import type { VoiceService } from "../rtc/voice";
import type { RoomManager } from "./room-manager";

interface SocketData {
  roomId?: string;
  playerId?: string;
}

export type GameServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
type GameSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export const roomChannel = (roomId: string) => `room:${roomId}`;

export function createRoomEmitter(io: GameServer, roomId: string): RoomEmitter {
  const channel = roomChannel(roomId);
  return {
    all: (event, ...args) => io.to(channel).emit(event, ...args),
    // Not volatile on purpose: volatile packets sent in the same tick (cursor + drag)
    // drop each other. Traffic is tiny with at most 5 players per room.
    others: (socketId, event, ...args) =>
      io
        .to(channel)
        .except(socketId)
        .emit(event, ...args),
    one: (socketId, event, ...args) => io.to(socketId).emit(event, ...args),
  };
}

/** Wires validated, rate-limited socket events to rooms. */
export function registerSocketHandlers(
  io: GameServer,
  manager: RoomManager,
  logger: FastifyBaseLogger,
  voice: VoiceService | null = null,
) {
  io.on("connection", (socket: GameSocket) => {
    // ~25 cursor + ~25 drag updates per second, with room for bursts.
    const bucket = new TokenBucket(120, 80);

    const parse = <T extends z.ZodType>(schema: T, payload: unknown): z.output<T> | null => {
      if (!bucket.take()) return null;
      const result = schema.safeParse(payload);
      if (!result.success) {
        logger.debug({ socketId: socket.id, issues: result.error.issues }, "invalid payload");
        return null;
      }
      return result.data;
    };

    const current = async () => {
      const { roomId, playerId } = socket.data;
      if (!roomId || !playerId) return null;
      const room = await manager.get(roomId);
      if (!room || !room.isCurrentSocket(playerId, socket.id)) return null;
      return { room, playerId };
    };

    socket.on("room:join", async (payload, ack) => {
      if (typeof ack !== "function") return;
      const data = parse(JoinPayloadSchema, payload);
      if (!data) return ack({ ok: false, error: "invalid" });
      const room = await manager.get(data.roomId);
      if (!room) return ack({ ok: false, error: "not_found" });

      const result = room.join(data, socket.id);
      if (!result.ok) return ack(result);

      if (result.replacedSocketId && result.replacedSocketId !== socket.id) {
        // Same player opened the room in another tab: the new tab wins.
        const old = io.sockets.sockets.get(result.replacedSocketId);
        old?.emit("kicked", "other-tab");
        old?.disconnect(true);
      }
      socket.data.roomId = data.roomId;
      socket.data.playerId = result.state.you;
      await socket.join(roomChannel(data.roomId));
      ack({ ok: true, state: result.state });
      logger.info({ roomId: data.roomId, playerId: result.state.you }, "player joined");
    });

    socket.on("room:sync", async (ack) => {
      if (typeof ack !== "function") return;
      const ctx = await current();
      ack(ctx ? ctx.room.stateFor(ctx.playerId) : null);
    });

    socket.on("cursor:move", async (payload) => {
      const data = parse(CursorPayloadSchema, payload);
      const ctx = data && (await current());
      if (ctx) ctx.room.cursor(ctx.playerId, socket.id, data.x, data.y);
    });

    // Reactions get their own, stricter budget so nobody can flood the room with emoji.
    const reactions = new TokenBucket(5, 2);
    socket.on("reaction", async (payload) => {
      if (!reactions.take()) return;
      const data = parse(ReactionPayloadSchema, payload);
      const ctx = data && (await current());
      if (ctx) ctx.room.reaction(ctx.playerId, socket.id, data);
    });

    // Chat gets its own budget: a burst of 5, then one message per second.
    const chat = new TokenBucket(5, 1);
    socket.on("chat:send", async (payload) => {
      if (!chat.take()) return;
      const data = parse(ChatPayloadSchema, payload);
      const ctx = data && (await current());
      if (ctx) ctx.room.chat(ctx.playerId, data.text);
    });

    socket.on("viewport", async (payload) => {
      const data = parse(ViewportPayloadSchema, payload);
      const ctx = data && (await current());
      if (ctx) ctx.room.viewport(ctx.playerId, socket.id, data);
    });

    socket.on("piece:grab", async (payload, ack) => {
      if (typeof ack !== "function") return;
      const data = parse(GrabPayloadSchema, payload);
      const ctx = data && (await current());
      ack(ctx ? ctx.room.grab(ctx.playerId, socket.id, data.groupId) : { ok: false });
    });

    socket.on("piece:move", async (payload) => {
      const data = parse(MovePayloadSchema, payload);
      const ctx = data && (await current());
      if (ctx) ctx.room.move(ctx.playerId, socket.id, data);
    });

    socket.on("piece:drop", async (payload) => {
      // Drops are never rate limited away: losing one would desync the dropper.
      const result = DropPayloadSchema.safeParse(payload);
      const ctx = result.success && (await current());
      if (!ctx || !result.success) return;
      const before = ctx.room.puzzle.groupCount;
      ctx.room.drop(ctx.playerId, socket.id, result.data);
      if (ctx.room.puzzle.groupCount !== before) void manager.save(ctx.room);
    });

    socket.on("puzzle:arrange", async () => {
      if (!bucket.take()) return;
      const ctx = await current();
      ctx?.room.arrange(ctx.playerId);
    });

    // ------------------------------------------------------------ seats & host actions

    const invalid = { ok: false as const, error: "invalid" as const };

    // Voice rights follow the role, so a role change drops the LiveKit session
    // and the client reconnects with a fresh token.
    const changeOwnRole = async (change: "claimSeat" | "leaveSeat") => {
      const ctx = bucket.take() && (await current());
      if (!ctx) return invalid;
      const before = ctx.room.player(ctx.playerId)?.role;
      const result = ctx.room[change](ctx.playerId);
      if (result.ok && ctx.room.player(ctx.playerId)?.role !== before) {
        void voice?.removeParticipant(ctx.room.id, ctx.playerId);
      }
      return result;
    };

    socket.on("seat:claim", async (ack) => {
      if (typeof ack === "function") ack(await changeOwnRole("claimSeat"));
    });

    socket.on("seat:leave", async (ack) => {
      if (typeof ack === "function") ack(await changeOwnRole("leaveSeat"));
    });

    socket.on("host:kick", async (payload, ack) => {
      if (typeof ack !== "function") return;
      const data = parse(KickPayloadSchema, payload);
      const ctx = data && (await current());
      if (!ctx) return ack(invalid);
      const { socketId, ...result } = ctx.room.kick(ctx.playerId, data.playerId, data.ban);
      if (result.ok) {
        if (socketId) io.sockets.sockets.get(socketId)?.disconnect(true);
        void voice?.removeParticipant(ctx.room.id, data.playerId);
        logger.info({ roomId: ctx.room.id, target: data.playerId, ban: data.ban }, "player kicked");
        if (data.ban) void manager.save(ctx.room);
      }
      ack(result);
    });

    socket.on("host:set-role", async (payload, ack) => {
      if (typeof ack !== "function") return;
      const data = parse(SetRolePayloadSchema, payload);
      const ctx = data && (await current());
      if (!ctx) return ack(invalid);
      const result = ctx.room.setRole(ctx.playerId, data.playerId, data.role);
      // Voice rights depend on the role: drop the LiveKit session so it reconnects with new ones.
      if (result.ok) void voice?.removeParticipant(ctx.room.id, data.playerId);
      ack(result);
    });

    socket.on("host:transfer", async (payload, ack) => {
      if (typeof ack !== "function") return;
      const data = parse(TransferHostPayloadSchema, payload);
      const ctx = data && (await current());
      if (!ctx) return ack(invalid);
      const result = ctx.room.transferHost(ctx.playerId, data.playerId);
      if (result.ok) {
        logger.info({ roomId: ctx.room.id, to: data.playerId }, "host transferred");
        void manager.save(ctx.room);
      }
      ack(result);
    });

    socket.on("host:restart", async (ack) => {
      if (typeof ack !== "function") return;
      const ctx = bucket.take() && (await current());
      if (!ctx) return ack(invalid);
      const result = ctx.room.restart(ctx.playerId);
      if (result.ok) void manager.save(ctx.room);
      ack(result);
    });

    socket.on("disconnect", async () => {
      const ctx = await current();
      ctx?.room.disconnect(ctx.playerId, socket.id);
    });
  });
}
