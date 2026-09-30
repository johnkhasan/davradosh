import type { PlayerDTO } from "@puzzle/shared";
import { AccessToken, RoomServiceClient, TrackType } from "livekit-server-sdk";

export interface VoiceConfig {
  /** Public WebSocket URL browsers connect to, e.g. wss://rtc.puzzle.javohir.ru */
  url: string;
  apiKey: string;
  apiSecret: string;
  /** HTTP(S) URL the game server uses for the LiveKit API (may be internal). */
  serviceUrl?: string;
}

export const VOICE_TOKEN_TTL = "2h";

/**
 * Voice and video via a self-hosted LiveKit SFU. The game server is the only
 * place that knows the API secret: it hands out short-lived tokens to players
 * who are currently connected to the puzzle room.
 */
export class VoiceService {
  private readonly rooms: RoomServiceClient;

  constructor(private readonly config: VoiceConfig) {
    const serviceUrl = config.serviceUrl ?? config.url.replace(/^ws/, "http");
    this.rooms = new RoomServiceClient(serviceUrl, config.apiKey, config.apiSecret);
  }

  get url() {
    return this.config.url;
  }

  /** Token for one player; the LiveKit room name is the puzzle room id. */
  async token(roomId: string, player: PlayerDTO): Promise<string> {
    const token = new AccessToken(this.config.apiKey, this.config.apiSecret, {
      identity: player.id,
      name: player.name,
      metadata: JSON.stringify({ color: player.color, avatar: player.avatar }),
      ttl: VOICE_TOKEN_TTL,
    });
    token.addGrant({
      room: roomId,
      roomJoin: true,
      // Viewers can listen and watch; only seated players talk.
      canPublish: player.role === "player",
      canSubscribe: true,
      canPublishData: false,
      canUpdateOwnMetadata: false,
    });
    return token.toJwt();
  }

  /** Host action: mutes every published microphone (players can unmute themselves). */
  async muteAll(roomId: string, exceptIdentity?: string): Promise<number> {
    const participants = await this.rooms.listParticipants(roomId).catch(() => []);
    let muted = 0;
    for (const participant of participants) {
      if (participant.identity === exceptIdentity) continue;
      for (const track of participant.tracks) {
        if (track.type === TrackType.AUDIO && !track.muted) {
          await this.rooms.mutePublishedTrack(roomId, participant.identity, track.sid, true);
          muted++;
        }
      }
    }
    return muted;
  }

  async removeParticipant(roomId: string, identity: string) {
    await this.rooms.removeParticipant(roomId, identity).catch(() => undefined);
  }

  // ---------------------------------------------------------------- generic (used by mafia)

  /** Token for any LiveKit room, with publishing decided by the caller. */
  async tokenFor(options: {
    room: string;
    identity: string;
    name: string;
    metadata?: string;
    canPublish: boolean;
  }): Promise<string> {
    const token = new AccessToken(this.config.apiKey, this.config.apiSecret, {
      identity: options.identity,
      name: options.name,
      metadata: options.metadata,
      ttl: VOICE_TOKEN_TTL,
    });
    token.addGrant({
      room: options.room,
      roomJoin: true,
      canPublish: options.canPublish,
      canSubscribe: true,
      canPublishData: false,
      canUpdateOwnMetadata: false,
    });
    return token.toJwt();
  }

  /**
   * Creates the room up front with its own participant limit (LiveKit's server-wide default
   * is sized for puzzle rooms). Creating an existing room is a no-op on LiveKit's side.
   */
  async ensureRoom(name: string, maxParticipants: number) {
    await this.rooms.createRoom({ name, maxParticipants, emptyTimeout: 300, departureTimeout: 20 });
  }

  async listParticipants(room: string) {
    return this.rooms.listParticipants(room).catch(() => []);
  }

  /**
   * Grants or revokes publishing. Revoking unpublishes the participant's tracks on the SFU,
   * so it cannot be undone from the browser.
   */
  async setCanPublish(room: string, identity: string, canPublish: boolean) {
    await this.rooms
      .updateParticipant(room, identity, {
        permission: {
          canPublish,
          canSubscribe: true,
          canPublishData: false,
          canUpdateMetadata: false,
        },
      })
      .catch(() => undefined);
  }

  async deleteRoom(room: string) {
    await this.rooms.deleteRoom(room).catch(() => undefined);
  }
}
