/**
 * Load test: ROOMS rooms × 5 simulated players. Every player moves its cursor
 * 25 times a second and keeps grabbing, dragging and dropping pieces, like a
 * busy real session. Reports grab round-trip latency and server throughput.
 *
 *   pnpm --filter @puzzle/server load-test -- --url http://localhost:4100 --rooms 6 --seconds 30
 */
import type { ClientToServerEvents, RoomStateDTO, ServerToClientEvents } from "@puzzle/shared";
import { io, type Socket } from "socket.io-client";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2)
  args.set(process.argv[i]!.replace(/^--/, ""), process.argv[i + 1] ?? "");
const url = args.get("url") ?? "http://localhost:4100";
const roomCount = Number(args.get("rooms") ?? 6);
const seconds = Number(args.get("seconds") ?? 30);
const playersPerRoom = 5;

const grabLatencies: number[] = [];
let received = 0;
let sent = 0;

async function createRoom(): Promise<string> {
  const res = await fetch(`${url}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      clientId: `load_host_${Math.random().toString(36).slice(2)}`,
      imageId: "demo",
      pieces: 200,
    }),
  });
  if (!res.ok) throw new Error(`create room failed: ${res.status}`);
  return ((await res.json()) as { id: string }).id;
}

async function player(roomId: string, n: number): Promise<() => void> {
  const socket: Client = io(url, { transports: ["websocket"], forceNew: true });
  socket.onAny(() => received++);
  const ack = await socket.emitWithAck("room:join", {
    roomId,
    clientId: `load_${roomId}_${n}_${Math.random().toString(36).slice(2, 8)}`,
    name: `Bot ${n}`,
    color: "#6C5CE7",
    avatar: "🤖",
  });
  if (!ack.ok) throw new Error(`join failed: ${ack.error}`);
  const state: RoomStateDTO = ack.state;
  const groups = state.puzzle.groups.map((g) => ({ ...g }));

  let t = Math.random() * 1000;
  const cursorTimer = setInterval(() => {
    t += 40;
    socket.emit("cursor:move", {
      x: 1000 + Math.sin(t / 500 + n) * 800,
      y: 800 + Math.cos(t / 700 + n) * 600,
    });
    sent++;
  }, 40);

  let stopped = false;
  const dragLoop = async () => {
    while (!stopped) {
      const group = groups[Math.floor(Math.random() * groups.length)]!;
      const started = performance.now();
      const res = await socket
        .emitWithAck("piece:grab", { groupId: group.id })
        .catch(() => ({ ok: false }));
      sent++;
      grabLatencies.push(performance.now() - started);
      if (res.ok) {
        for (let step = 0; step < 20 && !stopped; step++) {
          group.x += (Math.random() - 0.5) * 40;
          group.y += (Math.random() - 0.5) * 40;
          socket.emit("piece:move", { groupId: group.id, x: group.x, y: group.y });
          sent++;
          await new Promise((r) => setTimeout(r, 40));
        }
        socket.emit("piece:drop", { groupId: group.id, x: group.x, y: group.y });
        sent++;
      }
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 700));
    }
  };
  void dragLoop();

  return () => {
    stopped = true;
    clearInterval(cursorTimer);
    socket.disconnect();
  };
}

function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))] ?? 0;
}

const rooms = await Promise.all(Array.from({ length: roomCount }, createRoom));
const stops = (
  await Promise.all(
    rooms.flatMap((roomId) => Array.from({ length: playersPerRoom }, (_, n) => player(roomId, n))),
  )
).flat();
console.log(
  `${rooms.length} rooms × ${playersPerRoom} players = ${stops.length} clients, running ${seconds}s…`,
);

await new Promise((r) => setTimeout(r, seconds * 1000));
for (const stop of stops) stop();

console.log(
  JSON.stringify(
    {
      clients: stops.length,
      sentPerSecond: Math.round(sent / seconds),
      receivedPerSecond: Math.round(received / seconds),
      grabs: grabLatencies.length,
      grabLatencyMs: {
        p50: +percentile(grabLatencies, 50).toFixed(1),
        p95: +percentile(grabLatencies, 95).toFixed(1),
        p99: +percentile(grabLatencies, 99).toFixed(1),
        max: +Math.max(...grabLatencies).toFixed(1),
      },
    },
    null,
    2,
  ),
);
process.exit(0);
