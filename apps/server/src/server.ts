import { mkdir } from "node:fs/promises";
import path from "node:path";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { buildApp } from "./app";
import { MemoryDailyRepository, type DailyRepository } from "./daily/repository";
import { dailyRoutes } from "./daily/routes";
import { DailyService } from "./daily/service";
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
import { createPrepareOptions } from "./table/prepare";
import { MemoryTableRepository, type TableRepository } from "./table/repository";
import { tableRoutes } from "./table/routes";
import {
  createTableEmitter,
  registerTableHandlers,
  type TableNamespace,
} from "./table/socket-handlers";
import { TableRoomManager } from "./table/table-manager";
import type { TableRoomOptions } from "./table/table-room";

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
  /** Table game rooms (chess, uno, ...); in memory when omitted. */
  tableRepository?: TableRepository;
  /** Daily puzzle times; in memory when omitted. */
  dailyRepository?: DailyRepository;
  /** Shorter table timers in tests. */
  table?: { room?: Omit<TableRoomOptions, "now">; tickMs?: number };
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
  tableRepository = new MemoryTableRepository(),
  table: tableOptions,
  dailyRepository = new MemoryDailyRepository(),
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
    codeTaken: async (code) => (await mafiaRepository.findRoomIdByCode(code, new Date())) !== null,
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

  await app.register(roomRoutes, {
    manager,
    findMafiaByCode: (code) => mafiaRepository.findRoomIdByCode(code, new Date()),
  });
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
    codeTaken: async (code) => (await repository.findRoomIdByCode(code, new Date())) !== null,
    createEmitter: () => createMafiaEmitter(mafiaNsp),
    logger: app.log,
    game: mafiaOptions?.game,
    room: mafiaOptions?.room,
    tickMs: mafiaOptions?.tickMs,
  });
  await app.register(mafiaRoutes, { manager: mafia, voice: mafiaVoice });
  registerMafiaHandlers(mafiaNsp, mafia, app.log);

  // Table games (chess, checkers, uno, battleship, puzzle race): one more namespace.
  const tableNsp = io.of("/table") as unknown as TableNamespace;
  const table = new TableRoomManager({
    repository: tableRepository,
    createEmitter: () => createTableEmitter(tableNsp),
    logger: app.log,
    room: tableOptions?.room,
    tickMs: tableOptions?.tickMs,
  });
  const prepareOptions = createPrepareOptions(repository);
  await app.register(tableRoutes, { manager: table, prepareOptions });
  registerTableHandlers(tableNsp, table, app.log);

  // Daily puzzle: always from Lorem Picsum (no key needed, a stable list), so a restart picks
  // the same picture for the same day.
  const daily = new DailyService({
    gallery: new GalleryService({ store, repository, fetch }),
    repository: dailyRepository,
  });
  await app.register(dailyRoutes, { daily });

  return {
    app,
    io,
    manager,
    mafia,
    table,
    async close() {
      await manager.stop();
      await mafia.stop();
      await table.stop();
      io.close();
      await app.close();
    },
  };
}
