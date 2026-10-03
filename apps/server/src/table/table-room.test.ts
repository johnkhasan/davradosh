import type { GameEngine, TableRoomStateDTO } from "@puzzle/shared/games";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { publicPlayerId } from "../lib/ids";
import type { TableRoomRecord } from "./repository";
import { TableRoom } from "./table-room";

/** A toy game: players take turns adding 1 or 2; whoever reaches 5 wins. Seat 1 hides a secret. */
type State = {
  total: number;
  turn: number;
  players: number;
  winner: number | null;
  secret: number;
};
const toy: GameEngine<State, { add: number }, { total: number; secret: number | null }, object> = {
  kind: "chess",
  moveSchema: z.object({ add: z.number().int().min(1).max(2) }),
  optionsSchema: z.object({}),
  setup: (players) => ({ total: 0, turn: 0, players, winner: null, secret: 42 }),
  move(state, seat, move) {
    if (seat !== state.turn) return { ok: false, error: "not_your_turn" };
    state.total += move.add;
    if (state.total >= 5) state.winner = seat;
    state.turn = (state.turn + 1) % state.players;
    return { ok: true, state };
  },
  view: (state, seat) => ({ total: state.total, secret: seat === 1 ? state.secret : null }),
  active: (state) => [state.turn],
  result: (state) =>
    state.winner === null ? null : { winners: [state.winner], draw: false, reason: "five" },
  leave: (state, seat) => ({ ...state, winner: (seat + 1) % state.players }),
};

function setup() {
  let now = 1_000;
  const sent: Record<string, TableRoomStateDTO> = {};
  const record: TableRoomRecord = {
    id: "room1234",
    kind: "chess",
    hostId: publicPlayerId("host-client"),
    options: {},
    status: "lobby",
    members: [],
    game: null,
    round: 0,
    banned: [],
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
  };
  const room = new TableRoom(
    record,
    toy,
    { state: (socket, state) => void (sent[socket] = state) },
    { now: () => now, reconnectMs: 5_000 },
  );
  const join = (client: string, socket: string) =>
    room.join(
      {
        roomId: "room1234",
        clientId: client,
        name: client.slice(0, 8),
        color: "#6C5CE7",
        avatar: "🦊",
      },
      socket,
    );
  return { room, sent, join, advance: (ms: number) => (now += ms) };
}

describe("TableRoom", () => {
  it("seats two players, makes a third a spectator and plays to a result", () => {
    const { room, sent, join } = setup();
    const host = join("host-client", "s1");
    const guest = join("guest-client", "s2");
    const third = join("third-client", "s3");
    expect(third.ok && third.state.members.find((m) => m.id === third.state.you)?.spectator).toBe(
      true,
    );
    if (!host.ok || !guest.ok) throw new Error("join failed");
    const hostId = host.state.you;
    const guestId = guest.state.you;
    expect(room.start(hostId)).toEqual({ ok: false, error: "not_ready" });
    room.setReady(guestId, true);
    expect(room.start(hostId)).toEqual({ ok: true });
    expect(sent.s2!.game?.yourSeat).toBe(1);
    expect(sent.s2!.game?.view).toEqual({ total: 0, secret: 42 });
    expect(sent.s1!.game?.view).toEqual({ total: 0, secret: null });
    expect(room.move(guestId, { add: 1 })).toEqual({ ok: false, error: "not_your_turn" });
    expect(room.move(hostId, { add: 3 })).toEqual({ ok: false, error: "invalid" });
    room.move(hostId, { add: 2 });
    room.move(guestId, { add: 1 });
    room.move(hostId, { add: 2 });
    expect(sent.s1!.game?.result).toEqual({ winners: [0], draw: false, reason: "five" });
    expect(sent.s1!.members.find((m) => m.id === hostId)?.wins).toBe(1);
    expect(room.move(guestId, { add: 1 }).ok).toBe(false);
    // Rematch swaps the seats.
    expect(room.rematch(hostId)).toEqual({ ok: true });
    room.setReady(guestId, true);
    room.start(hostId);
    expect(sent.s2!.game?.yourSeat).toBe(0);
  });

  it("a resign or a player who never comes back ends a two-player game", () => {
    const { room, sent, join, advance } = setup();
    const host = join("host-client", "s1");
    const guest = join("guest-client", "s2");
    if (!host.ok || !guest.ok) throw new Error("join failed");
    room.setReady(guest.state.you, true);
    room.start(host.state.you);
    room.disconnect(guest.state.you, "s2");
    advance(6_000);
    room.tick();
    expect(sent.s1!.game?.result?.winners).toEqual([0]);
    expect(sent.s1!.game?.seats[1]?.left).toBe(true);
  });

  it("keeps the last chat messages", () => {
    const { room, sent, join } = setup();
    const host = join("host-client", "s1");
    if (!host.ok) throw new Error("join failed");
    for (let i = 0; i < 60; i++) room.say(host.state.you, `msg ${i}`);
    expect(sent.s1!.chat).toHaveLength(50);
    expect(sent.s1!.chat.at(-1)?.text).toBe("msg 59");
  });
});
