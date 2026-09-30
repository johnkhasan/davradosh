"use client";

import { Mic, MicOff, Volume2 } from "lucide-react";
import type { MafiaVoiceHandle } from "@/lib/mafia/use-mafia-voice";
import { cn } from "@/lib/utils";

/** Microphone toggle plus the "tap to hear" button some browsers need. Hidden without voice. */
export function VoiceControls({
  handle,
  dark = false,
}: {
  handle: MafiaVoiceHandle;
  dark?: boolean;
}) {
  const { voice, snapshot } = handle;
  if (snapshot.status === "unavailable") return null;

  const label = !snapshot.micWanted
    ? "Mikrofonni yoqish"
    : snapshot.micLive || snapshot.inNight
      ? "Mikrofon yoniq"
      : "Navbatingizni kuting";

  return (
    <div className="flex items-center gap-1.5">
      {snapshot.needsAudioStart && (
        <button
          type="button"
          onClick={() => void voice.startAudio()}
          className="flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1.5 text-sm font-medium text-white"
        >
          <Volume2 className="size-4" aria-hidden /> Ovozni yoqish
        </button>
      )}
      <button
        type="button"
        onClick={() => void voice.setMic(!snapshot.micWanted)}
        disabled={snapshot.status !== "connected"}
        aria-pressed={snapshot.micWanted}
        aria-label={label}
        title={label}
        className={cn(
          "flex size-9 items-center justify-center rounded-full transition-colors disabled:opacity-40",
          snapshot.micLive || (snapshot.micWanted && snapshot.inNight)
            ? "bg-snap text-white"
            : snapshot.micWanted
              ? dark
                ? "bg-white/15 text-white"
                : "bg-primary-soft text-primary"
              : dark
                ? "bg-white/10 text-white/70"
                : "bg-surface-muted text-muted",
        )}
      >
        {snapshot.micWanted ? (
          <Mic className="size-4" aria-hidden />
        ) : (
          <MicOff className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
