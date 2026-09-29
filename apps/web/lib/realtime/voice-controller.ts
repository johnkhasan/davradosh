import {
  ConnectionState,
  RemoteParticipant,
  RemoteTrack,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  type Participant,
} from "livekit-client";
import { API_URL } from "../env";

export type VoiceStatus = "off" | "connecting" | "connected" | "unavailable" | "error";

export interface VoiceSnapshot {
  status: VoiceStatus;
  micOn: boolean;
  camOn: boolean;
  /** Browser blocked autoplay (iOS Safari): the user must tap once to hear others. */
  needsAudioStart: boolean;
  /** Players currently talking (LiveKit active speakers), by public player id. */
  speaking: Record<string, true>;
  /** Players who have their microphone published and unmuted. */
  micLive: Record<string, true>;
  /** Players with a camera track (including us). Bumped when tracks change. */
  cameras: string[];
  spatial: boolean;
  facesOnCursors: boolean;
  pushToTalk: boolean;
}

interface VoiceOptions {
  roomId: string;
  clientId: string;
  /** Our public player id (known once the puzzle room is joined). */
  me: () => string;
  notify: (text: string) => void;
}

const PREFS_KEY = "puzzle:voice-prefs";

function loadPrefs(): Pick<VoiceSnapshot, "spatial" | "facesOnCursors"> {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (raw) return { spatial: false, facesOnCursors: false, ...(JSON.parse(raw) as object) };
  } catch {
    // storage unavailable
  }
  return { spatial: false, facesOnCursors: false };
}

/**
 * Optional voice/video layer on top of the puzzle, backed by LiveKit.
 * Everyone joins muted with the camera off; the puzzle keeps working if voice
 * is unavailable or fails.
 */
export class VoiceController {
  private readonly room: Room;
  private readonly listeners = new Set<() => void>();
  private readonly audioContainer: HTMLDivElement;
  private snapshot: VoiceSnapshot;
  private destroyed = false;
  private pttActive = false;
  private reconnectTimer: number | null = null;

  constructor(private readonly opts: VoiceOptions) {
    this.snapshot = {
      status: "off",
      micOn: false,
      camOn: false,
      needsAudioStart: false,
      speaking: {},
      micLive: {},
      cameras: [],
      pushToTalk: false,
      ...loadPrefs(),
    };
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      videoCaptureDefaults: { resolution: VideoPresets.h360.resolution, facingMode: "user" },
      publishDefaults: {
        simulcast: true,
        videoSimulcastLayers: [VideoPresets.h180],
        dtx: true,
        red: true,
      },
    });
    this.audioContainer = document.createElement("div");
    this.audioContainer.hidden = true;
    document.body.appendChild(this.audioContainer);
    this.bindRoomEvents();
  }

  // ---------------------------------------------------------------- store

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  private update(patch: Partial<VoiceSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }

  // ---------------------------------------------------------------- lifecycle

  async connect() {
    // Reversible destroy: React Strict Mode unmounts and remounts in development.
    this.destroyed = false;
    if (!this.audioContainer.isConnected) document.body.appendChild(this.audioContainer);
    if (this.room.state !== ConnectionState.Disconnected || this.snapshot.status === "connecting")
      return;
    this.update({ status: "connecting" });
    try {
      const res = await fetch(
        `${API_URL}/api/rooms/${encodeURIComponent(this.opts.roomId)}/rtc-token`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ clientId: this.opts.clientId }),
        },
      );
      if (res.status === 503) return this.update({ status: "unavailable" });
      if (!res.ok) throw new Error(`token ${res.status}`);
      const { url, token } = (await res.json()) as { url: string; token: string };
      if (this.destroyed) return;
      await this.room.connect(url, token, { autoSubscribe: true });
      this.update({ status: "connected", needsAudioStart: !this.room.canPlaybackAudio });
      this.refreshParticipants();
    } catch {
      if (this.destroyed) return;
      this.update({ status: "error" });
      this.scheduleReconnect();
    }
  }

  destroy() {
    this.destroyed = true;
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    void this.room.disconnect();
    this.audioContainer.remove();
    this.update({ status: "off", micOn: false, camOn: false });
  }

  private scheduleReconnect() {
    if (this.destroyed || this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, 5000);
  }

  // ---------------------------------------------------------------- controls

  async toggleMic() {
    await this.setMic(!this.snapshot.micOn);
  }

  async toggleCam() {
    if (this.snapshot.status !== "connected") return;
    const next = !this.snapshot.camOn;
    try {
      await this.room.localParticipant.setCameraEnabled(next);
      this.refreshParticipants();
    } catch (error) {
      this.permissionError(error, "Kamera");
    }
  }

  /** Hold-to-talk: temporarily opens the microphone while a key is held. */
  async pushToTalk(active: boolean) {
    if (this.snapshot.status !== "connected" || active === this.pttActive) return;
    if (active && this.snapshot.micOn) return;
    this.pttActive = active;
    this.update({ pushToTalk: active });
    await this.setMic(active, true);
  }

  async startAudio() {
    await this.room.startAudio();
    this.update({ needsAudioStart: !this.room.canPlaybackAudio });
  }

  setSpatial(spatial: boolean) {
    this.update({ spatial });
    this.savePrefs();
    if (!spatial)
      for (const participant of this.room.remoteParticipants.values()) participant.setVolume(1);
  }

  setFacesOnCursors(facesOnCursors: boolean) {
    this.update({ facesOnCursors });
    this.savePrefs();
  }

  async devices(kind: "audioinput" | "videoinput") {
    try {
      return await Room.getLocalDevices(kind, false);
    } catch {
      return [];
    }
  }

  async switchDevice(kind: "audioinput" | "videoinput", deviceId: string) {
    await this.room.switchActiveDevice(kind, deviceId).catch(() => undefined);
  }

  /** 0..1 microphone level of a player (smoothed by LiveKit). */
  audioLevel(playerId: string): number {
    const participant = this.participant(playerId);
    return participant && this.snapshot.micLive[playerId] ? participant.audioLevel : 0;
  }

  /** Attaches a player's camera to a <video> element; returns a detach function. */
  attachCamera(playerId: string, element: HTMLVideoElement): () => void {
    const track = this.participant(playerId)?.getTrackPublication(Track.Source.Camera)?.track;
    if (!track) return () => undefined;
    track.attach(element);
    return () => track.detach(element);
  }

  /**
   * Distance-based volume: nearby cursors are louder, far ones fade to 25 %,
   * never silent. `positions` are world coordinates of player cursors.
   */
  updateSpatial(
    me: { x: number; y: number } | null,
    positions: Map<string, { x: number; y: number }>,
    scale: number,
  ) {
    if (!this.snapshot.spatial || !me) return;
    const near = scale * 0.15;
    const far = scale * 0.8;
    for (const participant of this.room.remoteParticipants.values()) {
      const pos = positions.get(participant.identity);
      if (!pos) continue;
      const distance = Math.hypot(pos.x - me.x, pos.y - me.y);
      const t = Math.min(1, Math.max(0, (distance - near) / (far - near)));
      participant.setVolume(1 - t * 0.75);
    }
  }

  // ---------------------------------------------------------------- internals

  private async setMic(on: boolean, transient = false) {
    if (this.snapshot.status !== "connected") return;
    try {
      await this.room.localParticipant.setMicrophoneEnabled(on);
      if (transient) this.pttActive = on;
      this.refreshParticipants();
    } catch (error) {
      this.permissionError(error, "Mikrofon");
    }
  }

  private permissionError(error: unknown, device: string) {
    const denied =
      error instanceof Error &&
      /denied|NotAllowed|Permission/i.test(`${error.name} ${error.message}`);
    this.opts.notify(
      denied
        ? `${device}ga ruxsat berilmagan. Manzil satridagi 🔒 belgisini bosib, ruxsat bering.`
        : `${device}ni yoqib bo'lmadi. Qurilma ulanganini tekshiring.`,
    );
  }

  private participant(playerId: string): Participant | undefined {
    if (playerId === this.opts.me()) return this.room.localParticipant;
    return this.room.remoteParticipants.get(playerId);
  }

  private refreshParticipants() {
    const micLive: Record<string, true> = {};
    const cameras: string[] = [];
    const all: Participant[] = [
      this.room.localParticipant,
      ...this.room.remoteParticipants.values(),
    ];
    for (const participant of all) {
      const mic = participant.getTrackPublication(Track.Source.Microphone);
      if (mic && !mic.isMuted && mic.track) micLive[participant.identity] = true;
      const cam = participant.getTrackPublication(Track.Source.Camera);
      if (cam && !cam.isMuted && cam.track) cameras.push(participant.identity);
    }
    // Read the real track state (a permission prompt or a double click can make
    // our own bookkeeping drift). Push-to-talk shows as its own state.
    const local = this.room.localParticipant;
    this.update({
      micLive,
      cameras,
      micOn: local.isMicrophoneEnabled && !this.pttActive,
      camOn: local.isCameraEnabled,
    });
  }

  private bindRoomEvents() {
    const refresh = () => this.refreshParticipants();
    this.room
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio) this.audioContainer.appendChild(track.attach());
        refresh();
      })
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        for (const element of track.detach()) element.remove();
        refresh();
      })
      .on(RoomEvent.TrackMuted, refresh)
      .on(RoomEvent.TrackUnmuted, refresh)
      .on(RoomEvent.LocalTrackPublished, refresh)
      .on(RoomEvent.LocalTrackUnpublished, refresh)
      .on(RoomEvent.ParticipantConnected, refresh)
      .on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        refresh();
        const speaking = { ...this.snapshot.speaking };
        delete speaking[participant.identity];
        this.update({ speaking });
      })
      .on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        const speaking: Record<string, true> = {};
        for (const speaker of speakers) speaking[speaker.identity] = true;
        this.update({ speaking });
      })
      .on(RoomEvent.AudioPlaybackStatusChanged, () => {
        this.update({ needsAudioStart: !this.room.canPlaybackAudio });
      })
      .on(RoomEvent.Reconnecting, () => this.update({ status: "connecting" }))
      .on(RoomEvent.Reconnected, () => this.update({ status: "connected" }))
      .on(RoomEvent.Disconnected, () => {
        if (this.destroyed || this.snapshot.status === "unavailable") return;
        this.update({
          status: "error",
          micOn: false,
          camOn: false,
          speaking: {},
          micLive: {},
          cameras: [],
        });
        this.scheduleReconnect();
      });
  }

  private savePrefs() {
    try {
      window.localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({
          spatial: this.snapshot.spatial,
          facesOnCursors: this.snapshot.facesOnCursors,
        }),
      );
    } catch {
      // storage unavailable
    }
  }
}
