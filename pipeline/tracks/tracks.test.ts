import { describe, expect, it } from 'vitest';
import { findArrow, routeMask, thin, traceLine } from './centerline';
import {
  cornerLine,
  fastestLine,
  lapTime,
  leastBending,
  leftNormals,
  pinLimits,
  placeLine,
  type Centre,
} from './racing-line';

/** A picture with a cyan ring of radius r (line `t` px thick) and, optionally, a white arrow. */
function ringPicture(r: number, t: number, arrow?: 'cw' | 'ccw') {
  const w = 2 * r + 40;
  const h = 2 * r + 40;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const d = Math.hypot(x - w / 2, y - h / 2);
      const [cr, cg, cb] = Math.abs(d - r) <= t / 2 ? [40, 220, 240] : [60, 90, 40];
      data.set([cr, cg, cb, 255], i);
    }
  if (arrow) {
    // A triangle on the ring's left side (x = w/2 - r), pointing down (cw on screen: y grows).
    const cx = w / 2 - r;
    const cy = h / 2;
    const dir = arrow === 'cw' ? -1 : 1; // on the left side, clockwise on screen goes up
    for (let k = 0; k <= 8; k++) {
      const half = 8 - k;
      for (let dx = -half; dx <= half; dx++) {
        const x = Math.round(cx + dx);
        const y = Math.round(cy + dir * (k - 4));
        data.set([255, 255, 255, 255], (y * w + x) * 4);
      }
    }
  }
  return { width: w, height: h, data };
}

describe('route picture', () => {
  it('traces the middle of a thick ring as one loop', () => {
    const pic = ringPicture(80, 9);
    const mask = routeMask(pic);
    const line = traceLine(thin(mask, pic.width, pic.height), pic.width, pic.height, true);
    let len = 0;
    for (let i = 1; i <= line.length; i++) {
      const a = line[i - 1]!;
      const b = line[i % line.length]!;
      len += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    expect(len).toBeGreaterThan(2 * Math.PI * 80 * 0.9);
    expect(len).toBeLessThan(2 * Math.PI * 80 * 1.15);
  });
  it('reads the direction from the arrow, whichever way the loop was traced', () => {
    for (const way of ['cw', 'ccw'] as const) {
      const pic = ringPicture(80, 9, way);
      const mask = routeMask(pic);
      const line = traceLine(thin(mask, pic.width, pic.height), pic.width, pic.height, true);
      const found = findArrow(pic, mask, line)!;
      expect(found).toBeDefined();
      // Travel direction on screen near the arrow: up (y falls) for 'cw', down for 'ccw'.
      const a = line[found.index]!;
      const b = line[(found.index + 5 * found.sign + line.length) % line.length]!;
      expect(Math.sign(b[1] - a[1])).toBe(way === 'cw' ? -1 : 1);
    }
  });
});

/** A stadium: two 300 m straights joined by half circles of radius 60 m, every 5 m, CCW. */
function stadium(): Centre[] {
  const pts: Centre[] = [];
  const r = 60;
  const L = 300;
  const step = 5;
  const total = 2 * L + 2 * Math.PI * r;
  for (let s = 0; s < total - 1e-6; s += step) {
    if (s < L) pts.push({ x: -L / 2 + s, z: -r });
    else if (s < L + Math.PI * r) {
      const a = -Math.PI / 2 + (s - L) / r;
      pts.push({ x: L / 2 + r * Math.cos(a), z: r * Math.sin(a) });
    } else if (s < 2 * L + Math.PI * r) pts.push({ x: L / 2 - (s - L - Math.PI * r), z: r });
    else {
      const a = Math.PI / 2 + (s - 2 * L - Math.PI * r) / r;
      pts.push({ x: -L / 2 + r * Math.cos(a), z: r * Math.sin(a) });
    }
  }
  return pts;
}

describe('racing lines', () => {
  const c = stadium();
  const half = 7;
  const normals = leftNormals(c, true);
  const time = (pos: number[]) => lapTime(placeLine(c, normals, pos, half), true).time;

  it('cuts to the inside of the bends (left, on a counter-clockwise track)', () => {
    const pos = leastBending(
      c,
      normals,
      half,
      true,
      c.map(() => 0),
    );
    const apex = Math.round((300 + (Math.PI * 60) / 2) / 5);
    expect(pos[apex]!).toBeGreaterThan(0.8);
    expect(pos.every((v) => v >= -1 && v <= 1)).toBe(true);
    expect(time(pos)).toBeLessThan(time(c.map(() => 0)));
  });
  it('the corner-by-corner line goes wide, apex, wide', () => {
    const pos = cornerLine(c, half, true, 5);
    const apex = Math.round((300 + (Math.PI * 60) / 2) / 5);
    expect(pos[apex]!).toBeGreaterThan(0.9);
    expect(pos[Math.round(250 / 5)]!).toBeLessThan(-0.5);
  });
  it('passes the pins, leaving the asphalt only around an off-road one', () => {
    const apex = Math.round((300 + (Math.PI * 60) / 2) / 5);
    const pins = new Map([[apex, 1.5]]);
    const limits = pinLimits(c.length, pins, true);
    expect(limits.hi[apex]).toBeCloseTo(1.5);
    expect(limits.hi[apex + 40]).toBe(1);
    expect(limits.lo[apex]).toBe(-1);
    const start = leastBending(
      c,
      normals,
      half,
      true,
      c.map((_, i) => pins.get(i) ?? 0),
      new Set(pins.keys()),
      undefined,
      limits,
    );
    const fast = fastestLine(c, half, true, 5, start, undefined, 20, 30, pins, limits);
    expect(fast[apex]!).toBeGreaterThan(1.4);
    expect(fast.every((v, i) => v <= limits.hi[i]! + 1e-9 && v >= limits.lo[i]! - 1e-9)).toBe(true);
  });
  it('the fastest line is never slower than where it starts', () => {
    const start = leastBending(
      c,
      normals,
      half,
      true,
      c.map(() => 0),
    );
    const fast = fastestLine(c, half, true, 5, start, undefined, 20, 40);
    expect(time(fast)).toBeLessThanOrEqual(time(start) + 1e-9);
    expect(fast.every((v) => v >= -1 && v <= 1)).toBe(true);
  });
});
