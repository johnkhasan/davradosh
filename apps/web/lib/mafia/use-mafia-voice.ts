"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Identity } from "@/lib/identity";
import { MafiaVoice } from "./mafia-voice";

/**
 * Joins the table's voice (listening right away, talking when the rules allow and the person
 * switched the microphone on). `nightMember` is true for the black team during the zero night.
 */
export function useMafiaVoice(
  roomId: string,
  identity: Identity,
  nightMember: boolean,
  phaseKey: string,
) {
  const [voice] = useState(() => new MafiaVoice(roomId, identity.clientId));
  useEffect(() => {
    void voice.connect();
    return () => voice.destroy();
  }, [voice]);
  const snapshot = useSyncExternalStore(voice.subscribe, voice.getSnapshot, voice.getSnapshot);
  useEffect(() => {
    void voice.onPhase(nightMember);
  }, [voice, nightMember, phaseKey, snapshot.status]);
  return { voice, snapshot };
}

export type MafiaVoiceHandle = ReturnType<typeof useMafiaVoice>;
