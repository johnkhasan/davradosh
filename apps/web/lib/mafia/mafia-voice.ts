import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteTrack,
} from "livekit-client";
import { API_URL } from "../env";

export type MafiaVoiceStatus = "off" | "connecting" | "connected" | "unavailable" | "error";

export interface MafiaVoiceSnapshot {
  status: MafiaVoiceStatus;
  /** The person wants their microphone on whenever the rules allow it. */
  micWanted: boolean;
  /** The server currently lets us publish (our turn, or the lobby). */
  canPublish: boolean;
  /** Our microphone is actually live. */
  micLive: boolean;
  /** Browser blocked audio playback until a tap (iOS Safari). */
  needsAudioStart: boolean;
  /** Connected to the black team's zero-night room. */
  inNight: boolean;
  /** Public player ids currently talking, in either room. */
  speaking: Record<string, true>;
}

interface Tokens {
  url: string;
  token: string;
  night: string | null;
}

/**
 * Voice for a mafia table, on LiveKit. The server decides who may talk (it grants and revokes
 * publishing per phase); this class only follows: it keeps the microphone on while allowed and
 * the person wants it, joins the night room when given a token, and plays everyone else.
 */
export class MafiaVoice {
  private readonly table = this.createRoom();
  private readonly nightRoom = this.createRoom();
  private readonly listeners = new Set<() => void>();
  private readonly audio: HTMLDivElement;
  private readonly speakers = { table: new Set<string>(), night: new Set<string>() };
  private snapshot: MafiaVoiceSnapshot = {
    status: "off",
    micWanted: false,
    canPublish: false,
    micLive: false,
    needsAudioStart: false,
    inNight: false,
    speaking: {},
  };
  private destroyed = false;
  private retry: number | null = null;

  constructor(
    private readonly roomId: string,
    private readonly clientId: string,
  ) {
    this.audio = document.createElement("div");
    this.audio.hidden = true;
    this.bind(this.table, "table");
    this.bind(this.nightRoom, "night");
  }

  // ---------------------------------------------------------------- store

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  private update(patch: Partial<MafiaVoiceSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }

  // ---------------------------------------------------------------- lifecycle

  async connect() {
    this.destroyed = false;
    if (!this.audio.isConnected) document.body.appendChild(this.audio);
    if (this.table.state !== ConnectionState.Disconnected || this.snapshot.status === "connecting")
      return;
    this.update({ status: "connecting" });
    try {
      const tokens = await this.fetchTokens();
      if (!tokens || this.destroyed) return;
      await this.table.connect(tokens.url, tokens.token, { autoSubscribe: true });
      this.update({ status: "connected", needsAudioStart: !this.table.canPlaybackAudio });
      this.readPermission();
      if (tokens.night) await this.joinNight(tokens);
    } catch {
      this.update({ status: "error" });
      this.scheduleRetry();
    }
  }

  destroy() {
    this.destroyed = true;
    if (this.retry) window.clearTimeout(this.retry);
    void this.table.disconnect();
    void this.nightRoom.disconnect();
    this.audio.remove();
  }

  /**
   * Called whenever the game phase changes. At the zero night the black team is handed a night
   * token by the server; everyone else (and the black team afterwards) is kept out.
   */
  async onPhase(nightMember: boolean) {
    if (this.snapshot.status !== "connected") return;
    if (nightMember && this.nightRoom.state === ConnectionState.Disconnected) {
      const tokens = await this.fetchTokens().catch(() => null);
      if (tokens?.night) await this.joinNight(tokens);
    } else if (!nightMember && this.nightRoom.state !== ConnectionState.Disconnected) {
      await this.nightRoom.disconnect();
    }
  }

  // ---------------------------------------------------------------- controls

  async setMic(on: boolean) {
    if (on) {
      // Ask for the microphone now, during the tap, so later turns can switch it on silently.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        for (const track of stream.getTracks()) track.stop();
      } catch {
        this.update({ micWanted: false });
        return;
      }
    }
    this.update({ micWanted: on });
    await this.applyMic();
  }

  /** Must run from a tap on browsers that block autoplay. */
  async startAudio() {
    await this.table.startAudio().catch(() => undefined);
    await this.nightRoom.startAudio().catch(() => undefined);
    this.update({ needsAudioStart: !this.table.canPlaybackAudio });
  }

  // ---------------------------------------------------------------- internals

  private createRoom() {
    return new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      publishDefaults: { dtx: true, red: true },
    });
  }

  private async fetchTokens(): Promise<Tokens | null> {
    const res = await fetch(
      `${API_URL}/api/mafia/rooms/${encodeURIComponent(this.roomId)}/rtc-token`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId: this.clientId }),
      },
    );
    if (res.status === 503) {
      this.update({ status: "unavailable" });
      return null;
    }
    if (!res.ok) throw new Error(`token ${res.status}`);
    return (await res.json()) as Tokens;
  }

  private async joinNight(tokens: Tokens) {
    if (!tokens.night) return;
    await this.nightRoom.connect(tokens.url, tokens.night, { autoSubscribe: true });
    this.update({ inNight: true });
    // At the zero night the black team always talks (with the mic on if they want it).
    if (this.snapshot.micWanted) {
      await this.nightRoom.localParticipant.setMicrophoneEnabled(true).catch(() => undefined);
    }
  }

  /** Our publishing right on the table room, as the server set it. */
  private readPermission() {
    const canPublish = this.table.localParticipant.permissions?.canPublish ?? false;
    this.update({ canPublish });
    void this.applyMic();
  }

  private async applyMic() {
    const on = this.snapshot.micWanted && this.snapshot.canPublish;
    if (this.table.state === ConnectionState.Connected) {
      await this.table.localParticipant.setMicrophoneEnabled(on).catch(() => undefined);
    }
    if (this.nightRoom.state === ConnectionState.Connected) {
      await this.nightRoom.localParticipant
        .setMicrophoneEnabled(this.snapshot.micWanted)
        .catch(() => undefined);
    }
    this.update({ micLive: on && this.table.localParticipant.isMicrophoneEnabled });
  }

  private bind(room: Room, which: "table" | "night") {
    room
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio) this.audio.appendChild(track.attach());
      })
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        for (const element of track.detach()) element.remove();
      })
      .on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        this.speakers[which] = new Set(speakers.map((p) => p.identity));
        const speaking: Record<string, true> = {};
        for (const id of [...this.speakers.table, ...this.speakers.night]) speaking[id] = true;
        this.update({ speaking });
      })
      .on(RoomEvent.AudioPlaybackStatusChanged, () => {
        if (which === "table") this.update({ needsAudioStart: !room.canPlaybackAudio });
      })
      .on(RoomEvent.Disconnected, () => {
        if (which === "night") {
          this.speakers.night.clear();
          this.update({ inNight: false });
          return;
        }
        this.update({ status: "off", canPublish: false, micLive: false });
        this.scheduleRetry();
      });
    if (which === "table") {
      room.on(RoomEvent.ParticipantPermissionsChanged, (_previous, participant) => {
        if (participant === room.localParticipant) this.readPermission();
      });
    }
  }

  private scheduleRetry() {
    if (this.destroyed || this.retry) return;
    this.retry = window.setTimeout(() => {
      this.retry = null;
      if (!this.destroyed) void this.connect();
    }, 3_000);
  }
}
