import { mkdir } from "node:fs/promises";
import path from "node:path";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { buildApp } from "./app";
import type { Env } from "./env";
import type { MafiaGameOptions } from "./mafia/game";
import { MafiaRoomManager } from "./mafia/mafia-manager";
import type { MafiaRoomOptions } from "./mafia/mafia-room";
import { MemoryMafiaRepository, type MafiaRepository } from "./mafia/repository";
import { mafiaRoutes } from "./mafia/routes";
import { MafiaVoiceSync } from "./mafia/voice-sync";
import {
  createMafiaEmitter,
  registerMafiaHandlers,
  type MafiaNamespace,
} from "./mafia/socket-handlers";
import { GalleryService } from "./images/gallery";
import { ImageStore } from "./images/image-store";
import type { RoomRepository } from "./rooms/repository";
import { RoomManager } from "./rooms/room-manager";
import {
  createRoomEmitter,
  registerSocketHandlers,
  type GameServer,
} from "./rooms/socket-handlers";
import { imageRoutes } from "./routes/images";
import { roomRoutes } from "./routes/rooms";
import { voiceRoutes } from "./routes/voice";
import { VoiceService } from "./rtc/voice";
import { createSocketServer } from "./socket";

export interface GameServerDeps {
  env: Pick<
    Env,
    | "NODE_ENV"
    | "CORS_ORIGINS"
    | "MAX_PLAYERS_PER_ROOM"
    | "UPLOAD_DIR"
    | "PUBLIC_UPLOAD_URL"
    | "UNSPLASH_ACCESS_KEY"
    | "SERVE_UPLOADS"
    | "LIVEKIT_URL"
    | "LIVEKIT_API_KEY"
    | "LIVEKIT_API_SECRET"
    | "LIVEKIT_SERVICE_URL"
  >;
  repository: RoomRepository;
  /** Mafia rooms; in memory when omitted. */
  mafiaRepository?: MafiaRepository;
  /** Shorter mafia timers in tests. */
  mafia?: {
    game?: MafiaGameOptions;
    room?: Omit<MafiaRoomOptions, "game" | "now">;
    tickMs?: number;
  };
  checkDb: () => Promise<boolean>;
  /** Injected in tests to fake gallery providers. */
  fetch?: typeof fetch;
}

/** Fastify + Socket.IO + rooms + images, fully wired but not listening yet. */
export async function createGameServer({
  env,
  repository,
  mafiaRepository = new MemoryMafiaRepository(),
  mafia: mafiaOptions,
  checkDb,
  fetch,
}: GameServerDeps) {
  const app = await buildApp({ env, checkDb });
  await app.register(rateLimit, { global: false });

  // The manager needs the Socket.IO server, which needs Fastify's HTTP server.
  const io: GameServer = createSocketServer(app.server, { corsOrigins: env.CORS_ORIGINS });
  const manager = new RoomManager({
    repository,
    createEmitter: (roomId) => createRoomEmitter(io, roomId),
    logger: app.log,
    maxPlayersPerRoom: env.MAX_PLAYERS_PER_ROOM,
  });

  const uploadDir = path.resolve(env.UPLOAD_DIR);
  await mkdir(uploadDir, { recursive: true });
  const store = new ImageStore(uploadDir, env.PUBLIC_UPLOAD_URL.replace(/\/$/, ""));
  const gallery = new GalleryService({
    unsplashKey: env.UNSPLASH_ACCESS_KEY,
    store,
    repository,
    fetch,
  });

  const voice =
    env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET
      ? new VoiceService({
          url: env.LIVEKIT_URL,
          apiKey: env.LIVEKIT_API_KEY,
          apiSecret: env.LIVEKIT_API_SECRET,
          serviceUrl: env.LIVEKIT_SERVICE_URL,
        })
      : null;

  await app.register(roomRoutes, { manager });
  await app.register(voiceRoutes, { manager, voice });
  await app.register(imageRoutes, { store, repository, gallery });
  if (env.SERVE_UPLOADS ?? env.NODE_ENV !== "production") {
    await app.register(fastifyStatic, {
      root: uploadDir,
      prefix: "/uploads/",
      immutable: true,
      maxAge: "365d",
      // Pieces are drawn on a canvas, so images must be CORS-readable.
      setHeaders: (reply) => void reply.header("access-control-allow-origin", "*"),
    });
  }
  registerSocketHandlers(io, manager, app.log, voice);

  // Mafia: its own Socket.IO namespace, so puzzle traffic and events stay untouched.
  const mafiaNsp = io.of("/mafia") as unknown as MafiaNamespace;
  const mafiaVoice = voice ? new MafiaVoiceSync(voice, app.log) : null;
  const mafia = new MafiaRoomManager({
    voice: mafiaVoice,
    repository: mafiaRepository,
    createEmitter: () => createMafiaEmitter(mafiaNsp),
    logger: app.log,
    game: mafiaOptions?.game,
    room: mafiaOptions?.room,
    tickMs: mafiaOptions?.tickMs,
  });
  await app.register(mafiaRoutes, { manager: mafia, voice: mafiaVoice });
  registerMafiaHandlers(mafiaNsp, mafia, app.log);

  return {
    app,
    io,
    manager,
    mafia,
    async close() {
      await manager.stop();
      await mafia.stop();
      io.close();
      await app.close();
    },
  };
}
