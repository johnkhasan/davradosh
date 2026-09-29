import { LOCK_TIMEOUT_MS, SEAT_RESERVATION_MS, type JoinPayload } from "@puzzle/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { publicPlayerId } from "../lib/ids";
import { DEMO_IMAGE, type RoomRecord } from "./repository";
import { Room, type RoomEmitter } from "./room";

interface Sent {
  to: "all" | "others" | "one";
  socket?: string;
  event: string;
  args: unknown[];
}

function spyEmitter() {
  const sent: Sent[] = [];
  const emitter: RoomEmitter = {
    all: (event, ...args) => sent.push({ to: "all", event, args }),
    others: (socket, event, ...args) => sent.push({ to: "others", socket, event, args }),
    one: (socket, event, ...args) => sent.push({ to: "one", socket, event, args }),
  };
  return { sent, emitter, events: (name: string) => sent.filter((s) => s.event === name) };
}

function record(overrides: Partial<RoomRecord> = {}): RoomRecord {
  return {
    id: "room1234",
    hostId: "host_client",
    image: DEMO_IMAGE,
    cols: 4,
    rows: 3,
    seed: 1,
    rotation: false,
    maxPlayers: 5,
    status: "PLAYING",
    state: {
      groups: Array.from({ length: 12 }, (_, id) => ({
        id,
        x: 5000 + id * 1000,
        y: 5000,
        pieceIds: [id],
        placed: false,
      })),
    },
    stats: null,
    createdAt: new Date(0),
    startedAt: new Date(0),
    completedAt: null,
    banned: [],
    expiresAt: new Date(Date.now() + 1e9),
    ...overrides,
  };
}

const pid = (n: number) => publicPlayerId(`client_${n}_xxxx`);

const player = (n: number, name = `Player ${n}`): JoinPayload => ({
  roomId: "room1234",
  clientId: `client_${n}_xxxx`,
  name,
  color: "#6C5CE7",
  avatar: "🦊",
  role: "player",
});

describe("Room", () => {
  let now: number;
  let spy: ReturnType<typeof spyEmitter>;
  let room: Room;

  beforeEach(() => {
    now = 1_000_000;
    spy = spyEmitter();
    room = new Room(record(), spy.emitter, { now: () => now });
  });

  describe("seats", () => {
    it("seats at most maxPlayers (5) players; the 6th joins as a viewer", () => {
      for (let n = 1; n <= 5; n++) expect(room.join(player(n), `s${n}`).ok).toBe(true);
      const sixth = room.join(player(6), "s6");
      expect(sixth.ok && sixth.state.players.find((p) => p.id === pid(6))?.role).toBe("viewer");
      expect(room.occupiedSeats).toBe(5);
    });

    it("keeps a disconnected player's seat reserved, then frees it", () => {
      for (let n = 1; n <= 5; n++) room.join(player(n), `s${n}`);
      room.disconnect(pid(1), "s1");
      const early = room.join(player(6), "s6");
      expect(early.ok && early.state.players.find((p) => p.id === pid(6))?.role).toBe("viewer");
      expect(room.claimSeat(pid(6))).toEqual({ ok: false, error: "full" });

      now += SEAT_RESERVATION_MS;
      room.sweep();
      expect(spy.events("player:left")).toHaveLength(1);
      expect(room.claimSeat(pid(6))).toEqual({ ok: true });
      expect(room.player(pid(6))?.role).toBe("player");
    });

    it("lets a player reconnect into their reserved seat", () => {
      for (let n = 1; n <= 5; n++) room.join(player(n), `s${n}`);
      room.disconnect(pid(3), "s3");
      const again = room.join(player(3), "s3b");
      expect(again.ok).toBe(true);
      expect(room.isCurrentSocket(pid(3), "s3b")).toBe(true);
    });

    it("reports the old socket when the same player opens a second tab", () => {
      room.join(player(1), "tab1");
      const second = room.join(player(1), "tab2");
      expect(second.ok && second.replacedSocketId).toBe("tab1");
    });

    it("dedupes display names and marks the host", () => {
      room.join({ ...player(1, "Aziz"), clientId: "host_client" }, "s1");
      const second = room.join(player(2, "aziz"), "s2");
      expect(second.ok && second.state.players.map((p) => [p.name, p.isHost])).toEqual([
        ["Aziz", true],
        ["aziz 2", false],
      ]);
    });

    it("ignores a disconnect from a socket that was already replaced", () => {
      room.join(player(1), "tab1");
      room.join(player(1), "tab2");
      room.disconnect(pid(1), "tab1");
      expect(room.connectedCount).toBe(1);
    });
  });

  describe("locks", () => {
    beforeEach(() => {
      room.join(player(1), "s1");
      room.join(player(2), "s2");
    });

    it("gives a group to one player at a time", () => {
      expect(room.grab(pid(1), "s1", 0)).toEqual({ ok: true });
      expect(room.grab(pid(2), "s2", 0)).toEqual({
        ok: false,
        heldBy: pid(1),
      });
      expect(spy.events("piece:grabbed")).toHaveLength(1);
    });

    it("expires locks after LOCK_TIMEOUT_MS without moves", () => {
      room.grab(pid(1), "s1", 0);
      now += LOCK_TIMEOUT_MS - 1;
      room.move(pid(1), "s1", { groupId: 0, x: 1, y: 1 });
      now += LOCK_TIMEOUT_MS - 1;
      room.sweep();
      expect(spy.events("piece:released")).toHaveLength(0);
      now += 1;
      room.sweep();
      expect(spy.events("piece:released")).toHaveLength(1);
      expect(room.grab(pid(2), "s2", 0).ok).toBe(true);
    });

    it("releases locks when the holder disconnects", () => {
      room.grab(pid(1), "s1", 0);
      room.disconnect(pid(1), "s1");
      expect(room.grab(pid(2), "s2", 0).ok).toBe(true);
    });

    it("ignores moves from players who do not hold the lock", () => {
      room.grab(pid(1), "s1", 0);
      room.move(pid(2), "s2", { groupId: 0, x: 1, y: 1 });
      expect(room.puzzle.getGroup(0)!.x).toBe(5000);
    });

    it("refuses placed groups", () => {
      room.grab(pid(1), "s1", 0);
      room.drop(pid(1), "s1", { groupId: 0, x: 2, y: 2 });
      expect(room.grab(pid(2), "s2", 0).ok).toBe(false);
    });
  });

  describe("drop", () => {
    beforeEach(() => {
      room.join(player(1), "s1");
      room.join(player(2), "s2");
    });

    it("broadcasts a plain drop when nothing snaps", () => {
      room.grab(pid(1), "s1", 0);
      room.drop(pid(1), "s1", { groupId: 0, x: 100, y: 100 });
      expect(spy.events("piece:dropped")[0]).toMatchObject({
        to: "all",
        args: [0, 100, 100, pid(1)],
      });
    });

    it("snaps, counts merges per player and never merges into a group held by someone else", () => {
      // Piece 1 is aligned with piece 0 but player 2 is holding piece 0.
      room.grab(pid(2), "s2", 0);
      room.grab(pid(1), "s1", 1);
      room.drop(pid(1), "s1", { groupId: 1, x: 5000, y: 5000 });
      expect(spy.events("piece:snapped")).toHaveLength(0);

      // Once released, the same drop merges.
      room.drop(pid(2), "s2", { groupId: 0, x: 5000, y: 5000 });
      const snap = spy.events("piece:snapped")[0]!;
      expect(snap.args[0]).toMatchObject({ absorbed: [0], playerId: pid(2) });
      expect(room.stateFor(pid(2)).stats[pid(2)]).toEqual({ merges: 1 });
    });

    it("corrects only the sender on a stale drop", () => {
      room.drop(pid(1), "s1", { groupId: 3, x: 1, y: 1 });
      expect(spy.events("piece:dropped")[0]).toMatchObject({
        to: "one",
        socket: "s1",
        args: [3, 8000, 5000, pid(1)],
      });
    });

    it("announces completion once", () => {
      for (let id = 0; id < 12; id++) {
        const groupId = room.puzzle.groupOfPiece(id)!.id;
        room.grab(pid(1), "s1", groupId);
        room.drop(pid(1), "s1", { groupId, x: 0, y: 0 });
      }
      expect(room.info.status).toBe("COMPLETED");
      expect(spy.events("puzzle:completed")).toHaveLength(1);
      expect(room.persistable().status).toBe("COMPLETED");
    });
  });

  it("restores a saved state", () => {
    room.join(player(1), "s1");
    room.grab(pid(1), "s1", 0);
    room.drop(pid(1), "s1", { groupId: 0, x: 3, y: 3 });
    const saved = room.persistable();
    const restored = new Room(
      record({ state: saved.state, stats: saved.stats }),
      spyEmitter().emitter,
    );
    expect(restored.puzzle.snapshot()).toEqual(room.puzzle.snapshot());
  });
});

describe("Room relays", () => {
  it("relays reactions and viewports to other players only", () => {
    const spy = spyEmitter();
    const room = new Room(record(), spy.emitter);
    room.join(player(1), "s1");
    room.reaction(pid(1), "s1", { emoji: "🎉", x: 10, y: 20 });
    room.viewport(pid(1), "s1", { x: 0, y: 0, width: 800, height: 600 });
    expect(spy.events("reaction")[0]).toMatchObject({
      to: "others",
      socket: "s1",
      args: [pid(1), "🎉", 10, 20],
    });
    expect(spy.events("viewport")[0]).toMatchObject({ to: "others", socket: "s1" });
  });
});

describe("Room privacy", () => {
  it("never exposes private client ids to other players", () => {
    const spy = spyEmitter();
    const room = new Room(record(), spy.emitter);
    const first = room.join(player(1), "s1");
    room.join(player(2), "s2");
    const serialized = JSON.stringify([first, spy.sent, room.stateFor(pid(2))]);
    expect(serialized).not.toContain(player(1).clientId);
    expect(serialized).not.toContain(player(2).clientId);
    expect(first.ok && first.state.you).toBe(pid(1));
  });
});

describe("Room viewers and host actions", () => {
  let now: number;
  let spy: ReturnType<typeof spyEmitter>;
  let room: Room;
  const host = (): JoinPayload => ({ ...player(1, "Host"), clientId: "host_client" });
  const hostId = publicPlayerId("host_client");

  beforeEach(() => {
    now = 1_000_000;
    spy = spyEmitter();
    room = new Room(record({ maxPlayers: 3 }), spy.emitter, { now: () => now });
    room.join(host(), "h");
    room.join(player(2), "s2");
    room.join(player(3), "s3");
  });

  const roleOf = (id: string) => room.player(id)?.role;

  it("makes the 4th person a viewer who can watch but not play", () => {
    const fourth = room.join(player(4), "s4");
    expect(fourth.ok).toBe(true);
    expect(roleOf(pid(4))).toBe("viewer");
    expect(room.grab(pid(4), "s4", 0)).toEqual({ ok: false });
    room.cursor(pid(4), "s4", 1, 2);
    expect(spy.events("cursor")).toHaveLength(0);
    // Reactions from viewers are fine.
    room.reaction(pid(4), "s4", { emoji: "👏", x: 0, y: 0 });
    expect(spy.events("reaction")).toHaveLength(1);
  });

  it("lets people choose to watch, and viewers leave without keeping a seat", () => {
    room.join({ ...player(5), role: "viewer" }, "s5");
    expect(roleOf(pid(5))).toBe("viewer");
    room.disconnect(pid(5), "s5");
    expect(room.player(pid(5))).toBeUndefined();
    expect(spy.events("player:left").at(-1)?.args).toEqual([pid(5)]);
  });

  it("frees a seat when a player steps back, and a viewer can take it", () => {
    room.join(player(4), "s4");
    expect(room.leaveSeat(pid(2))).toEqual({ ok: true });
    expect(roleOf(pid(2))).toBe("viewer");
    expect(room.claimSeat(pid(4))).toEqual({ ok: true });
    expect(roleOf(pid(4))).toBe("player");
  });

  it("only the host can kick; a ban keeps the player out", () => {
    expect(room.kick(pid(2), pid(3), false)).toEqual({ ok: false, error: "not_host" });
    expect(room.kick(hostId, hostId, false)).toEqual({ ok: false, error: "invalid" });

    const result = room.kick(hostId, pid(3), true);
    expect(result).toEqual({ ok: true, socketId: "s3" });
    expect(spy.events("kicked")[0]).toMatchObject({ to: "one", socket: "s3", args: ["host"] });
    expect(room.player(pid(3))).toBeUndefined();
    expect(room.join(player(3), "s3b")).toEqual({ ok: false, error: "banned" });
    expect(room.persistable().banned).toEqual([pid(3)]);
  });

  it("a kick without ban lets the player rejoin", () => {
    room.grab(pid(2), "s2", 0);
    room.kick(hostId, pid(2), false);
    expect(spy.events("piece:released")).toHaveLength(1);
    expect(room.join(player(2), "s2b").ok).toBe(true);
  });

  it("the host moves people between players and viewers", () => {
    room.join(player(4), "s4");
    expect(room.setRole(hostId, pid(4), "player")).toEqual({ ok: false, error: "full" });
    expect(room.setRole(hostId, pid(3), "viewer")).toEqual({ ok: true });
    expect(room.setRole(hostId, pid(4), "player")).toEqual({ ok: true });
    expect(room.setRole(pid(2), pid(4), "viewer")).toEqual({ ok: false, error: "not_host" });
    expect([roleOf(pid(3)), roleOf(pid(4))]).toEqual(["viewer", "player"]);
  });

  it("only the host arranges, and pieces someone is holding stay with them", () => {
    room.grab(pid(2), "s2", 3);
    const before = { ...room.puzzle.getGroup(0)! };

    room.arrange(pid(2));
    expect(spy.events("groups:moved")).toHaveLength(0);
    expect(room.puzzle.getGroup(0)).toMatchObject({ x: before.x, y: before.y });

    room.arrange(hostId);
    const [moved] = spy.events("groups:moved");
    const ids = (moved!.args[0] as Array<{ id: number }>).map((m) => m.id);
    expect(ids).toContain(0);
    expect(ids).not.toContain(3);
    // The held piece is still player 2's: nobody else can take it, and they can keep dragging.
    expect(room.grab(hostId, "h", 3)).toEqual({ ok: false, heldBy: pid(2) });
    room.move(pid(2), "s2", { groupId: 3, x: 7, y: 8 });
    expect(room.puzzle.getGroup(3)).toMatchObject({ x: 7, y: 8 });
  });

  it("the host restarts: pieces scrambled again, timer and stats reset", () => {
    room.grab(pid(2), "s2", 0);
    room.drop(pid(2), "s2", { groupId: 0, x: 0, y: 0 });
    expect(room.puzzle.connectedPieceCount()).toBe(1);
    now += 60_000;

    expect(room.restart(pid(2))).toEqual({ ok: false, error: "not_host" });
    expect(room.restart(hostId, 123)).toEqual({ ok: true });
    expect(room.puzzle.connectedPieceCount()).toBe(0);
    expect(room.puzzle.groupCount).toBe(12);
    expect(room.info).toMatchObject({ status: "PLAYING", completedAt: null, startedAt: now });
    expect(room.stateFor(hostId).stats[pid(2)]).toEqual({ merges: 0 });
    expect(spy.events("puzzle:reset")).toHaveLength(1);
  });
});
