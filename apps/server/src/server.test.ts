import { mkdtemp, readdir, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import type {
  ClientToServerEvents,
  JoinAck,
  RemoteSnap,
  RoomStateDTO,
  ServerToClientEvents,
} from "@puzzle/shared";
import sharp from "sharp";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { publicPlayerId } from "./lib/ids";
import { MemoryRoomRepository } from "./rooms/memory-repository";
import { createGameServer } from "./server";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

let server: Awaited<ReturnType<typeof createGameServer>>;
let url: string;
let uploadDir: string;
const clients: Client[] = [];

const testJpeg = () =>
  sharp({ create: { width: 900, height: 600, channels: 3, background: "#6c5ce7" } })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Copyright: "secret-gps-owner" } } })
    .toBuffer();

/** Fake Picsum API so gallery tests run offline. */
const fakeFetch: typeof fetch = async (input) => {
  const href = String(input);
  if (href.includes("/v2/list")) {
    return Response.json([
      { id: "10", author: "Test Author", width: 2500, height: 1667, url: "https://unsplash.com/x" },
      // Hidden from the gallery (see HIDDEN in images/gallery.ts).
      { id: "31", author: "Hidden", width: 3264, height: 4912, url: "https://unsplash.com/y" },
    ]);
  }
  if (href.endsWith("/info"))
    return Response.json({ author: "Test Author", width: 2500, height: 1667 });
  return new Response(new Uint8Array(await testJpeg()), {
    headers: { "content-type": "image/jpeg" },
  });
};

beforeAll(async () => {
  uploadDir = await mkdtemp(path.join(os.tmpdir(), "puzzle-uploads-"));
  server = await createGameServer({
    env: {
      NODE_ENV: "test",
      CORS_ORIGINS: ["http://localhost:3000"],
      MAX_PLAYERS_PER_ROOM: 5,
      UPLOAD_DIR: uploadDir,
      PUBLIC_UPLOAD_URL: "http://localhost/uploads",
      UNSPLASH_ACCESS_KEY: undefined,
      SERVE_UPLOADS: true,
      LIVEKIT_URL: "wss://rtc.example.com",
      LIVEKIT_API_KEY: "test-key",
      LIVEKIT_API_SECRET: "test-secret-that-is-at-least-32-chars",
      LIVEKIT_SERVICE_URL: undefined,
    },
    repository: new MemoryRoomRepository(),
    checkDb: async () => true,
    fetch: fakeFetch,
  });
  await server.app.listen({ port: 0, host: "127.0.0.1" });
  url = `http://127.0.0.1:${(server.app.server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  for (const client of clients) client.disconnect();
  await server.close();
  await rm(uploadDir, { recursive: true, force: true });
});

async function createRoom(): Promise<string> {
  const res = await fetch(`${url}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clientId: "host_client_1", imageId: "demo", pieces: 24 }),
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

async function join(roomId: string, n: number): Promise<{ client: Client; ack: JoinAck }> {
  const client: Client = connect(url, { transports: ["websocket"], forceNew: true });
  clients.push(client);
  const ack = await client.emitWithAck("room:join", {
    roomId,
    clientId: `client_${n}_abcdef`,
    name: `Player ${n}`,
    color: "#6C5CE7",
    avatar: "🦊",
  });
  return { client, ack };
}

const next = <E extends keyof ServerToClientEvents>(client: Client, event: E) =>
  new Promise<Parameters<ServerToClientEvents[E]>>((resolve) => {
    client.once(event, ((...args: Parameters<ServerToClientEvents[E]>) => resolve(args)) as never);
  });

describe("game server over Socket.IO", () => {
  it("creates a room and describes it", async () => {
    const id = await createRoom();
    const res = await fetch(`${url}/api/rooms/${id}`);
    expect(await res.json()).toMatchObject({
      id,
      pieces: 24,
      players: 0,
      maxPlayers: 5,
      full: false,
    });
    expect((await fetch(`${url}/api/rooms/nope1234`)).status).toBe(404);
  });

  it("finds a room by its 4-digit code", async () => {
    const id = await createRoom();
    const { code } = (await (await fetch(`${url}/api/rooms/${id}`)).json()) as { code: string };
    expect(code).toMatch(/^\d{4}$/);
    const res = await fetch(`${url}/api/rooms/code/${code}`);
    expect(await res.json()).toEqual({ id, game: "puzzle" });
    expect((await fetch(`${url}/api/rooms/code/12a4`)).status).toBe(404);
  });

  it("finds a mafia table by its join code", async () => {
    const res = await fetch(`${url}/api/mafia/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: "mafia_code_host_0001" }),
    });
    const { id, code } = (await res.json()) as { id: string; code: string };
    expect(code).toMatch(/^\d{4}$/);
    const found = await fetch(`${url}/api/rooms/code/${code}`);
    expect(await found.json()).toEqual({ id, game: "mafia" });
    const preview = await fetch(`${url}/api/mafia/rooms/${id}`);
    expect(await preview.json()).toMatchObject({ id, code });
  });

  it("rejects invalid room creation", async () => {
    const res = await fetch(`${url}/api/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: "x", imageId: "demo", pieces: 7 }),
    });
    expect(res.status).toBe(400);
  });

  it("syncs players, cursors, grabs and snaps between clients and enforces 5 seats", async () => {
    const roomId = await createRoom();
    const a = await join(roomId, 1);
    expect(a.ack.ok).toBe(true);
    const state = (a.ack as { ok: true; state: RoomStateDTO }).state;
    expect(state.puzzle.groups).toHaveLength(state.room.cols * state.room.rows);

    const joined = next(a.client, "player:joined");
    const b = await join(roomId, 2);
    expect(b.ack.ok).toBe(true);
    expect((await joined)[0].name).toBe("Player 2");

    // Cursor from A reaches B.
    const cursor = next(b.client, "cursor");
    a.client.emit("cursor:move", { x: 10, y: 20 });
    expect(await cursor).toEqual([publicPlayerId("client_1_abcdef"), 10, 20]);

    // A grabs group 1, B cannot.
    const grabbed = next(b.client, "piece:grabbed");
    expect(await a.client.emitWithAck("piece:grab", { groupId: 1 })).toEqual({ ok: true });
    expect(await grabbed).toEqual([1, publicPlayerId("client_1_abcdef")]);
    expect(await b.client.emitWithAck("piece:grab", { groupId: 1 })).toMatchObject({ ok: false });

    // A drops piece 1 exactly next to piece 0 → both clients receive the snap.
    const group0 = state.puzzle.groups.find((g) => g.id === 0)!;
    const snapA = next(a.client, "piece:snapped");
    const snapB = next(b.client, "piece:snapped");
    a.client.emit("piece:drop", { groupId: 1, x: group0.x, y: group0.y });
    const [resultA] = await snapA;
    const [resultB] = (await snapB) as [RemoteSnap];
    expect(resultA).toEqual(resultB);
    expect(resultB).toMatchObject({
      groupId: 0,
      absorbed: [1],
      playerId: publicPlayerId("client_1_abcdef"),
    });

    // Fill the room to 5: the 6th person can still watch, as a viewer.
    for (let n = 3; n <= 5; n++) expect((await join(roomId, n)).ack.ok).toBe(true);
    const sixth = (await join(roomId, 6)).ack as { ok: true; state: RoomStateDTO };
    expect(sixth.ok).toBe(true);
    expect(sixth.state.players.find((p) => p.id === sixth.state.you)?.role).toBe("viewer");
  });

  it("returns not_found and invalid errors on join", async () => {
    expect((await join("missing1", 7)).ack).toEqual({ ok: false, error: "not_found" });
    const client: Client = connect(url, { transports: ["websocket"], forceNew: true });
    clients.push(client);
    const ack = await client.emitWithAck("room:join", {
      roomId: "bad",
      clientId: "x",
      name: "",
      color: "red",
      avatar: "",
    } as never);
    expect(ack).toEqual({ ok: false, error: "invalid" });
  });
});

describe("images", () => {
  it("re-encodes uploads to WebP, strips metadata and serves them", async () => {
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(await testJpeg())], { type: "image/jpeg" }),
      "photo.jpg",
    );
    const res = await fetch(`${url}/api/uploads`, { method: "POST", body: form });
    expect(res.status).toBe(201);
    const image = (await res.json()) as {
      id: string;
      url: string;
      width: number;
      height: number;
      source: string;
    };
    expect(image).toMatchObject({ width: 900, height: 600, source: "upload" });
    expect(await readdir(uploadDir)).toEqual(
      expect.arrayContaining([`${image.id}.webp`, `${image.id}_thumb.jpg`]),
    );

    const served = await fetch(`${url}/uploads/${image.id}.webp`);
    expect(served.status).toBe(200);
    expect(served.headers.get("access-control-allow-origin")).toBe("*");
    const meta = await sharp(Buffer.from(await served.arrayBuffer())).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();

    // A room can be created from the uploaded image.
    const room = await fetch(`${url}/api/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: "host_client_1", imageId: image.id, pieces: 48 }),
    });
    expect(room.status).toBe(201);
  });

  it("rejects files that are not images", async () => {
    const form = new FormData();
    form.append("file", new Blob(["<?php echo 1; ?>"], { type: "image/png" }), "evil.png");
    const res = await fetch(`${url}/api/uploads`, { method: "POST", body: form });
    expect(res.status).toBe(415);
  });

  it("lists the gallery and imports a picture only once", async () => {
    const list = await fetch(`${url}/api/gallery`);
    const body = (await list.json()) as {
      items: Array<{ provider: string; id: string }>;
      categories: string[];
    };
    expect(body.categories).toEqual([]);
    expect(body.items[0]).toMatchObject({ provider: "picsum", id: "10" });
    expect(body.items.some((item) => item.id === "31")).toBe(false);
    const hidden = await fetch(`${url}/api/gallery/import`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "picsum", id: "31" }),
    });
    expect(hidden.ok).toBe(false);

    const importOnce = () =>
      fetch(`${url}/api/gallery/import`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "picsum", id: "10" }),
      }).then((r) => r.json() as Promise<{ id: string; credit: string }>);
    const first = await importOnce();
    const second = await importOnce();
    expect(first).toMatchObject({ id: "picsum-10", credit: "Test Author / Unsplash" });
    expect(second.id).toBe(first.id);
  });
});

describe("voice tokens", () => {
  const post = (path: string, body: unknown) =>
    fetch(`${url}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("issues LiveKit tokens only to players connected to the room", async () => {
    const roomId = await createRoom();
    // Not connected yet (the room is not even loaded) → refused.
    expect(
      (await post(`/api/rooms/${roomId}/rtc-token`, { clientId: "client_8_abcdef" })).status,
    ).toBe(404);

    const { ack } = await join(roomId, 8);
    expect(ack.ok).toBe(true);
    const res = await post(`/api/rooms/${roomId}/rtc-token`, { clientId: "client_8_abcdef" });
    expect(res.status).toBe(200);
    const { url: rtcUrl, token } = (await res.json()) as { url: string; token: string };
    expect(rtcUrl).toBe("wss://rtc.example.com");

    const claims = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString()) as {
      sub: string;
      name: string;
      video: { room: string; roomJoin: boolean; canPublishData: boolean };
    };
    expect(claims.sub).toBe(publicPlayerId("client_8_abcdef"));
    expect(claims.video).toMatchObject({ room: roomId, roomJoin: true, canPublishData: false });
    expect(token).not.toContain("client_8_abcdef");

    // Someone who is not in the room cannot get a token.
    expect(
      (await post(`/api/rooms/${roomId}/rtc-token`, { clientId: "client_9_abcdef" })).status,
    ).toBe(403);
    // Only the host may mute everyone.
    expect(
      (await post(`/api/rooms/${roomId}/rtc/mute-all`, { clientId: "client_8_abcdef" })).status,
    ).toBe(403);
  });
});

describe("viewers and host actions over Socket.IO", () => {
  it("a full room lets newcomers watch; the host can kick and restart", async () => {
    const res = await fetch(`${url}/api/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: "client_20_abcdef",
        imageId: "demo",
        pieces: 24,
        maxPlayers: 2,
      }),
    });
    const { id: roomId } = (await res.json()) as { id: string };
    const host = await join(roomId, 20);
    await join(roomId, 21);
    const viewer = await join(roomId, 22);
    const viewerState = (viewer.ack as { ok: true; state: RoomStateDTO }).state;
    expect(viewerState.players.find((p) => p.id === viewerState.you)?.role).toBe("viewer");
    expect(await viewer.client.emitWithAck("piece:grab", { groupId: 0 })).toEqual({ ok: false });
    expect(await viewer.client.emitWithAck("seat:claim")).toEqual({ ok: false, error: "full" });

    // Only the host may kick.
    expect(
      await viewer.client.emitWithAck("host:kick", {
        playerId: publicPlayerId("client_21_abcdef"),
      }),
    ).toEqual({
      ok: false,
      error: "not_host",
    });
    const kicked = next(viewer.client, "kicked");
    expect(
      await host.client.emitWithAck("host:kick", { playerId: viewerState.you, ban: true }),
    ).toEqual({ ok: true });
    expect(await kicked).toEqual(["host"]);
    expect((await join(roomId, 22)).ack).toEqual({ ok: false, error: "banned" });

    const reset = next(host.client, "puzzle:reset");
    expect(await host.client.emitWithAck("host:restart")).toEqual({ ok: true });
    await reset;
  });
});
