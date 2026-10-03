import { MemoryDailyRepository, PrismaDailyRepository } from "./daily/repository";
import { createDb } from "./db";
import { loadEnv } from "./env";
import { MemoryMafiaRepository, PrismaMafiaRepository } from "./mafia/repository";
import { MemoryTableRepository, PrismaTableRepository } from "./table/repository";
import { MemoryRoomRepository } from "./rooms/memory-repository";
import { PrismaRoomRepository } from "./rooms/prisma-repository";
import { createGameServer } from "./server";

const env = loadEnv();
const db = env.DATABASE_URL ? createDb(env.DATABASE_URL) : null;

const server = await createGameServer({
  env,
  repository: db ? new PrismaRoomRepository(db) : new MemoryRoomRepository(),
  mafiaRepository: db ? new PrismaMafiaRepository(db) : new MemoryMafiaRepository(),
  tableRepository: db ? new PrismaTableRepository(db) : new MemoryTableRepository(),
  dailyRepository: db ? new PrismaDailyRepository(db) : new MemoryDailyRepository(),
  checkDb: async () => {
    if (!db) return true;
    await db.$queryRaw`SELECT 1`;
    return true;
  },
});

if (!db)
  server.app.log.warn("DATABASE_URL is not set: rooms are kept in memory and lost on restart");
server.manager.start();
server.mafia.start();
server.table.start();

async function shutdown(signal: string) {
  server.app.log.info({ signal }, "shutting down");
  await server.close();
  await db?.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await server.app.listen({ port: env.PORT, host: "0.0.0.0" });
