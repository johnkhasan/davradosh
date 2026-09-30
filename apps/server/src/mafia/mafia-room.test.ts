import type { MafiaRoomStateDTO } from "@puzzle/shared/mafia";
import { beforeEach, describe, expect, it } from "vitest";
import { publicPlayerId } from "../lib/ids";
import { MafiaRoom, MAFIA_LOBBY_GRACE_MS, MAFIA_RECONNECT_MS } from "./mafia-room";
import type { MafiaRoomRecord } from "./repository";

const client = (n: number) => `client_${n}_xxxxxxxx`;
const pid = (n: number) => publicPlayerId(client(n));
const join = (room: MafiaRoom, n: number, socket = `s${n}`, name = `Player ${n}`) =>
  room.join(
    { roomId: "room1234", clientId: client(n), name, color: "#6C5CE7", avatar: "🦊" },
    socket,
  );

function record(overrides: Partial<MafiaRoomRecord> = {}): MafiaRoomRecord {
  return {
    id: "room1234",
    hostId: pid(1),
    status: "lobby",
    members: [],
    game: null,
    banned: [],
    createdAt: new Date(0),
    expiresAt: new Date(Date.now() + 1e9),
    ...overrides,
  };
}

let now: number;
let sent: Array<{ socket: string; state: MafiaRoomStateDTO }>;
let room: MafiaRoom;

const last = (socket: string) => sent.filter((s) => s.socket === socket).at(-1)!.state;

beforeEach(() => {
  now = 1_000_000;
  sent = [];
  room = new MafiaRoom(
    record(),
    { state: (socket, state) => sent.push({ socket, state }) },
    {
      now: () => now,
    },
  );
});

/** Ten members, all ready; member 1 is the host. */
function fullLobby() {
  for (let n = 1; n <= 10; n++) join(room, n);
  for (let n = 2; n <= 10; n++) expect(room.setReady(pid(n), true)).toEqual({ ok: true });
}

describe("MafiaRoom: lobby", () => {
  it("seats the first ten, makes later comers spectators and dedupes names", () => {
    for (let n = 1; n <= 11; n++) join(room, n, `s${n}`, n === 2 ? "Player 1" : `Player ${n}`);
    const state = last("s1");
    expect(state.members.filter((m) => !m.spectator)).toHaveLength(10);
    expect(state.members.find((m) => m.id === pid(11))!.spectator).toBe(true);
    expect(state.members.find((m) => m.id === pid(2))!.name).toBe("Player 1 2");
    expect(state.members.find((m) => m.id === pid(1))!.isHost).toBe(true);
  });

  it("starts only for the host, with ten connected players who are all ready", () => {
    for (let n = 1; n <= 9; n++) join(room, n);
    expect(room.start(pid(1))).toEqual({ ok: false, error: "not_ready" });
    join(room, 10);
    expect(room.start(pid(1))).toEqual({ ok: false, error: "not_ready" });
    for (let n = 2; n <= 10; n++) room.setReady(pid(n), true);
    expect(room.start(pid(2))).toEqual({ ok: false, error: "not_host" });
    room.disconnect(pid(5), "s5");
    expect(room.start(pid(1))).toEqual({ ok: false, error: "not_ready" });
    join(room, 5);
    expect(room.start(pid(1))).toEqual({ ok: true });
    expect(last("s1").status).toBe("playing");
    expect(last("s1").game!.phase).toBe("roleReveal");
  });

  it("removes members who left the lobby, hands the host over and seats a spectator", () => {
    for (let n = 1; n <= 11; n++) join(room, n);
    room.disconnect(pid(1), "s1");
    now += MAFIA_LOBBY_GRACE_MS + 1;
    room.tick();
    const state = last("s2");
    expect(state.members.some((m) => m.id === pid(1))).toBe(false);
    expect(state.members.find((m) => m.id === pid(2))!.isHost).toBe(true);
    expect(state.members.find((m) => m.id === pid(11))!.spectator).toBe(false);
  });

  it("lets the same person reconnect from a new tab, reporting the old socket", () => {
    join(room, 1, "old");
    const result = join(room, 1, "new");
    expect(result).toMatchObject({ ok: true, replacedSocketId: "old" });
    expect(room.isCurrentSocket(pid(1), "new")).toBe(true);
    expect(room.isCurrentSocket(pid(1), "old")).toBe(false);
  });
});

describe("MafiaRoom: game", () => {
  it("sends each socket only its own view", () => {
    fullLobby();
    room.start(pid(1));
    for (let n = 1; n <= 10; n++) {
      const view = last(`s${n}`).game!;
      const mine = view.seats.find((s) => s.playerId === pid(n))!;
      expect(mine.role).not.toBeNull();
      const known = view.seats.filter((s) => s.role !== null);
      // Nobody knows more than their own role at the role reveal (teammates come at the zero night).
      const isBlack = mine.role === "mafia" || mine.role === "don";
      expect(known.length).toBe(isBlack ? 3 : 1);
      expect(view.me).toBe(mine.seat);
    }
  });

  it("makes newcomers spectators who see no roles", () => {
    fullLobby();
    room.start(pid(1));
    join(room, 11);
    const state = last("s11");
    expect(state.members.find((m) => m.id === pid(11))!.spectator).toBe(true);
    expect(state.game!.me).toBeNull();
    expect(state.game!.seats.every((s) => s.role === null)).toBe(true);
    expect(room.act(pid(11), (game, t) => game.pass(pid(11), t))).toEqual({
      ok: false,
      error: "not_a_player",
    });
  });

  it("drives the phases from tick() and removes a player who does not come back", () => {
    fullLobby();
    room.start(pid(1));
    now += 10_001; // role reveal over
    room.tick();
    expect(last("s1").game!.phase === "zeroNight" || last("s1").game!.phase === "night").toBe(true);

    room.disconnect(pid(4), "s4");
    now += MAFIA_RECONNECT_MS + 1;
    room.tick();
    const seat = last("s1").game!.seats.find((s) => s.playerId === pid(4))!;
    expect(seat).toMatchObject({ alive: false, exit: "left", role: null });
  });

  it("keeps a reconnecting player in the game", () => {
    fullLobby();
    room.start(pid(1));
    room.disconnect(pid(4), "s4");
    now += MAFIA_RECONNECT_MS / 2;
    room.tick();
    join(room, 4, "s4b");
    now += MAFIA_RECONNECT_MS;
    room.tick();
    expect(last("s4b").game!.seats.find((s) => s.playerId === pid(4))!.alive).toBe(true);
  });

  it("goes back to the lobby for a rematch only after the game is over", () => {
    fullLobby();
    room.start(pid(1));
    expect(room.rematch(pid(1))).toEqual({ ok: false, error: "wrong_status" });
  });

  it("survives a save and reload in the middle of a game", () => {
    fullLobby();
    room.start(pid(1));
    now += 10_001;
    room.tick();
    const saved = JSON.parse(JSON.stringify(room.persistable()));
    const reloaded = new MafiaRoom(
      record({ ...saved, createdAt: new Date(0), expiresAt: new Date(Date.now() + 1e9) }),
      { state: (socket, state) => sent.push({ socket, state }) },
      { now: () => now },
    );
    join(reloaded, 3, "again");
    const before = last("s3").game!;
    const after = last("again").game!;
    expect(after.seats.map((s) => [s.seat, s.playerId, s.role])).toEqual(
      before.seats.map((s) => [s.seat, s.playerId, s.role]),
    );
    expect(after.phase).toBe(before.phase);
  });
});
