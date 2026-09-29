import { LOCK_TIMEOUT_MS, SEAT_RESERVATION_MS, type JoinPayload } from "@puzzle/shared";
import { beforeEach, describe, expect, it } from "vitest";
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
    others: (socket, _volatile, event, ...args) => sent.push({ to: "others", socket, event, args }),
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
    completedAt: null,
    expiresAt: new Date(Date.now() + 1e9),
    ...overrides,
  };
}

const player = (n: number, name = `Player ${n}`): JoinPayload => ({
  roomId: "room1234",
  clientId: `client_${n}_xxxx`,
  name,
  color: "#6C5CE7",
  avatar: "🦊",
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
    it("allows at most maxPlayers (5) players", () => {
      for (let n = 1; n <= 5; n++) expect(room.join(player(n), `s${n}`).ok).toBe(true);
      expect(room.join(player(6), "s6")).toEqual({ ok: false, error: "full" });
    });

    it("keeps a disconnected player's seat reserved, then frees it", () => {
      for (let n = 1; n <= 5; n++) room.join(player(n), `s${n}`);
      room.disconnect(player(1).clientId, "s1");
      expect(room.join(player(6), "s6").ok).toBe(false);

      now += SEAT_RESERVATION_MS;
      room.sweep();
      expect(spy.events("player:left")).toHaveLength(1);
      expect(room.join(player(6), "s6").ok).toBe(true);
    });

    it("lets a player reconnect into their reserved seat", () => {
      for (let n = 1; n <= 5; n++) room.join(player(n), `s${n}`);
      room.disconnect(player(3).clientId, "s3");
      const again = room.join(player(3), "s3b");
      expect(again.ok).toBe(true);
      expect(room.isCurrentSocket(player(3).clientId, "s3b")).toBe(true);
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
      room.disconnect(player(1).clientId, "tab1");
      expect(room.connectedCount).toBe(1);
    });
  });

  describe("locks", () => {
    beforeEach(() => {
      room.join(player(1), "s1");
      room.join(player(2), "s2");
    });

    it("gives a group to one player at a time", () => {
      expect(room.grab(player(1).clientId, "s1", 0)).toEqual({ ok: true });
      expect(room.grab(player(2).clientId, "s2", 0)).toEqual({
        ok: false,
        heldBy: player(1).clientId,
      });
      expect(spy.events("piece:grabbed")).toHaveLength(1);
    });

    it("expires locks after LOCK_TIMEOUT_MS without moves", () => {
      room.grab(player(1).clientId, "s1", 0);
      now += LOCK_TIMEOUT_MS - 1;
      room.move(player(1).clientId, "s1", { groupId: 0, x: 1, y: 1 });
      now += LOCK_TIMEOUT_MS - 1;
      room.sweep();
      expect(spy.events("piece:released")).toHaveLength(0);
      now += 1;
      room.sweep();
      expect(spy.events("piece:released")).toHaveLength(1);
      expect(room.grab(player(2).clientId, "s2", 0).ok).toBe(true);
    });

    it("releases locks when the holder disconnects", () => {
      room.grab(player(1).clientId, "s1", 0);
      room.disconnect(player(1).clientId, "s1");
      expect(room.grab(player(2).clientId, "s2", 0).ok).toBe(true);
    });

    it("ignores moves from players who do not hold the lock", () => {
      room.grab(player(1).clientId, "s1", 0);
      room.move(player(2).clientId, "s2", { groupId: 0, x: 1, y: 1 });
      expect(room.puzzle.getGroup(0)!.x).toBe(5000);
    });

    it("refuses placed groups", () => {
      room.grab(player(1).clientId, "s1", 0);
      room.drop(player(1).clientId, "s1", { groupId: 0, x: 2, y: 2 });
      expect(room.grab(player(2).clientId, "s2", 0).ok).toBe(false);
    });
  });

  describe("drop", () => {
    beforeEach(() => {
      room.join(player(1), "s1");
      room.join(player(2), "s2");
    });

    it("broadcasts a plain drop when nothing snaps", () => {
      room.grab(player(1).clientId, "s1", 0);
      room.drop(player(1).clientId, "s1", { groupId: 0, x: 100, y: 100 });
      expect(spy.events("piece:dropped")[0]).toMatchObject({
        to: "all",
        args: [0, 100, 100, player(1).clientId],
      });
    });

    it("snaps, counts merges per player and never merges into a group held by someone else", () => {
      // Piece 1 is aligned with piece 0 but player 2 is holding piece 0.
      room.grab(player(2).clientId, "s2", 0);
      room.grab(player(1).clientId, "s1", 1);
      room.drop(player(1).clientId, "s1", { groupId: 1, x: 5000, y: 5000 });
      expect(spy.events("piece:snapped")).toHaveLength(0);

      // Once released, the same drop merges.
      room.drop(player(2).clientId, "s2", { groupId: 0, x: 5000, y: 5000 });
      const snap = spy.events("piece:snapped")[0]!;
      expect(snap.args[0]).toMatchObject({ absorbed: [0], playerId: player(2).clientId });
      expect(room.stateFor(player(2).clientId).stats[player(2).clientId]).toEqual({ merges: 1 });
    });

    it("corrects only the sender on a stale drop", () => {
      room.drop(player(1).clientId, "s1", { groupId: 3, x: 1, y: 1 });
      expect(spy.events("piece:dropped")[0]).toMatchObject({
        to: "one",
        socket: "s1",
        args: [3, 8000, 5000, player(1).clientId],
      });
    });

    it("announces completion once", () => {
      for (let id = 0; id < 12; id++) {
        const groupId = room.puzzle.groupOfPiece(id)!.id;
        room.grab(player(1).clientId, "s1", groupId);
        room.drop(player(1).clientId, "s1", { groupId, x: 0, y: 0 });
      }
      expect(room.info.status).toBe("COMPLETED");
      expect(spy.events("puzzle:completed")).toHaveLength(1);
      expect(room.persistable().status).toBe("COMPLETED");
    });
  });

  it("restores a saved state", () => {
    room.join(player(1), "s1");
    room.grab(player(1).clientId, "s1", 0);
    room.drop(player(1).clientId, "s1", { groupId: 0, x: 3, y: 3 });
    const saved = room.persistable();
    const restored = new Room(
      record({ state: saved.state, stats: saved.stats }),
      spyEmitter().emitter,
    );
    expect(restored.puzzle.snapshot()).toEqual(room.puzzle.snapshot());
  });
});
