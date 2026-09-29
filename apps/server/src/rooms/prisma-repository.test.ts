import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "../db";
import { PrismaRoomRepository } from "./prisma-repository";
import { RoomCodeTakenError, type NewRoom } from "./repository";

/**
 * Runs against a real PostgreSQL with migrations applied:
 *   TEST_DATABASE_URL=postgresql://… pnpm test
 * Skipped otherwise (CI provides a Postgres service).
 */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("PrismaRoomRepository", () => {
  const db = createDb(url ?? "postgresql://unused");
  const repo = new PrismaRoomRepository(db);
  const suffix = Math.random().toString(36).slice(2, 8);

  afterAll(async () => {
    await db.room.deleteMany({ where: { id: { startsWith: `t${suffix}` } } });
    await db.image.deleteMany({ where: { id: { startsWith: `img-${suffix}` } } });
    await db.$disconnect();
  });

  it("seeds the demo image on first use", async () => {
    expect(await repo.getImage("demo")).toMatchObject({ id: "demo", source: "demo", width: 1600 });
  });

  it("stores images, rooms and state updates", async () => {
    const image = await repo.createImage({
      id: `img-${suffix}`,
      source: "upload",
      url: "https://example.com/a.webp",
      thumbUrl: "https://example.com/a_thumb.jpg",
      width: 2048,
      height: 1536,
    });
    expect(image.thumbUrl).toBe("https://example.com/a_thumb.jpg");

    const state = { groups: [{ id: 0, x: 1, y: 2, pieceIds: [0], placed: false }] };
    const created = await repo.createRoom({
      id: `t${suffix}a`,
      code: null,
      hostId: "host_client_1",
      imageId: image.id,
      cols: 1,
      rows: 1,
      seed: 2 ** 31 - 2,
      rotation: false,
      maxPlayers: 5,
      state,
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect(created).toMatchObject({ status: "PLAYING", image: { id: image.id }, state });

    await repo.saveRoomState(created.id, {
      state: { groups: [{ ...state.groups[0]!, x: 0, y: 0, placed: true }] },
      stats: { host_client_1: { merges: 3 } },
      status: "COMPLETED",
      startedAt: new Date(),
      completedAt: new Date(),
      banned: ["someone"],
      hostPlayerId: "new-host-id",
    });
    const loaded = await repo.loadRoom(created.id);
    expect(loaded).toMatchObject({
      status: "COMPLETED",
      stats: { host_client_1: { merges: 3 } },
      hostPlayerId: "new-host-id",
    });
    expect(loaded?.state?.groups[0]?.placed).toBe(true);
    expect(await repo.loadRoom("missing-room")).toBeNull();
  });

  it("deletes expired rooms", async () => {
    await repo.createRoom({
      id: `t${suffix}b`,
      code: null,
      hostId: "host_client_1",
      imageId: "demo",
      cols: 2,
      rows: 2,
      seed: 1,
      rotation: false,
      maxPlayers: 5,
      state: { groups: [] },
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await repo.deleteExpiredRooms(new Date())).toBeGreaterThanOrEqual(1);
    expect(await repo.loadRoom(`t${suffix}b`)).toBeNull();
  });

  it("finds rooms by join code and keeps codes unique", async () => {
    const room = (id: string, code: string, expiresIn: number): NewRoom => ({
      id,
      code,
      hostId: "host_client_1",
      imageId: "demo",
      cols: 2,
      rows: 2,
      seed: 1,
      rotation: false,
      maxPlayers: 5,
      state: { groups: [] },
      expiresAt: new Date(Date.now() + expiresIn),
    });
    // A code no stored room uses yet.
    let code = "";
    for (let n = 0; n < 10_000 && !code; n++) {
      const candidate = n.toString().padStart(4, "0");
      if (!(await db.room.findUnique({ where: { code: candidate } }))) code = candidate;
    }
    await repo.createRoom(room(`t${suffix}c`, code, -1000));
    // The expired room gives the code up.
    expect(await repo.findRoomIdByCode(code, new Date())).toBeNull();
    await repo.createRoom(room(`t${suffix}d`, code, 60_000));
    expect(await repo.findRoomIdByCode(code, new Date())).toBe(`t${suffix}d`);
    await expect(repo.createRoom(room(`t${suffix}e`, code, 60_000))).rejects.toBeInstanceOf(
      RoomCodeTakenError,
    );
  });
});
