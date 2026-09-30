import type { FastifyBaseLogger } from "fastify";
import type { VoiceService } from "../rtc/voice";
import type { MafiaRoom } from "./mafia-room";

/** LiveKit room names: prefixed, so they never collide with puzzle rooms. */
export const mafiaVoiceRoom = (roomId: string) => `mafia-${roomId}`;
export const mafiaNightRoom = (roomId: string) => `mafia-${roomId}-night`;

/** Ten players plus spectators. */
export const MAFIA_VOICE_LIMIT = 40;

/** Re-checks LiveKit this often even without a phase change (late joiners, lost updates). */
const RECHECK_MS = 3_000;

/**
 * Applies each room's voice policy to LiveKit: who may publish in the table room, and who
 * is (still) in the night room. Runs from the manager's tick; one sync per room at a time.
 */
export class MafiaVoiceSync {
  private readonly applied = new Map<string, { key: string; at: number }>();
  private readonly running = new Set<string>();

  constructor(
    private readonly voice: VoiceService,
    private readonly logger: FastifyBaseLogger,
    private readonly now: () => number = Date.now,
  ) {}

  /** Token(s) for a connected member, matching the current policy. */
  async tokens(room: MafiaRoom, playerId: string) {
    const member = room.voiceMember(playerId);
    if (!member) return null;
    const policy = room.voicePolicy();
    const metadata = JSON.stringify({ color: member.color, avatar: member.avatar });
    const main = mafiaVoiceRoom(room.id);
    await this.voice.ensureRoom(main, MAFIA_VOICE_LIMIT);
    const token = await this.voice.tokenFor({
      room: main,
      identity: member.id,
      name: member.name,
      metadata,
      canPublish: policy.everyone || policy.speakers.includes(member.id),
    });
    let night: string | null = null;
    if (policy.night.includes(member.id)) {
      await this.voice.ensureRoom(mafiaNightRoom(room.id), 10);
      night = await this.voice.tokenFor({
        room: mafiaNightRoom(room.id),
        identity: member.id,
        name: member.name,
        metadata,
        canPublish: true,
      });
    }
    return { url: this.voice.url, token, night };
  }

  /** Brings LiveKit in line with the room's policy, if it changed (or is due a re-check). */
  sync(room: MafiaRoom) {
    const policy = { ...room.voicePolicy(), members: room.memberIds().sort() };
    const key = JSON.stringify(policy);
    const last = this.applied.get(room.id);
    const now = this.now();
    if ((last?.key === key && now - last.at < RECHECK_MS) || this.running.has(room.id)) return;
    this.applied.set(room.id, { key, at: now });
    this.running.add(room.id);
    void this.apply(room.id, policy)
      .catch((error) => {
        this.applied.delete(room.id);
        this.logger.warn({ err: error, roomId: room.id }, "mafia voice sync failed");
      })
      .finally(() => this.running.delete(room.id));
  }

  forget(roomId: string) {
    this.applied.delete(roomId);
  }

  private async apply(
    roomId: string,
    policy: ReturnType<MafiaRoom["voicePolicy"]> & { members: string[] },
  ) {
    const main = mafiaVoiceRoom(roomId);
    for (const participant of await this.voice.listParticipants(main)) {
      // Kicked or banned: out of the voice room too, not just the table.
      if (!policy.members.includes(participant.identity)) {
        await this.voice.removeParticipant(main, participant.identity);
        continue;
      }
      const allowed = policy.everyone || policy.speakers.includes(participant.identity);
      if (participant.permission?.canPublish !== allowed) {
        await this.voice.setCanPublish(main, participant.identity, allowed);
      }
    }
    // Only the living black team, and only during the zero night.
    const night = mafiaNightRoom(roomId);
    const inNight = await this.voice.listParticipants(night);
    if (policy.night.length === 0) {
      if (inNight.length > 0) await this.voice.deleteRoom(night);
      return;
    }
    for (const participant of inNight) {
      if (!policy.night.includes(participant.identity)) {
        await this.voice.removeParticipant(night, participant.identity);
      }
    }
  }
}
