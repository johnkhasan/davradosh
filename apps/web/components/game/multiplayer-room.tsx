"use client";

import { MAX_PLAYERS_PER_ROOM, type PlayerDTO } from "@puzzle/shared";
import {
  Check,
  Eye,
  X,
  Frame,
  LayoutGrid,
  Link2,
  Loader2,
  Maximize,
  Minus,
  Plus,
  Volume2,
  VolumeX,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { IdentityDialog } from "@/components/identity-dialog";
import { setSoundEnabled } from "@/lib/game/sounds";
import { loadIdentity, type Identity } from "@/lib/identity";
import { RoomController, type RoomError } from "@/lib/realtime/room-controller";
import { VoiceController } from "@/lib/realtime/voice-controller";
import { cn } from "@/lib/utils";
import { CursorLayer } from "./cursor-layer";
import { PeopleButton, PeoplePanel, ViewerBanner } from "./people-panel";
import { Minimap } from "./minimap";
import { ReactionBar, ReactionLayer } from "./reactions";
import { AudioStartBanner, VideoBubbles, VoiceButtons, VoiceSettings } from "./voice";
import {
  Avatar,
  formatDuration,
  ProgressBar,
  TABLES,
  tableClass,
  ToolButton,
  type Table,
} from "./ui";

export function MultiplayerRoom({ roomId }: { roomId: string }) {
  // Rendered client-only (see room-loader), so localStorage is available here.
  const [identity, setIdentity] = useState<Identity | null>(() => loadIdentity());
  const [watchOnly, setWatchOnly] = useState(false);

  if (!identity) {
    return (
      <div className="fixed inset-0 table-felt">
        <IdentityDialog
          title="Puzzle'ga qo'shilish"
          description="Ismingiz va rangingizni tanlang. Boshqalar sizni kursoringizdan taniydi."
          submitLabel="Qo'shilish"
          onSubmit={setIdentity}
          secondaryLabel="Faqat tomosha qilish"
          onSecondary={(who) => {
            setWatchOnly(true);
            setIdentity(who);
          }}
        />
      </div>
    );
  }
  return (
    <RoomScreen
      key={identity.clientId + identity.name}
      roomId={roomId}
      identity={identity}
      watchOnly={watchOnly}
    />
  );
}

function RoomScreen({
  roomId,
  identity,
  watchOnly,
}: {
  roomId: string;
  identity: Identity;
  watchOnly: boolean;
}) {
  const [controller] = useState(() => new RoomController(roomId, identity, watchOnly));
  const [peopleOpen, setPeopleOpen] = useState(false);
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const [voice] = useState(
    () =>
      new VoiceController({
        roomId,
        clientId: identity.clientId,
        me: () => controller.getSnapshot().me,
        notify: (text) => controller.notify(text),
      }),
  );
  const voiceSnapshot = useSyncExternalStore(voice.subscribe, voice.getSnapshot, voice.getSnapshot);
  const [voiceSettings, setVoiceSettings] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const [ghost, setGhost] = useState(false);
  const [edgesOnly, setEdgesOnly] = useState(false);
  const [sound, setSound] = useState(true);
  const [table, setTable] = useState<Table>("felt");
  const [showCompleted, setShowCompleted] = useState(true);

  useEffect(() => {
    // Deferred one tick so React Strict Mode's mount/unmount/mount in development
    // doesn't open (and immediately abort) an extra WebSocket.
    const timer = window.setTimeout(() => {
      controller.connect();
      if (hostRef.current) controller.mount(hostRef.current);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.destroy();
    };
  }, [controller]);

  useEffect(() => controller.setTools({ ghost, edgesOnly }), [controller, ghost, edgesOnly]);

  // Voice needs a joined puzzle room: the server only gives tokens to connected players.
  useEffect(() => {
    if (snapshot.status === "ready") void voice.connect();
  }, [voice, snapshot.status]);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production")
      (window as unknown as { __voice: unknown }).__voice = voice;
    return () => voice.destroy();
  }, [voice]);
  useEffect(() => setSoundEnabled(sound), [sound]);

  useEffect(() => {
    const isTyping = (e: KeyboardEvent) =>
      e.target instanceof HTMLElement && ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName);
    const down = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const view = controller.puzzleView;
      if (e.key === "Tab" && document.activeElement === document.body) {
        e.preventDefault();
        setGhost(true);
      }
      if (e.key === "Escape") {
        controller.follow(null);
        setVoiceSettings(false);
      }
      if (!e.repeat && (e.key === "m" || e.key === "M")) void voice.toggleMic();
      if (!e.repeat && (e.key === "v" || e.key === "V")) void voice.toggleCam();
      if (e.key === "t" || e.key === "T") void voice.pushToTalk(true);
      if (e.key === "f" || e.key === "F") view?.fitToContent();
      if (e.key === "+" || e.key === "=") view?.zoomBy(1.25);
      if (e.key === "-" || e.key === "_") view?.zoomBy(0.8);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Tab") setGhost(false);
      if (e.key === "t" || e.key === "T") void voice.pushToTalk(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [controller, voice]);

  const { room, players, me, status, error, progress, completed, holding, notice, following } =
    snapshot;
  const followed = following ? players.find((p) => p.id === following) : undefined;
  const isViewer = players.find((p) => p.id === me)?.role === "viewer";
  const seatedPlayers = players.filter((p) => p.role === "player");
  const viewerCount = players.length - seatedPlayers.length;

  if (status === "error" && error) return <RoomErrorScreen error={error} />;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      <header className="z-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-surface/90 px-3 py-2 backdrop-blur sm:px-4">
        <Link href="/" className="font-display text-lg font-bold" aria-label="Bosh sahifa">
          🧩<span className="hidden sm:inline"> Puzzle</span>
        </Link>
        {room && (
          <span className="hidden text-sm text-muted md:inline">
            {room.cols * room.rows} bo&apos;lak ·{" "}
            <ElapsedTime since={room.startedAt} until={room.completedAt} />
          </span>
        )}
        <div className="order-last flex w-full justify-center sm:order-none sm:w-auto sm:flex-1">
          <ProgressBar connected={progress.connected} total={progress.total} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <PlayerStack
            players={seatedPlayers}
            me={me}
            holding={holding}
            following={following}
            onFollow={(id) => controller.follow(following === id ? null : id)}
            speaking={voiceSnapshot.speaking}
          />
          <span className="text-sm text-muted tabular-nums" title="O'yinchilar">
            {seatedPlayers.filter((p) => p.connected).length}/
            {room?.maxPlayers ?? MAX_PLAYERS_PER_ROOM}
          </span>
          <PeopleButton
            viewers={viewerCount}
            open={peopleOpen}
            onClick={() => setPeopleOpen((v) => !v)}
          />
          <InviteButton />
        </div>
      </header>

      <div className={cn("relative flex-1", tableClass(table))}>
        <div ref={hostRef} className="absolute inset-0" />
        <CursorLayer
          controller={controller}
          players={players}
          me={me}
          holding={holding}
          voice={voice}
          voiceSnapshot={voiceSnapshot}
        />
        <VideoBubbles voice={voice} snapshot={voiceSnapshot} players={players} me={me} />
        <AudioStartBanner voice={voice} snapshot={voiceSnapshot} />
        <ReactionLayer controller={controller} players={players} />
        {isViewer && room && !followed && (
          <ViewerBanner
            controller={controller}
            seated={seatedPlayers.length}
            maxPlayers={room.maxPlayers}
          />
        )}

        {followed && (
          <>
            <div
              className="pointer-events-none absolute inset-0 border-4"
              style={{ borderColor: followed.color }}
              aria-hidden
            />
            <div
              role="status"
              className="absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full py-1 pr-1 pl-3 text-sm font-medium text-white shadow-soft-md"
              style={{ backgroundColor: followed.color }}
            >
              {followed.avatar} {followed.name}ni kuzatyapsiz
              <button
                type="button"
                onClick={() => controller.follow(null)}
                className="flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 text-xs hover:bg-black/30"
                aria-label="Kuzatishni to'xtatish (Esc)"
              >
                <X className="size-3" aria-hidden /> Esc
              </button>
            </div>
          </>
        )}

        {(status === "connecting" || status === "loading") && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm shadow-soft-md">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {status === "connecting" ? "Ulanmoqda…" : "Puzzle tayyorlanmoqda…"}
            </div>
          </div>
        )}

        {status === "reconnecting" && (
          <div
            role="status"
            className="absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-amber-500 px-4 py-1.5 text-sm font-medium text-white shadow-soft-md"
          >
            <WifiOff className="size-4" aria-hidden />
            Aloqa uzildi. Qayta ulanmoqda…
          </div>
        )}

        <nav
          aria-label="Asboblar"
          className="absolute bottom-3 left-3 z-10 flex flex-row gap-1 rounded-card border border-border bg-surface/95 p-1.5 shadow-soft-md backdrop-blur sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:flex-col"
        >
          <ToolButton
            label="Asl rasm (Tab ni bosib turing)"
            active={ghost}
            onClick={() => setGhost((v) => !v)}
          >
            <Eye />
          </ToolButton>
          <ToolButton
            label="Faqat chekka bo'laklar"
            active={edgesOnly}
            onClick={() => setEdgesOnly((v) => !v)}
          >
            <Frame />
          </ToolButton>
          {!isViewer && (
            <ToolButton
              label="Bo'laklarni tartiblash (hamma uchun)"
              onClick={() => controller.arrange()}
            >
              <LayoutGrid />
            </ToolButton>
          )}
          <ToolButton
            label={sound ? "Ovozni o'chirish" : "Ovozni yoqish"}
            onClick={() => setSound((v) => !v)}
          >
            {sound ? <Volume2 /> : <VolumeX />}
          </ToolButton>
          {/* Viewers listen only: LiveKit does not let them publish. */}
          {!isViewer && (
            <VoiceButtons
              voice={voice}
              snapshot={voiceSnapshot}
              onOpenSettings={() => setVoiceSettings((v) => !v)}
            />
          )}
        </nav>

        <div className="absolute right-3 bottom-3 flex items-center gap-1 rounded-card border border-border bg-surface/95 p-1.5 shadow-soft-md backdrop-blur">
          <select
            value={table}
            onChange={(e) => setTable(e.target.value as Table)}
            className="hidden rounded-control bg-transparent px-2 py-1 text-sm sm:block"
            aria-label="Stol foni"
          >
            {Object.entries(TABLES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <ToolButton
            label="Kichiklashtirish (−)"
            className="hidden sm:flex"
            onClick={() => controller.puzzleView?.zoomBy(0.8)}
          >
            <Minus />
          </ToolButton>
          <ToolButton
            label="Kattalashtirish (+)"
            className="hidden sm:flex"
            onClick={() => controller.puzzleView?.zoomBy(1.25)}
          >
            <Plus />
          </ToolButton>
          <ToolButton
            label="Hammasini ko'rsatish (F)"
            onClick={() => controller.puzzleView?.fitToContent()}
          >
            <Maximize />
          </ToolButton>
        </div>

        <div className="absolute bottom-3 left-1/2 hidden -translate-x-1/2 sm:block">
          <ReactionBar onReact={(emoji) => controller.react(emoji)} />
        </div>

        <div className="absolute bottom-3 left-3 hidden rounded-card border border-border bg-surface/80 p-1.5 shadow-soft-md backdrop-blur lg:block">
          <Minimap controller={controller} players={players} me={me} />
        </div>

        {voiceSettings && voiceSnapshot.status !== "unavailable" && (
          <VoiceSettings
            voice={voice}
            snapshot={voiceSnapshot}
            isHost={players.find((p) => p.id === me)?.isHost ?? false}
            roomId={roomId}
            clientId={identity.clientId}
            onClose={() => setVoiceSettings(false)}
            notify={(text) => controller.notify(text)}
          />
        )}

        {peopleOpen && room && (
          <PeoplePanel
            controller={controller}
            players={players}
            me={me}
            maxPlayers={room.maxPlayers}
            following={following}
            onClose={() => setPeopleOpen(false)}
          />
        )}

        <Notice notice={notice} />

        {completed && showCompleted && (
          <CompletedDialog
            durationMs={completed.durationMs}
            stats={completed.stats}
            players={players}
            pieces={progress.total}
            onClose={() => setShowCompleted(false)}
            onRestart={controller.isHost ? () => void controller.restart() : undefined}
          />
        )}
      </div>
    </div>
  );
}

function PlayerStack({
  players,
  me,
  holding,
  following,
  onFollow,
  speaking,
}: {
  players: PlayerDTO[];
  me: string;
  holding: Record<string, number>;
  following: string | null;
  onFollow: (playerId: string) => void;
  speaking: Record<string, true>;
}) {
  const sorted = [...players].sort((a, b) => Number(b.id === me) - Number(a.id === me));
  return (
    <ul className="flex -space-x-2" aria-label="O'yinchilar">
      {sorted.map((player) => (
        <li key={player.id} className="relative">
          <button
            type="button"
            disabled={player.id === me || !player.connected}
            onClick={() => onFollow(player.id)}
            aria-pressed={following === player.id}
            title={player.id === me ? `${player.name} (siz)` : `${player.name}: ekranini kuzatish`}
            className="block rounded-full transition-transform enabled:hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:cursor-default"
          >
            <Avatar
              name={`${player.name}${player.id === me ? " (siz)" : ""}${player.isHost ? " · host" : ""}${player.connected ? "" : " · uzilgan"}`}
              color={player.color}
              avatar={player.avatar}
              dimmed={!player.connected}
              ring={
                holding[player.id] !== undefined ||
                following === player.id ||
                Boolean(speaking[player.id])
              }
            />
          </button>
          {player.isHost && (
            <span className="absolute -top-1 -right-1 text-[10px]" aria-hidden>
              👑
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function InviteButton() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const url = window.location.href;
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title: "Puzzle'ni birga yig'amiz!", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Share sheet dismissed or clipboard blocked; nothing to do.
    }
  };
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="flex items-center gap-1.5 rounded-control bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-soft-sm transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
      <span className="hidden sm:inline">{copied ? "Nusxalandi!" : "Taklif qilish"}</span>
      <span className="sr-only sm:hidden">{copied ? "Nusxalandi" : "Havolani nusxalash"}</span>
    </button>
  );
}

function ElapsedTime({ since, until }: { since: number; until: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [until]);
  const ms = (until ?? now) - since;
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="tabular-nums">
      ⏱ {h ? `${h}:${pad(m)}` : m}:{pad(s)}
    </span>
  );
}

function Notice({ notice }: { notice: { id: number; text: string } | null }) {
  const [hiddenId, setHiddenId] = useState<number | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setHiddenId(notice.id), 2200);
    return () => window.clearTimeout(timer);
  }, [notice]);
  if (!notice || hiddenId === notice.id) return null;
  return (
    <div
      role="status"
      key={notice.id}
      className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-soft-lg motion-safe:animate-[pop_160ms_ease-out]"
    >
      {notice.text}
    </div>
  );
}

function CompletedDialog({
  durationMs,
  stats,
  players,
  pieces,
  onClose,
  onRestart,
}: {
  durationMs: number;
  stats: Record<string, { merges: number }>;
  players: PlayerDTO[];
  pieces: number;
  onClose: () => void;
  /** Host only: play the same picture again. */
  onRestart?: () => void;
}) {
  const rows = players
    .filter((player) => player.role === "player" || stats[player.id])
    .map((player) => ({ player, merges: stats[player.id]?.merges ?? 0 }))
    .sort((a, b) => b.merges - a.merges);
  const max = Math.max(1, ...rows.map((r) => r.merges));
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="completed-title"
        className="w-full max-w-sm rounded-card bg-surface p-6 text-center shadow-soft-lg motion-safe:animate-[pop_200ms_ease-out]"
      >
        <div className="text-5xl" aria-hidden>
          🎉
        </div>
        <h2 id="completed-title" className="mt-3 font-display text-2xl font-bold">
          Birga uddaladingiz!
        </h2>
        <p className="mt-1 text-muted">
          {pieces} bo&apos;lak · {formatDuration(durationMs)}
        </p>
        <ul className="mt-5 space-y-2 text-left">
          {rows.map(({ player, merges }, index) => (
            <li key={player.id} className="flex items-center gap-2">
              <Avatar name={player.name} color={player.color} avatar={player.avatar} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between text-sm">
                  <span className="truncate font-medium">
                    {player.name} {index === 0 && merges > 0 && "🏆"}
                  </span>
                  <span className="text-muted tabular-nums">{merges}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(merges / max) * 100}%`, backgroundColor: player.color }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-control border border-border px-4 py-2.5 font-medium hover:bg-surface-muted"
          >
            Rasmni ko&apos;rish
          </button>
          {onRestart ? (
            <button
              type="button"
              onClick={onRestart}
              className="flex-1 rounded-control bg-primary px-4 py-2.5 font-medium text-primary-foreground"
            >
              Yana o&apos;ynash
            </button>
          ) : (
            <Link
              href="/"
              className="flex-1 rounded-control bg-primary px-4 py-2.5 font-medium text-primary-foreground"
            >
              Yangi puzzle
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

const ERRORS: Record<RoomError, { emoji: string; title: string; text: string }> = {
  full: {
    emoji: "🙈",
    title: "Xona to'la",
    text: "O'yinchilar ham, tomoshabinlar ham to'la. Birozdan keyin qayta urinib ko'ring yoki o'z puzzle'ingizni yarating.",
  },
  not_found: {
    emoji: "🔍",
    title: "Puzzle topilmadi",
    text: "Havola noto'g'ri yoki puzzle muddati tugagan (puzzle'lar 7 kun saqlanadi).",
  },
  invalid: {
    emoji: "⚠️",
    title: "Qo'shilib bo'lmadi",
    text: "Ism yoki havola noto'g'ri ko'rinishda. Sahifani yangilab qayta urinib ko'ring.",
  },
  banned: {
    emoji: "🚫",
    title: "Kirish taqiqlangan",
    text: "Bu puzzle'ning egasi sizni xonadan chiqarib yuborgan. Boshqa puzzle'ga qo'shiling yoki o'zingiznikini yarating.",
  },
  removed: {
    emoji: "👋",
    title: "Siz xonadan chiqarildingiz",
    text: "Puzzle egasi sizni bu xonadan chiqardi. Havola orqali qayta kirishingiz mumkin (agar bloklanmagan bo'lsangiz).",
  },
  kicked: {
    emoji: "🪟",
    title: "Boshqa oynada ochildi",
    text: "Bu puzzle boshqa tab yoki qurilmada ochilgani uchun bu yerda to'xtatildi.",
  },
  connection: {
    emoji: "📡",
    title: "Server bilan aloqa yo'q",
    text: "Internet aloqangizni tekshirib, sahifani yangilang.",
  },
  image: {
    emoji: "🖼️",
    title: "Rasm yuklanmadi",
    text: "Puzzle rasmini yuklab bo'lmadi. Sahifani yangilab ko'ring.",
  },
};

function RoomErrorScreen({ error }: { error: RoomError }) {
  const info = ERRORS[error];
  return (
    <main className="fixed inset-0 flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-card border border-border bg-surface p-8 text-center shadow-soft-md">
        <div className="text-5xl" aria-hidden>
          {info.emoji}
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold">{info.title}</h1>
        <p className="mt-2 text-muted">{info.text}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="rounded-control border border-border px-4 py-2.5 font-medium hover:bg-surface-muted"
          >
            Qayta urinish
          </button>
          <Link
            href="/"
            className="rounded-control bg-primary px-4 py-2.5 font-medium text-primary-foreground"
          >
            Bosh sahifa
          </Link>
        </div>
      </div>
    </main>
  );
}
