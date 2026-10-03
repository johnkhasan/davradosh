import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GalleryItem } from "../images/gallery";
import { publicPlayerId } from "../lib/ids";
import { MemoryRoomRepository } from "../rooms/memory-repository";
import { createGameServer } from "../server";
import { dayStart, msUntilNextDay, piecesForDay, previousDay, tashkentDay } from "./day";
import { MemoryDailyRepository } from "./repository";
import { DailyService, type DailyLeaderboard } from "./service";

describe("daily days", () => {
  it("uses the Tashkent date (UTC+5)", () => {
    expect(tashkentDay(Date.parse("2026-10-03T18:59:59Z"))).toBe("2026-10-03");
    expect(tashkentDay(Date.parse("2026-10-03T19:00:00Z"))).toBe("2026-10-04");
    expect(dayStart("2026-10-04")).toBe(Date.parse("2026-10-03T19:00:00Z"));
    expect(previousDay("2026-10-01")).toBe("2026-09-30");
    expect(msUntilNextDay(Date.parse("2026-10-03T18:00:00Z"))).toBe(60 * 60 * 1000);
  });

  it("gives weekends a bigger puzzle", () => {
    expect(piecesForDay("2026-10-03")).toBe(100); // Saturday
    expect(piecesForDay("2026-10-04")).toBe(100); // Sunday
    expect(piecesForDay("2026-10-05")).toBe(64); // Monday
  });
});

const items: GalleryItem[] = ["10", "11", "12", "13"].map((id) => ({
  provider: "picsum",
  id,
  thumbUrl: `https://picsum.photos/id/${id}/480/360`,
  width: 1600,
  height: 1200,
  author: "Author",
  sourceUrl: "https://unsplash.com",
}));

function fakeGallery() {
  const imported: string[] = [];
  return {
    imported,
    gallery: {
      list: async () => items,
      import: async (provider: GalleryItem["provider"], id: string) => {
        imported.push(id);
        return {
          id: `${provider}-${id}`,
          source: "unsplash" as const,
          url: `http://localhost/uploads/${provider}-${id}.webp`,
          thumbUrl: `http://localhost/uploads/${provider}-${id}-thumb.jpg`,
          width: 1600,
          height: 1200,
          credit: "Author / Unsplash",
        };
      },
    },
  };
}

describe("DailyService", () => {
  const base = Date.parse("2026-10-05T06:00:00Z"); // Monday 11:00 in Tashkent
  const identity = { name: "Ali", color: "#6C5CE7", avatar: "🦊" };

  function setup() {
    let now = base;
    const { gallery, imported } = fakeGallery();
    const service = new DailyService({
      gallery,
      repository: new MemoryDailyRepository(),
      now: () => now,
    });
    return { service, imported, advance: (ms: number) => (now += ms) };
  }

  it("picks one picture and cut per day and caches it", async () => {
    const { service, imported, advance } = setup();
    const a = await service.puzzle();
    const b = await service.puzzle();
    expect(a.day).toBe("2026-10-05");
    expect(a.pieces).toBe(64);
    expect(b.image).toEqual(a.image);
    expect(b.seed).toBe(a.seed);
    expect(imported).toHaveLength(1);

    // Another service (a restart) chooses the same picture for the same day.
    const other = setup();
    expect((await other.service.puzzle()).image.id).toBe(a.image.id);

    advance(24 * 60 * 60 * 1000);
    const tomorrow = await service.puzzle();
    expect(tomorrow.day).toBe("2026-10-06");
    expect(tomorrow.seed).not.toBe(a.seed);
  });

  it("tries the next picture when an import fails", async () => {
    let calls = 0;
    const { gallery } = fakeGallery();
    const service = new DailyService({
      gallery: {
        list: gallery.list,
        import: async (provider, id) => {
          if (calls++ === 0) throw new Error("download failed");
          return gallery.import(provider, id);
        },
      },
      repository: new MemoryDailyRepository(),
      now: () => base,
    });
    const puzzle = await service.puzzle();
    expect(puzzle.image.id).toMatch(/^picsum-/);
  });

  it("refuses impossible times and keeps the best one", async () => {
    const { service, advance } = setup();
    const clientId = "client-aaaaaaaa";
    service.start(clientId);
    advance(60_000);
    // Faster than the floor (400 ms a piece).
    expect(await service.submit({ clientId, ...identity, ms: 10_000 })).toEqual({
      ok: false,
      error: "too_fast",
    });
    // More time than has passed since the start.
    expect(await service.submit({ clientId, ...identity, ms: 120_000 })).toEqual({
      ok: false,
      error: "time_mismatch",
    });
    const first = await service.submit({ clientId, ...identity, ms: 58_000 });
    expect(first).toMatchObject({ ok: true, ms: 58_000, improved: true, rank: 1, total: 1 });
    const worse = await service.submit({ clientId, ...identity, ms: 59_000 });
    expect(worse).toMatchObject({ ok: true, ms: 58_000, improved: false });
    const better = await service.submit({ clientId, ...identity, ms: 40_000 });
    expect(better).toMatchObject({ ok: true, ms: 40_000, improved: true });
  });

  it("accepts yesterday's puzzle only shortly after midnight", async () => {
    const { service, advance } = setup();
    const clientId = "client-bbbbbbbb";
    advance(dayStart("2026-10-06") - base + 60 * 60 * 1000); // 01:00 the next day
    expect(
      await service.submit({ clientId, ...identity, ms: 60_000, day: "2026-10-05" }),
    ).toMatchObject({ ok: true, day: "2026-10-05" });
    advance(3 * 60 * 60 * 1000);
    expect(await service.submit({ clientId, ...identity, ms: 60_000, day: "2026-10-05" })).toEqual({
      ok: false,
      error: "wrong_day",
    });
    expect(service.start(clientId, "2026-10-01")).toBeNull();
  });

  it("ranks players, shares ties and shows the caller outside the top", async () => {
    const { service } = setup();
    for (let i = 0; i < 25; i++) {
      const ms = 30_000 + Math.floor(i / 2) * 1_000;
      await service.submit({ clientId: `client-${String(i).padStart(8, "0")}`, ...identity, ms });
    }
    const board = await service.leaderboard(undefined, "client-00000024");
    expect(board.total).toBe(25);
    expect(board.top).toHaveLength(20);
    expect(board.top.map((row) => row.rank).slice(0, 4)).toEqual([1, 1, 3, 3]);
    expect(board.you).toMatchObject({ rank: 25, ms: 42_000, you: true });
    expect(board.top.some((row) => row.you)).toBe(false);
    expect(JSON.stringify(board)).not.toContain("client-");
  });
});

describe("daily routes", () => {
  let server: Awaited<ReturnType<typeof createGameServer>>;
  let uploadDir: string;

  const testJpeg = () =>
    sharp({ create: { width: 900, height: 600, channels: 3, background: "#6c5ce7" } })
      .jpeg()
      .toBuffer();
  /** Fake Picsum API so the tests run offline. */
  const fakeFetch: typeof fetch = async (input) => {
    const href = String(input);
    if (href.includes("/v2/list"))
      return Response.json([
        { id: "10", author: "Test", width: 2500, height: 1667, url: "https://unsplash.com/x" },
        { id: "20", author: "Test", width: 2500, height: 1667, url: "https://unsplash.com/y" },
      ]);
    if (href.endsWith("/info")) return Response.json({ author: "Test", width: 2500, height: 1667 });
    return new Response(new Uint8Array(await testJpeg()), {
      headers: { "content-type": "image/jpeg" },
    });
  };

  beforeAll(async () => {
    uploadDir = await mkdtemp(path.join(os.tmpdir(), "daily-uploads-"));
    server = await createGameServer({
      env: {
        NODE_ENV: "test",
        CORS_ORIGINS: ["http://localhost:3000"],
        MAX_PLAYERS_PER_ROOM: 5,
        UPLOAD_DIR: uploadDir,
        PUBLIC_UPLOAD_URL: "http://localhost/uploads",
        UNSPLASH_ACCESS_KEY: "would-be-ignored",
        SERVE_UPLOADS: true,
        LIVEKIT_URL: undefined,
        LIVEKIT_API_KEY: undefined,
        LIVEKIT_API_SECRET: undefined,
        LIVEKIT_SERVICE_URL: undefined,
      },
      repository: new MemoryRoomRepository(),
      checkDb: async () => true,
      fetch: fakeFetch,
    });
  });

  afterAll(async () => {
    await server.close();
    await rm(uploadDir, { recursive: true, force: true });
  });

  it("serves today's puzzle from the picsum gallery", async () => {
    const res = await server.app.inject({ method: "GET", url: "/api/daily" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.image.id).toMatch(/^picsum-(10|20)$/);
    expect(body.image.url).toContain("http://localhost/uploads/");
    expect([64, 100]).toContain(body.pieces);
    expect(typeof body.seed).toBe("number");
    expect(body.nextInMs).toBeGreaterThan(0);
  });

  it("starts, records a result and lists it on the leaderboard", async () => {
    const clientId = "route-client-1";
    const start = await server.app.inject({
      method: "POST",
      url: "/api/daily/start",
      payload: { clientId },
    });
    expect(start.statusCode).toBe(200);

    // Just started: a minute-long solve has not happened yet.
    const early = await server.app.inject({
      method: "POST",
      url: "/api/daily/result",
      payload: { clientId, name: "Ali", color: "#6C5CE7", avatar: "🦊", ms: 60_000 },
    });
    expect(early.statusCode).toBe(400);
    expect(early.json()).toEqual({ error: "time_mismatch" });

    // Another player whose start the server never saw (for example after a restart).
    const other = await server.app.inject({
      method: "POST",
      url: "/api/daily/result",
      payload: {
        clientId: "route-client-2",
        name: "Vali",
        color: "#6C5CE7",
        avatar: "🐼",
        ms: 65_000,
      },
    });
    expect(other.statusCode).toBe(200);
    expect(other.json()).toMatchObject({ ok: true, rank: 1, total: 1 });

    const board = await server.app.inject({
      method: "GET",
      url: "/api/daily/leaderboard?clientId=route-client-2",
    });
    const data = board.json() as DailyLeaderboard;
    expect(data.top).toHaveLength(1);
    expect(data.top[0]).toMatchObject({
      id: publicPlayerId("route-client-2"),
      name: "Vali",
      ms: 65_000,
      you: true,
    });
    expect(board.body).not.toContain("route-client");
  });

  it("validates input", async () => {
    const bad = await server.app.inject({
      method: "POST",
      url: "/api/daily/result",
      payload: { clientId: "x", name: "A", color: "red", avatar: "", ms: -1 },
    });
    expect(bad.statusCode).toBe(400);
    const badDay = await server.app.inject({
      method: "GET",
      url: "/api/daily/leaderboard?day=yesterday",
    });
    expect(badDay.statusCode).toBe(400);
  });
});
