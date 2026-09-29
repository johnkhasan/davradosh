import { ClientIdSchema, RoomIdSchema } from "@puzzle/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { publicPlayerId } from "../lib/ids";
import type { RoomManager } from "../rooms/room-manager";
import type { VoiceService } from "../rtc/voice";

const Body = z.object({ clientId: ClientIdSchema });

export async function voiceRoutes(
  app: FastifyInstance,
  opts: { manager: RoomManager; voice: VoiceService | null },
) {
  const resolve = async (params: unknown, body: unknown) => {
    const id = RoomIdSchema.safeParse((params as { id?: string }).id);
    const parsed = Body.safeParse(body);
    if (!id.success || !parsed.success) return { ok: false as const, status: 400 };
    // Only rooms that are live in memory have connected players.
    const room = opts.manager.getLoaded(id.data);
    if (!room) return { ok: false as const, status: 404 };
    const playerId = publicPlayerId(parsed.data.clientId);
    const player = room.player(playerId);
    if (!player?.connected) return { ok: false as const, status: 403 };
    return { ok: true as const, room, player, clientId: parsed.data.clientId };
  };

  app.post<{ Params: { id: string } }>(
    "/api/rooms/:id/rtc-token",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      if (!opts.voice) return reply.code(503).send({ error: "voice_disabled" });
      const ctx = await resolve(request.params, request.body);
      if (!ctx.ok) return reply.code(ctx.status).send({ error: "forbidden" });
      const token = await opts.voice.token(ctx.room.id, ctx.player);
      return { url: opts.voice.url, token };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/rooms/:id/rtc/mute-all",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      if (!opts.voice) return reply.code(503).send({ error: "voice_disabled" });
      const ctx = await resolve(request.params, request.body);
      if (!ctx.ok) return reply.code(ctx.status).send({ error: "forbidden" });
      if (!ctx.player.isHost) return reply.code(403).send({ error: "not_host" });
      return { muted: await opts.voice.muteAll(ctx.room.id, ctx.player.id) };
    },
  );
}
