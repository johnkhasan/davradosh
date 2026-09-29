import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "../db";
import { PrismaRoomRepository } from "./prisma-repository";

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
    });
    const loaded = await repo.loadRoom(created.id);
    expect(loaded).toMatchObject({ status: "COMPLETED", stats: { host_client_1: { merges: 3 } } });
    expect(loaded?.state?.groups[0]?.placed).toBe(true);
    expect(await repo.loadRoom("missing-room")).toBeNull();
  });

  it("deletes expired rooms", async () => {
    await repo.createRoom({
      id: `t${suffix}b`,
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
});
