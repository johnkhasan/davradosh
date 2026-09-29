import { describe, expect, it } from "vitest";
import { MotionBuffer } from "./motion";

describe("MotionBuffer", () => {
  it("returns null before anything arrives", () => {
    expect(new MotionBuffer(100).sample(0)).toBeNull();
  });

  it("interpolates linearly between samples, running one delay behind", () => {
    const m = new MotionBuffer(100);
    m.push(0, 0, 1000);
    m.push(100, 0, 1040);
    m.push(200, 0, 1080);
    expect(m.sample(1140)?.x).toBeCloseTo(100); // t = 1040
    expect(m.sample(1160)?.x).toBeCloseTo(150); // halfway 1040..1080
    expect(m.sample(1200)?.x).toBeCloseTo(200); // holds the newest sample
    expect(m.settled(1180)).toBe(true);
  });

  it("stays smooth when packets arrive in bursts", () => {
    const m = new MotionBuffer(100);
    // Sent every 40 ms, but received in pairs 80 ms apart.
    m.push(0, 0, 0);
    m.push(10, 0, 80);
    m.push(20, 0, 80);
    m.push(30, 0, 160);
    m.push(40, 0, 160);
    const xs = [100, 120, 140, 160, 180, 200, 220, 240].map((t) => m.sample(t)!.x);
    // Monotonic, never jumps backwards, and no single step bigger than a packet.
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]!).toBeGreaterThanOrEqual(xs[i - 1]!);
      expect(xs[i]! - xs[i - 1]!).toBeLessThanOrEqual(10);
    }
  });

  it("glides from the drawn position when a new movement starts", () => {
    const m = new MotionBuffer(100);
    m.push(500, 500, 2000, { x: 0, y: 0 });
    // Starts exactly where the object was drawn, then moves towards the target.
    expect(m.sample(2000)).toEqual({ x: 0, y: 0 });
    expect(m.sample(2100)).toEqual({ x: 500, y: 500 });
    expect(m.sample(2050)!.x).toBeCloseTo(250);
  });

  it("does not interpolate across a long pause", () => {
    const m = new MotionBuffer(100);
    m.push(0, 0, 0);
    m.push(10, 0, 40);
    m.push(1000, 0, 5000, m.sample(5000)!);
    expect(m.sample(5000)!.x).toBeCloseTo(10);
    expect(m.sample(5100)!.x).toBeCloseTo(1000);
  });
});
