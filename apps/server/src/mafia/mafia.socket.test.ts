import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import type {
  MafiaClientToServerEvents,
  MafiaRoomStateDTO,
  MafiaServerToClientEvents,
  MafiaTimings,
} from "@puzzle/shared/mafia";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { publicPlayerId } from "../lib/ids";
import { MemoryRoomRepository } from "../rooms/memory-repository";
import { createGameServer } from "../server";

type Client = Socket<MafiaServerToClientEvents, MafiaClientToServerEvents>;

// Long speeches (so the test controls them with "pass"), everything else near instant.
const timings: MafiaTimings = {
  roleReveal: 30,
  zeroNight: 30,
  speech: 60_000,
  absentSpeaker: 60_000,
  votePerCandidate: 30,
  tieSpeech: 30,
  liftAllVote: 30,
  lastWords: 30,
  shoot: 30,
  donCheck: 30,
  sheriffCheck: 30,
  bestMove: 30,
  dawn: 30,
};

let server: Awaited<ReturnType<typeof createGameServer>>;
let url: string;
let uploadDir: string;
const clients: Client[] = [];

beforeAll(async () => {
  uploadDir = await mkdtemp(path.join(os.tmpdir(), "mafia-uploads-"));
  server = await createGameServer({
    env: {
      NODE_ENV: "test",
      CORS_ORIGINS: ["http://localhost:3000"],
      MAX_PLAYERS_PER_ROOM: 5,
      UPLOAD_DIR: uploadDir,
      PUBLIC_UPLOAD_URL: "http://localhost/uploads",
      UNSPLASH_ACCESS_KEY: undefined,
      SERVE_UPLOADS: false,
      LIVEKIT_URL: undefined,
      LIVEKIT_API_KEY: undefined,
      LIVEKIT_API_SECRET: undefined,
      LIVEKIT_SERVICE_URL: undefined,
    },
    repository: new MemoryRoomRepository(),
    checkDb: async () => true,
    mafia: { game: { timings }, tickMs: 10 },
  });
  await server.app.listen({ port: 0, host: "127.0.0.1" });
  server.mafia.start();
  url = `http://127.0.0.1:${(server.app.server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  for (const client of clients) client.disconnect();
  await server.close();
  await rm(uploadDir, { recursive: true, force: true });
});

const clientId = (n: number) => `mafia_client_${n}_xxxx`;

/** Connects to the "/mafia" namespace and keeps the latest state pushed to this socket. */
async function member(roomId: string, n: number) {
  const socket: Client = connect(`${url}/mafia`, { transports: ["websocket"], forceNew: true });
  clients.push(socket);
  const states: MafiaRoomStateDTO[] = [];
  socket.on("mafia:state", (state) => states.push(state));
  const ack = await socket.emitWithAck("mafia:join", {
    roomId,
    clientId: clientId(n),
    name: `Player ${n}`,
    color: "#6C5CE7",
    avatar: "🦊",
  });
  if (!ack.ok) throw new Error(`join failed: ${ack.error}`);
  return {
    socket,
    id: ack.state.you,
    get state() {
      return states.at(-1) ?? ack.state;
    },
    /** Resolves once a pushed state matches. */
    async until(check: (state: MafiaRoomStateDTO) => boolean, timeout = 3_000) {
      const started = Date.now();
      while (!check(this.state)) {
        if (Date.now() - started > timeout)
          throw new Error(`timed out; phase ${this.state.game?.phase}`);
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      return this.state;
    },
  };
}

describe("mafia over Socket.IO", () => {
  it("creates a room, seats ten, starts, deals private roles and runs the day", async () => {
    const created = await fetch(`${url}/api/mafia/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: clientId(1) }),
    });
    expect(created.status).toBe(201);
    const { id: roomId } = (await created.json()) as { id: string };

    const members: Array<Awaited<ReturnType<typeof member>>> = [];
    for (let n = 1; n <= 10; n++) members.push(await member(roomId, n));
    const host = members[0]!;
    expect(host.id).toBe(publicPlayerId(clientId(1)));
    expect(host.state.members.find((m) => m.id === host.id)!.isHost).toBe(true);

    // Not everyone is ready yet.
    expect(await host.socket.emitWithAck("mafia:start")).toEqual({ ok: false, error: "not_ready" });
    for (const m of members.slice(1)) {
      expect(await m.socket.emitWithAck("mafia:ready", { ready: true })).toEqual({ ok: true });
    }
    expect(await members[1]!.socket.emitWithAck("mafia:start")).toEqual({
      ok: false,
      error: "not_host",
    });
    expect(await host.socket.emitWithAck("mafia:start")).toEqual({ ok: true });

    // Each socket knows its own role, and black players (after the zero night) their team.
    for (const m of members) {
      const state = await m.until((s) => s.game?.phase === "speech");
      const view = state.game!;
      const mine = view.seats.find((s) => s.playerId === m.id)!;
      const black = mine.role === "mafia" || mine.role === "don";
      expect(view.seats.filter((s) => s.role !== null)).toHaveLength(black ? 3 : 1);
    }

    // A spectator joining now sees no roles.
    const spectator = await member(roomId, 11);
    expect(spectator.state.members.find((m) => m.id === spectator.id)!.spectator).toBe(true);
    expect(spectator.state.game!.seats.every((s) => s.role === null)).toBe(true);

    // Day one: seat 1 speaks first; only the speaker may nominate or pass.
    const bySeat = (seat: number) =>
      members.find((m) => m.state.game!.seats.find((s) => s.playerId === m.id)!.seat === seat)!;
    const first = bySeat(1);
    const second = bySeat(2);
    expect(first.state.game!.speaker).toBe(1);
    expect(await second.socket.emitWithAck("mafia:nominate", { seat: 5 })).toEqual({
      ok: false,
      error: "not_your_turn",
    });
    expect(await first.socket.emitWithAck("mafia:nominate", { seat: 5 })).toEqual({ ok: true });
    expect(await first.socket.emitWithAck("mafia:pass")).toEqual({ ok: true });
    await second.until((s) => s.game!.speaker === 2);
    expect(second.state.game!.nominations).toEqual([{ seat: 5, by: 1 }]);
    expect(second.state.game!.actions).toEqual(["pass", "nominate", "say"]);

    // Invalid payloads are rejected by the schemas.
    expect(
      await second.socket.emitWithAck("mafia:nominate", { seat: 42 } as unknown as {
        seat: number;
      }),
    ).toEqual({ ok: false, error: "not_a_player" });

    // The public room info carries no secrets.
    const info = await (await fetch(`${url}/api/mafia/rooms/${roomId}`)).json();
    expect(info).toEqual({
      id: roomId,
      code: expect.stringMatching(/^\d{4}$/),
      status: "playing",
      tableSize: 10,
      players: 10,
      spectators: 1,
    });
    expect(JSON.stringify(info)).not.toMatch(/role|sheriff|mafia|don/i);
  });

  it("disconnects the old tab when the same person joins again", async () => {
    const created = await fetch(`${url}/api/mafia/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: clientId(20) }),
    });
    const { id: roomId } = (await created.json()) as { id: string };
    const first = await member(roomId, 20);
    const kicked = new Promise<string>((resolve) => first.socket.on("mafia:kicked", resolve));
    await member(roomId, 20);
    expect(await kicked).toBe("other-tab");
  });

  it("lets the host kick and ban over the socket, and tells the kicked tab", async () => {
    const created = await fetch(`${url}/api/mafia/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: clientId(40) }),
    });
    const { id: roomId } = (await created.json()) as { id: string };
    const host = await member(roomId, 40);
    const guest = await member(roomId, 41);
    const told = new Promise<string>((resolve) => guest.socket.on("mafia:kicked", resolve));
    expect(await guest.socket.emitWithAck("mafia:kick", { playerId: host.id, ban: false })).toEqual(
      {
        ok: false,
        error: "not_host",
      },
    );
    expect(await host.socket.emitWithAck("mafia:kick", { playerId: guest.id, ban: true })).toEqual({
      ok: true,
    });
    expect(await told).toBe("banned");
    await expect(member(roomId, 41)).rejects.toThrow(/banned/);
  });

  it("answers unknown rooms with not_found", async () => {
    const socket: Client = connect(`${url}/mafia`, { transports: ["websocket"], forceNew: true });
    clients.push(socket);
    const ack = await socket.emitWithAck("mafia:join", {
      roomId: "nope1234",
      clientId: clientId(30),
      name: "Nobody",
      color: "#6C5CE7",
      avatar: "🦊",
    });
    expect(ack).toEqual({ ok: false, error: "not_found" });
    expect((await fetch(`${url}/api/mafia/rooms/nope1234`)).status).toBe(404);
  });
});
