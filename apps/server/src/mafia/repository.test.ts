import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "../db";
import { MafiaGame } from "./game";
import { MemoryMafiaRepository, PrismaMafiaRepository, type MafiaRepository } from "./repository";

const players = Array.from({ length: 10 }, (_, i) => ({
  id: `p${i + 1}`,
  name: `Player ${i + 1}`,
}));

/** The same contract for both repositories. */
function contract(name: string, make: () => MafiaRepository, prefix: string) {
  it(`${name}: creates, saves and reloads a room with its game`, async () => {
    const repo = make();
    const id = `${prefix}a`;
    const created = await repo.createRoom({
      id,
      hostId: "host",
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect(created).toMatchObject({ id, hostId: "host", status: "lobby", members: [], game: null });

    const game = new MafiaGame(players, 0);
    const snapshot = game.snapshot(0);
    const member = {
      id: "p1",
      name: "Player 1",
      color: "#6C5CE7",
      avatar: "🦊",
      ready: true,
      spectator: false,
      joinedAt: 1,
    };
    await repo.saveRoom(id, {
      hostId: "p1",
      status: "playing",
      members: [member],
      game: snapshot,
      banned: ["x"],
    });
    const loaded = await repo.loadRoom(id);
    expect(loaded).toMatchObject({
      hostId: "p1",
      status: "playing",
      members: [member],
      banned: ["x"],
    });
    expect(loaded!.game).toEqual(snapshot);

    // Back to the lobby clears the game.
    await repo.saveRoom(id, {
      hostId: "p1",
      status: "lobby",
      members: [member],
      game: null,
      banned: [],
    });
    expect((await repo.loadRoom(id))!.game).toBeNull();
  });

  it(`${name}: deletes expired rooms`, async () => {
    const repo = make();
    await repo.createRoom({ id: `${prefix}old`, hostId: "h", expiresAt: new Date(Date.now() - 1) });
    await repo.createRoom({
      id: `${prefix}new`,
      hostId: "h",
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect(await repo.deleteExpiredRooms(new Date())).toBeGreaterThanOrEqual(1);
    expect(await repo.loadRoom(`${prefix}old`)).toBeNull();
    expect(await repo.loadRoom(`${prefix}new`)).not.toBeNull();
  });
}

describe("MemoryMafiaRepository", () => {
  contract("memory", () => new MemoryMafiaRepository(), "m");
});

/**
 * Runs against a real PostgreSQL with migrations applied:
 *   TEST_DATABASE_URL=postgresql://… pnpm test
 * Skipped otherwise (CI provides a Postgres service).
 */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("PrismaMafiaRepository", () => {
  const db = createDb(url ?? "postgresql://unused");
  const suffix = Math.random().toString(36).slice(2, 8);

  afterAll(async () => {
    await db.mafiaRoom.deleteMany({ where: { id: { startsWith: `t${suffix}` } } });
    await db.$disconnect();
  });

  contract("prisma", () => new PrismaMafiaRepository(db), `t${suffix}`);
});
