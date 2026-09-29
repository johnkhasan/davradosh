import { buildApp } from "./app";
import type { Env } from "./env";
import type { RoomRepository } from "./rooms/repository";
import { RoomManager } from "./rooms/room-manager";
import {
  createRoomEmitter,
  registerSocketHandlers,
  type GameServer,
} from "./rooms/socket-handlers";
import { roomRoutes } from "./routes/rooms";
import { createSocketServer } from "./socket";

export interface GameServerDeps {
  env: Pick<Env, "NODE_ENV" | "CORS_ORIGINS" | "MAX_PLAYERS_PER_ROOM">;
  repository: RoomRepository;
  checkDb: () => Promise<boolean>;
}

/** Fastify + Socket.IO + rooms, fully wired but not listening yet. */
export async function createGameServer({ env, repository, checkDb }: GameServerDeps) {
  const app = await buildApp({ env, checkDb });
  // The manager needs the Socket.IO server, which needs Fastify's HTTP server.
  const io: GameServer = createSocketServer(app.server, { corsOrigins: env.CORS_ORIGINS });
  const manager = new RoomManager({
    repository,
    createEmitter: (roomId) => createRoomEmitter(io, roomId),
    logger: app.log,
    maxPlayersPerRoom: env.MAX_PLAYERS_PER_ROOM,
  });
  await app.register(roomRoutes, { manager });
  registerSocketHandlers(io, manager, app.log);

  return {
    app,
    io,
    manager,
    async close() {
      await manager.stop();
      io.close();
      await app.close();
    },
  };
}
