import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { GameServer } from "./rooms/socket-handlers";

export function createSocketServer(
  httpServer: HttpServer,
  opts: { corsOrigins: string[] },
): GameServer {
  return new Server(httpServer, {
    cors: { origin: opts.corsOrigins, credentials: true },
    // Keep connections alive through proxies and detect dead mobile clients quickly.
    pingInterval: 10_000,
    pingTimeout: 8_000,
    // Cursor and drag packets are tiny; compression only costs CPU.
    perMessageDeflate: false,
    maxHttpBufferSize: 64 * 1024,
  });
}
