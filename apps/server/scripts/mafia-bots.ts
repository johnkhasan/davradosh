/**
 * Dev helper: fills a mafia table with bots that play by the rules.
 *
 *   pnpm --filter @puzzle/server exec tsx scripts/mafia-bots.ts [url] [bots] [roomId]
 *
 * With 9 bots and a roomId, you take the tenth seat in the browser and play with them.
 * Without a roomId the script creates a table and 10 bots play a whole game on their own.
 */
import type {
  MafiaClientToServerEvents,
  MafiaRoomStateDTO,
  MafiaServerToClientEvents,
} from "@puzzle/shared/mafia";
import { io, type Socket } from "socket.io-client";

type Client = Socket<MafiaServerToClientEvents, MafiaClientToServerEvents>;

const url = process.argv[2] ?? "http://localhost:4200";
const count = Number(process.argv[3] ?? 10);
let roomId = process.argv[4];

const NAMES = [
  "Aziz",
  "Malika",
  "Jasur",
  "Dilnoza",
  "Bobur",
  "Nigora",
  "Sardor",
  "Kamola",
  "Otabek",
  "Zarina",
];
const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)]!;

async function main() {
  if (!roomId) {
    const res = await fetch(`${url}/api/mafia/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: "mafia_bot_0_xxxxxxxx" }),
    });
    roomId = ((await res.json()) as { id: string }).id;
  }
  console.log(`room ${roomId}  (web: http://localhost:3100/mafia/${roomId})`);

  let done = false;
  const bots = await Promise.all(Array.from({ length: count }, (_, i) => bot(i, () => done)));
  const host = bots[0]!;

  // Everyone but the host gets ready; a bot host then starts as soon as the table is full.
  for (const b of bots) {
    const isHost = b.state?.members.find((m) => m.id === b.state?.you)?.isHost;
    if (!isHost) await b.socket.emitWithAck("mafia:ready", { ready: true });
  }
  const started = Date.now();
  while (!host.state?.game) {
    if (host.state?.members.find((m) => m.id === host.state?.you)?.isHost) {
      const result = await host.socket.emitWithAck("mafia:start");
      if (result.ok) break;
    }
    await sleep(500);
    if (Date.now() - started > 10 * 60_000) throw new Error("table never filled");
  }
  console.log("game started");

  await new Promise<void>((resolve) => {
    const timer = setInterval(() => {
      const game = host.state?.game;
      if (game?.result) {
        clearInterval(timer);
        done = true;
        console.log(`game over: ${game.result}`);
        for (const seat of game.seats)
          console.log(
            `  ${seat.seat}. ${seat.name} — ${seat.role} ${seat.alive ? "" : `(${seat.exit})`}`,
          );
        resolve();
      }
    }, 500);
  });
  for (const b of bots) b.socket.disconnect();
}

async function bot(n: number, finished: () => boolean) {
  const socket: Client = io(`${url}/mafia`, { transports: ["websocket"], forceNew: true });
  const me = { socket, state: null as MafiaRoomStateDTO | null };
  let acting = false;

  const act = async () => {
    const game = me.state?.game;
    if (!game || acting || finished()) return;
    acting = true;
    try {
      const alive = game.seats.filter((s) => s.alive).map((s) => s.seat);
      const others = alive.filter((s) => s !== game.me);
      const known = new Set(game.seats.filter((s) => s.role !== null).map((s) => s.seat));
      if (game.actions.includes("bestMove")) {
        const seats = [...others].sort(() => Math.random() - 0.5).slice(0, 3);
        await socket.emitWithAck("mafia:best-move", { seats });
      } else if (game.actions.includes("shoot")) {
        // The black team agrees on the lowest seat that is not one of them.
        const target = alive.find((s) => !known.has(s)) ?? alive[0]!;
        await socket.emitWithAck("mafia:shoot", { seat: target });
      } else if (game.actions.includes("check")) {
        await socket.emitWithAck("mafia:check", { seat: pick(others) });
      } else if (game.actions.includes("vote") && game.ballot.length > 0) {
        await socket.emitWithAck("mafia:vote", { seat: pick(game.ballot) });
      } else if (game.actions.includes("liftAll")) {
        await socket.emitWithAck("mafia:lift-all", { agree: Math.random() < 0.5 });
      } else if (game.actions.includes("pass")) {
        await sleep(300 + Math.random() * 700);
        if (game.actions.includes("nominate") && Math.random() < 0.6) {
          const free = others.filter((s) => !game.nominations.some((m) => m.seat === s));
          if (free.length) await socket.emitWithAck("mafia:nominate", { seat: pick(free) });
        }
        await socket.emitWithAck("mafia:pass");
      }
    } finally {
      acting = false;
    }
  };

  socket.on("mafia:state", (state) => {
    me.state = state;
    void act();
  });
  await new Promise<void>((resolve) => socket.on("connect", () => resolve()));
  const ack = await socket.emitWithAck("mafia:join", {
    roomId: roomId!,
    clientId: `mafia_bot_${n}_xxxxxxxx`,
    name: NAMES[n % NAMES.length]!,
    color: "#6C5CE7",
    avatar: "🤖",
  });
  if (!ack.ok) throw new Error(`bot ${n} could not join: ${ack.error}`);
  me.state = ack.state;
  // Actions may be open without a new push (e.g. a vote that is already running).
  setInterval(() => void act(), 1_000);
  return me;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
