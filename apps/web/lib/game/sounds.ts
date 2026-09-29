/**
 * Tiny synthesized sound effects (no audio assets to download).
 * The AudioContext is created lazily on the first user gesture.
 */
let ctx: AudioContext | null = null;
let enabled = true;

function audio(): AudioContext | null {
  if (!enabled || typeof window === "undefined") return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setSoundEnabled(value: boolean) {
  enabled = value;
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  slideTo?: number,
) {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const now = ac.currentTime;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + duration);
}

export const sounds = {
  pick() {
    tone(520, 0.05, "sine", 0.05, 680);
  },
  drop() {
    tone(300, 0.06, "sine", 0.04, 220);
  },
  snap() {
    tone(1200, 0.035, "square", 0.035, 600);
    tone(660, 0.12, "triangle", 0.08, 880);
  },
  place() {
    tone(880, 0.15, "triangle", 0.08, 1320);
  },
  /** Invite link copied or shared: a short bright two-note chime. */
  invite() {
    tone(784, 0.09, "sine", 0.07);
    setTimeout(() => tone(1175, 0.16, "sine", 0.07), 70);
  },
  /** Someone entered the room: a soft doorbell "ding-dong". */
  join() {
    tone(988, 0.22, "triangle", 0.07);
    setTimeout(() => tone(740, 0.3, "triangle", 0.06), 160);
  },
  /** Someone left the room: the doorbell in reverse, lower and quieter. */
  leave() {
    tone(740, 0.2, "triangle", 0.05);
    setTimeout(() => tone(554, 0.32, "triangle", 0.045), 150);
  },
  /** A chat message from someone else: a soft, short "pop". */
  message() {
    tone(880, 0.07, "sine", 0.05, 1100);
  },
  complete() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => tone(f, 0.35, "triangle", 0.09), i * 110),
    );
  },
};

export function haptic(ms = 12) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(ms);
}
