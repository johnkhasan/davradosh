/**
 * Smooth playback of positions that arrive over the network in bursts.
 *
 * Remote cursors and dragged pieces are sent ~25 times a second, but phones on
 * mobile data deliver them unevenly (two at once, then a gap). Snapping or
 * re-easing on every packet makes the motion jump. Instead every sample is
 * stored with its arrival time and the display runs a fixed delay behind,
 * interpolating linearly between the two samples around that moment
 * ("snapshot interpolation", as used by games and Figma-style cursors).
 */

import { CURSOR_SEND_INTERVAL_MS } from "./constants";

export interface MotionSample {
  t: number;
  x: number;
  y: number;
}

/** How far behind real time remote motion is shown (ms). ~2.5 packets at 25 Hz absorbs jitter. */
export const MOTION_RENDER_DELAY_MS = 100;
/** A gap longer than this starts a new movement instead of interpolating across it. */
const RESTART_GAP_MS = 250;
const MAX_SAMPLES = 32;

export class MotionBuffer {
  private samples: MotionSample[] = [];

  constructor(private readonly delay = MOTION_RENDER_DELAY_MS) {}

  get isEmpty() {
    return this.samples.length === 0;
  }

  /**
   * Adds a position received at time `now`. After a pause (or for the first
   * sample) `from` is where the object is currently drawn, so it glides from
   * there instead of jumping.
   */
  push(x: number, y: number, now: number, from?: { x: number; y: number }) {
    const last = this.samples.at(-1);
    if (!last || now - last.t > RESTART_GAP_MS) {
      const start = from ?? last ?? { x, y };
      // Pretend the start was seen one render delay ago, so playback begins right away.
      this.samples = [{ t: now - this.delay, x: start.x, y: start.y }];
    }
    // Packets that arrive together were sent one interval apart: spread them out
    // again (but never further ahead than the render delay can absorb).
    const previous = this.samples.at(-1)!.t;
    const t = Math.min(Math.max(now, previous + CURSOR_SEND_INTERVAL_MS), now + this.delay);
    this.samples.push({ t: Math.max(t, previous), x, y });
    if (this.samples.length > MAX_SAMPLES)
      this.samples.splice(0, this.samples.length - MAX_SAMPLES);
  }

  /** Interpolated position for display at time `now`, or null if nothing was received. */
  sample(now: number): { x: number; y: number } | null {
    const samples = this.samples;
    if (samples.length === 0) return null;
    const t = now - this.delay;
    const first = samples[0]!;
    if (t <= first.t) return { x: first.x, y: first.y };
    for (let i = samples.length - 1; i > 0; i--) {
      const a = samples[i - 1]!;
      const b = samples[i]!;
      if (t >= a.t) {
        if (t >= b.t || b.t === a.t) return { x: b.x, y: b.y };
        const k = (t - a.t) / (b.t - a.t);
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      }
    }
    const last = samples.at(-1)!;
    return { x: last.x, y: last.y };
  }

  /** True once playback has reached the newest sample (nothing left to animate). */
  settled(now: number): boolean {
    const last = this.samples.at(-1);
    return !last || now - this.delay >= last.t;
  }

  clear() {
    this.samples = [];
  }
}
