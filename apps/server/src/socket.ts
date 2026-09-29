import type { Server as HttpServer } from "node:http";
import type { FastifyBaseLogger } from "fastify";
import { Server } from "socket.io";

export function createSocketServer(
  httpServer: HttpServer,
  opts: { corsOrigins: string[]; logger: FastifyBaseLogger },
) {
  const io = new Server(httpServer, {
    cors: { origin: opts.corsOrigins, credentials: true },
    // Keep connections alive through proxies and detect dead mobile clients quickly.
    pingInterval: 10_000,
    pingTimeout: 8_000,
  });

  io.on("connection", (socket) => {
    opts.logger.debug({ socketId: socket.id }, "socket connected");

    socket.on("disconnect", (reason) => {
      opts.logger.debug({ socketId: socket.id, reason }, "socket disconnected");
    });
  });

  return io;
}
