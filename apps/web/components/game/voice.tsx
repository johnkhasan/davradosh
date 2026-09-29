"use client";

import type { PlayerDTO } from "@puzzle/shared";
import { Mic, MicOff, Settings2, Video, VideoOff, Volume2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { API_URL } from "@/lib/env";
import type { VoiceController, VoiceSnapshot } from "@/lib/realtime/voice-controller";
import { cn } from "@/lib/utils";
import { ToolButton } from "./ui";

/** Mic, camera and settings buttons for the tool bar. Hidden when voice is not configured. */
export function VoiceButtons({
  voice,
  snapshot,
  onOpenSettings,
}: {
  voice: VoiceController;
  snapshot: VoiceSnapshot;
  onOpenSettings: () => void;
}) {
  if (snapshot.status === "unavailable") return null;
  const ready = snapshot.status === "connected";
  const micLabel = !ready
    ? "Ovoz ulanmoqda…"
    : snapshot.micOn
      ? "Mikrofonni o'chirish (M)"
      : "Mikrofonni yoqish (M)";
  return (
    <>
      <span className="mx-0.5 h-px w-auto bg-border max-sm:h-auto max-sm:w-px" aria-hidden />
      <ToolButton
        label={micLabel}
        active={snapshot.micOn || snapshot.pushToTalk}
        onClick={() => void voice.toggleMic()}
        className={cn(
          !ready && "opacity-50",
          (snapshot.micOn || snapshot.pushToTalk) && "text-snap",
        )}
      >
        {snapshot.micOn || snapshot.pushToTalk ? <Mic /> : <MicOff />}
      </ToolButton>
      <ToolButton
        label={snapshot.camOn ? "Kamerani o'chirish (V)" : "Kamerani yoqish (V)"}
        active={snapshot.camOn}
        onClick={() => void voice.toggleCam()}
        className={cn(!ready && "opacity-50")}
      >
        {snapshot.camOn ? <Video /> : <VideoOff />}
      </ToolButton>
      <ToolButton
        label="Ovoz va video sozlamalari"
        onClick={onOpenSettings}
        className="max-sm:hidden"
      >
        <Settings2 />
      </ToolButton>
    </>
  );
}

/** iOS Safari (and some Chrome setups) block audio until the user taps once. */
export function AudioStartBanner({
  voice,
  snapshot,
}: {
  voice: VoiceController;
  snapshot: VoiceSnapshot;
}) {
  if (!snapshot.needsAudioStart || snapshot.status !== "connected") return null;
  return (
    <button
      type="button"
      onClick={() => void voice.startAudio()}
      className="absolute top-16 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-soft-lg"
    >
      <Volume2 className="size-4" aria-hidden /> Boshqalarni eshitish uchun bosing
    </button>
  );
}

/** Round camera bubbles; click one to enlarge it. */
export function VideoBubbles({
  voice,
  snapshot,
  players,
  me,
  belowActions = false,
}: {
  voice: VoiceController;
  snapshot: VoiceSnapshot;
  players: PlayerDTO[];
  me: string;
  /** Leave room for buttons in the top-right corner (finished-round view). */
  belowActions?: boolean;
}) {
  const [big, setBig] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const shown = snapshot.facesOnCursors
    ? snapshot.cameras.filter((id) => id === me)
    : snapshot.cameras;
  if (shown.length === 0) return null;

  return (
    <div
      className={cn(
        "absolute right-3 z-10 flex flex-col items-end gap-2 max-sm:flex-row-reverse max-sm:items-start",
        belowActions ? "top-16" : "top-3 max-sm:top-2",
      )}
    >
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="rounded-full bg-surface/90 px-2 py-0.5 text-xs font-medium text-muted shadow-soft-sm hover:text-foreground"
        aria-expanded={!collapsed}
      >
        {collapsed ? `📹 ${shown.length}` : "Yig'ish"}
      </button>
      {!collapsed &&
        shown.map((id) => {
          const player = players.find((p) => p.id === id);
          if (!player) return null;
          return (
            <VideoBubble
              key={id}
              voice={voice}
              playerId={id}
              player={player}
              mirrored={id === me}
              speaking={Boolean(snapshot.speaking[id])}
              big={big === id}
              onToggle={() => setBig((current) => (current === id ? null : id))}
              trackKey={snapshot.cameras.join(",")}
            />
          );
        })}
    </div>
  );
}

function VideoBubble({
  voice,
  playerId,
  player,
  mirrored,
  speaking,
  big,
  onToggle,
  trackKey,
}: {
  voice: VoiceController;
  playerId: string;
  player: PlayerDTO;
  mirrored: boolean;
  speaking: boolean;
  big: boolean;
  onToggle: () => void;
  trackKey: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return voice.attachCamera(playerId, element);
  }, [voice, playerId, trackKey]);

  return (
    <button
      type="button"
      onClick={onToggle}
      title={player.name}
      aria-label={`${player.name} kamerasi${big ? " (kichiklashtirish)" : " (kattalashtirish)"}`}
      className={cn(
        "relative overflow-hidden rounded-full bg-black shadow-soft-md transition-all duration-200",
        big
          ? "size-56 max-sm:size-36"
          : speaking
            ? "size-28 max-sm:size-20"
            : "size-24 max-sm:size-16",
      )}
      style={{ boxShadow: `0 0 0 ${speaking ? 4 : 2}px ${player.color}` }}
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        className={cn("size-full object-cover", mirrored && "-scale-x-100")}
      />
      <span
        className="absolute bottom-1 left-1/2 max-w-[90%] -translate-x-1/2 truncate rounded-full px-2 text-[10px] font-semibold text-white"
        style={{ backgroundColor: player.color }}
      >
        {player.name}
      </span>
    </button>
  );
}

/** Devices, spatial audio, faces on cursors and the host's "mute everyone". */
export function VoiceSettings({
  voice,
  snapshot,
  isHost,
  roomId,
  clientId,
  onClose,
  notify,
}: {
  voice: VoiceController;
  snapshot: VoiceSnapshot;
  isHost: boolean;
  roomId: string;
  clientId: string;
  onClose: () => void;
  notify: (text: string) => void;
}) {
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([voice.devices("audioinput"), voice.devices("videoinput")]).then(([a, v]) => {
      if (cancelled) return;
      setMics(a.filter((d) => d.deviceId));
      setCams(v.filter((d) => d.deviceId));
    });
    return () => {
      cancelled = true;
    };
  }, [voice]);

  const muteAll = async () => {
    const res = await fetch(`${API_URL}/api/rooms/${encodeURIComponent(roomId)}/rtc/mute-all`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId }),
    }).catch(() => null);
    notify(res?.ok ? "Hammaning mikrofoni o'chirildi" : "Bajarib bo'lmadi");
  };

  return (
    <div
      role="dialog"
      aria-label="Ovoz va video sozlamalari"
      className="absolute top-1/2 left-16 z-20 w-72 -translate-y-1/2 rounded-card border border-border bg-surface p-4 shadow-soft-lg motion-safe:animate-[pop_150ms_ease-out]"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display font-bold">Ovoz va video</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          className="rounded-md p-1 text-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <label className="block text-xs font-medium text-muted">
        Mikrofon
        <select
          className="mt-1 w-full rounded-control border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          onChange={(e) => void voice.switchDevice("audioinput", e.target.value)}
          defaultValue=""
        >
          <option value="" disabled>
            {mics.length ? "Tanlang" : "Avval mikrofonni yoqing"}
          </option>
          {mics.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || "Mikrofon"}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block text-xs font-medium text-muted">
        Kamera
        <select
          className="mt-1 w-full rounded-control border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          onChange={(e) => void voice.switchDevice("videoinput", e.target.value)}
          defaultValue=""
        >
          <option value="" disabled>
            {cams.length ? "Tanlang" : "Avval kamerani yoqing"}
          </option>
          {cams.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || "Kamera"}
            </option>
          ))}
        </select>
      </label>

      <Toggle
        checked={snapshot.spatial}
        onChange={(v) => voice.setSpatial(v)}
        title="Fazoviy ovoz"
        text="Kursorlar yaqin bo'lsa baland, uzoq bo'lsa past eshitiladi."
      />
      <Toggle
        checked={snapshot.facesOnCursors}
        onChange={(v) => voice.setFacesOnCursors(v)}
        title="Yuzlar kursorda"
        text="Kamera kursor yonida kichik doirada harakatlanadi."
      />

      <p className="mt-3 rounded-control bg-surface-muted px-3 py-2 text-xs text-muted">
        <b>M</b> mikrofon · <b>V</b> kamera · <b>T</b> ni bosib turib gapiring
      </p>

      {isHost && (
        <button
          type="button"
          onClick={() => void muteAll()}
          className="mt-3 w-full rounded-control border border-border px-3 py-2 text-sm font-medium hover:bg-surface-muted"
        >
          👑 Hammaning mikrofonini o&apos;chirish
        </button>
      )}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  title,
  text,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  text: string;
}) {
  return (
    <label className="mt-4 flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-surface-muted transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4"
      />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted">{text}</span>
      </span>
    </label>
  );
}
