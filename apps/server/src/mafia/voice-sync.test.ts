import { teamOf } from "@puzzle/shared/mafia";
import { describe, expect, it } from "vitest";
import { publicPlayerId } from "../lib/ids";
import type { VoiceService } from "../rtc/voice";
import { MafiaRoom } from "./mafia-room";
import { mafiaNightRoom, mafiaVoiceRoom, MafiaVoiceSync } from "./voice-sync";

const client = (n: number) => `client_${n}_xxxxxxxx`;
const pid = (n: number) => publicPlayerId(client(n));

/** Fake LiveKit: participants per room, and a log of every call. */
function fakeVoice() {
  const rooms = new Map<string, Map<string, boolean>>();
  const calls: string[] = [];
  const voice = {
    url: "wss://rtc.example.com",
    async ensureRoom(name: string) {
      calls.push(`ensure ${name}`);
      if (!rooms.has(name)) rooms.set(name, new Map());
    },
    async tokenFor(o: { room: string; identity: string; canPublish: boolean }) {
      return `${o.room}|${o.identity}|${o.canPublish}`;
    },
    async listParticipants(room: string) {
      return [...(rooms.get(room) ?? new Map<string, boolean>())].map(([identity, canPublish]) => ({
        identity,
        permission: { canPublish },
      }));
    },
    async setCanPublish(room: string, identity: string, canPublish: boolean) {
      calls.push(`publish ${identity} ${canPublish}`);
      rooms.get(room)?.set(identity, canPublish);
    },
    async removeParticipant(room: string, identity: string) {
      calls.push(`remove ${room} ${identity}`);
      rooms.get(room)?.delete(identity);
    },
    async deleteRoom(room: string) {
      calls.push(`delete ${room}`);
      rooms.delete(room);
    },
  };
  const join = (room: string, identity: string, canPublish: boolean) => {
    if (!rooms.has(room)) rooms.set(room, new Map());
    rooms.get(room)!.set(identity, canPublish);
  };
  return { voice: voice as unknown as VoiceService, rooms, calls, join };
}

function setup() {
  let now = 1_000_000;
  const room = new MafiaRoom(
    {
      id: "room1234",
      hostId: pid(1),
      tableSize: 10,
      status: "lobby",
      members: [],
      game: null,
      banned: [],
      createdAt: new Date(0),
      expiresAt: new Date(Date.now() + 1e9),
    },
    { state: () => {} },
    { now: () => now },
  );
  for (let n = 1; n <= 10; n++) {
    room.join(
      { roomId: "room1234", clientId: client(n), name: `P${n}`, color: "#6C5CE7", avatar: "🦊" },
      `s${n}`,
    );
  }
  for (let n = 2; n <= 10; n++) room.setReady(pid(n), true);
  const fake = fakeVoice();
  const sync = new MafiaVoiceSync(fake.voice, console as never, () => now);
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { room, fake, sync, flush, advance: (ms: number) => (now += ms) };
}

describe("MafiaRoom.voicePolicy", () => {
  it("lets everyone talk in the lobby, then only the speaker, nobody at night", () => {
    const { room, advance } = setup();
    expect(room.voicePolicy()).toEqual({ everyone: true, speakers: [], night: [] });
    room.start(pid(1));
    expect(room.voicePolicy()).toMatchObject({ everyone: false, speakers: [], night: [] }); // role reveal
    advance(10_001);
    room.tick(); // zero night
    const black = room.voicePolicy().night;
    expect(black).toHaveLength(3);
    const state = room.stateFor(pid(1)).game!;
    expect(state.phase === "zeroNight" || state.phase === "night").toBe(true);
    advance(60_001);
    room.tick(); // day one, seat 1 speaks
    const policy = room.voicePolicy();
    expect(policy.everyone).toBe(false);
    expect(policy.night).toEqual([]);
    expect(policy.speakers).toHaveLength(1);
  });

  it("gives the night room only to the black team", () => {
    const { room, advance } = setup();
    room.start(pid(1));
    advance(10_001);
    room.tick();
    for (let n = 1; n <= 10; n++) {
      const view = room.stateFor(pid(n)).game!;
      const mine = view.seats.find((s) => s.playerId === pid(n))!;
      const black = teamOf(mine.role!) === "black";
      expect(room.voicePolicy().night.includes(pid(n))).toBe(black);
    }
  });
});

describe("MafiaVoiceSync", () => {
  it("issues tokens that match the phase, and a night token only for the black team", async () => {
    const { room, sync, advance } = setup();
    const lobby = await sync.tokens(room, pid(2));
    expect(lobby).toEqual({
      url: "wss://rtc.example.com",
      token: `${mafiaVoiceRoom("room1234")}|${pid(2)}|true`,
      night: null,
    });
    room.start(pid(1));
    advance(10_001);
    room.tick();
    const black = room.voicePolicy().night;
    for (let n = 1; n <= 10; n++) {
      const tokens = (await sync.tokens(room, pid(n)))!;
      expect(tokens.token.endsWith("|false")).toBe(true);
      expect(tokens.night !== null).toBe(black.includes(pid(n)));
    }
    // Strangers and disconnected members get nothing.
    expect(await sync.tokens(room, "nobody")).toBeNull();
    room.disconnect(pid(3), "s3");
    expect(await sync.tokens(room, pid(3))).toBeNull();
  });

  it("revokes and grants publishing on LiveKit as the phases change", async () => {
    const { room, sync, fake, flush, advance } = setup();
    for (let n = 1; n <= 10; n++) fake.join(mafiaVoiceRoom("room1234"), pid(n), true);
    room.start(pid(1));
    sync.sync(room);
    await flush();
    // Role reveal: nobody talks any more.
    for (let n = 1; n <= 10; n++)
      expect(fake.rooms.get(mafiaVoiceRoom("room1234"))!.get(pid(n))).toBe(false);

    advance(10_001 + 60_001);
    room.tick(); // day one
    sync.sync(room);
    await flush();
    const speaker = room.voicePolicy().speakers[0]!;
    const main = fake.rooms.get(mafiaVoiceRoom("room1234"))!;
    expect([...main].filter(([, can]) => can).map(([id]) => id)).toEqual([speaker]);
  });

  it("empties the night room once the zero night is over", async () => {
    const { room, sync, fake, flush, advance } = setup();
    room.start(pid(1));
    advance(10_001);
    room.tick();
    const black = room.voicePolicy().night;
    for (const id of black) fake.join(mafiaNightRoom("room1234"), id, true);
    fake.join(mafiaNightRoom("room1234"), pid(99), true); // someone who must not be there
    sync.sync(room);
    await flush();
    expect(fake.calls).toContain(`remove ${mafiaNightRoom("room1234")} ${pid(99)}`);

    advance(60_001);
    room.tick();
    sync.sync(room);
    await flush();
    expect(fake.calls).toContain(`delete ${mafiaNightRoom("room1234")}`);
    expect(fake.rooms.has(mafiaNightRoom("room1234"))).toBe(false);
  });

  it("does not repeat an unchanged policy within the re-check window", async () => {
    const { room, sync, fake, flush } = setup();
    fake.join(mafiaVoiceRoom("room1234"), pid(1), false);
    sync.sync(room);
    await flush();
    const after = fake.calls.length;
    sync.sync(room);
    await flush();
    expect(fake.calls.length).toBe(after);
  });
});
