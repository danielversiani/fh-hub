/**
 * Racing lines for a road known only by its middle line and width (ADR-0023). Positions across
 * the road use the guides' scale: −1 = car centre CAR_EDGE m inside the right edge, +1 = the same
 * inside the left edge (the car's own width keeps it off the grass).
 *
 * - `cornerLine`: the textbook line of each corner on its own (outside, apex, outside), as if the
 *   corners before and after did not exist. Between corners the car drifts from one to the next.
 * - `fastestLine`: the line with the lowest lap time for a typical car, so it trades a slower
 *   corner for a faster exit onto a long straight, or gives up the first part of a chicane.
 */

export interface Centre {
  x: number;
  z: number;
}

export interface Car {
  /** Lateral grip (g). */
  grip: number;
  /** Braking (g). */
  brake: number;
  /** Power per mass (W/kg); acceleration = power / (mass × speed), capped by grip. */
  powerPerKg: number;
  /** Top speed (m/s). */
  top: number;
}

/** A quick road car of the middle classes (S1/A) on asphalt: enough to tell lines apart. */
export const TYPICAL_CAR: Car = { grip: 1.25, brake: 1.15, powerPerKg: 260, top: 78 };

const G = 9.81;
const CAR_EDGE = 1.3;

/** Lowest and highest position allowed at each point (normally the asphalt, −1 to +1). */
export interface Limits {
  lo: number[];
  hi: number[];
}

/**
 * Limits for a line that must pass through `pins` (index → position). Where a pin is off the
 * asphalt (beyond ±1, a cut over the grass), the limit on that side widens to it over `reach`
 * points each way (70 m at 5 m steps), so the line can leave the road there and only there.
 */
export function pinLimits(
  n: number,
  pins: ReadonlyMap<number, number>,
  closed: boolean,
  reach = 14,
): Limits {
  const lo = new Array<number>(n).fill(-1);
  const hi = new Array<number>(n).fill(1);
  for (const [i, p] of pins) {
    if (Math.abs(p) <= 1) continue;
    for (let d = -reach; d <= reach; d++) {
      const j = closed ? (i + d + n) % n : i + d;
      if (j < 0 || j >= n) continue;
      // Flat near the pin, easing back to the edge (a sharp peak would force a kink).
      const v = 1 + ((Math.abs(p) - 1) * (1 + Math.cos((Math.PI * Math.abs(d)) / (reach + 1)))) / 2;
      if (p > 0) hi[j] = Math.max(hi[j]!, v);
      else lo[j] = Math.min(lo[j]!, -v);
    }
  }
  return { lo, hi };
}

/** Unit normals pointing left of travel, from a closed (or open) centre line. */
export function leftNormals(c: readonly Centre[], closed: boolean): Centre[] {
  const n = c.length;
  return c.map((_, i) => {
    const a = c[closed ? (i - 1 + n) % n : Math.max(0, i - 1)]!;
    const b = c[closed ? (i + 1) % n : Math.min(n - 1, i + 1)]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    return { x: -dz / len, z: dx / len };
  });
}

/** Points of a line given positions across the road. */
export function placeLine(
  c: readonly Centre[],
  normals: readonly Centre[],
  pos: readonly number[],
  half: number,
): Centre[] {
  const reach = half - CAR_EDGE;
  return c.map((p, i) => ({
    x: p.x + normals[i]!.x * pos[i]! * reach,
    z: p.z + normals[i]!.z * pos[i]! * reach,
  }));
}

/** Signed curvature (1/m, + = left) from three neighbouring points. */
export function curvatures(p: readonly Centre[], closed: boolean): number[] {
  const n = p.length;
  return p.map((b, i) => {
    if (!closed && (i === 0 || i === n - 1)) return 0;
    const a = p[(i - 1 + n) % n]!;
    const c = p[(i + 1) % n]!;
    const ab = Math.hypot(b.x - a.x, b.z - a.z);
    const bc = Math.hypot(c.x - b.x, c.z - b.z);
    const ac = Math.hypot(c.x - a.x, c.z - a.z);
    const cross = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
    return ab && bc && ac ? (2 * cross) / (ab * bc * ac) : 0;
  });
}

/**
 * The line with the least total bending inside [lo, hi] positions, by coordinate descent on the
 * second differences (a convex problem, so it settles on the one answer). `fixed` pins points.
 */
export function leastBending(
  c: readonly Centre[],
  normals: readonly Centre[],
  half: number,
  closed: boolean,
  start: readonly number[],
  fixed: ReadonlySet<number> = new Set(),
  sweeps = 3000,
  limits?: Limits,
): number[] {
  const n = c.length;
  const reach = half - CAR_EDGE;
  const pos = [...start];
  const lo = limits?.lo ?? new Array<number>(n).fill(-1);
  const hi = limits?.hi ?? new Array<number>(n).fill(1);
  const at = (i: number) => (closed ? (i + n) % n : i);
  const point = (i: number) => {
    const j = at(i);
    return {
      x: c[j]!.x + normals[j]!.x * pos[j]! * reach,
      z: c[j]!.z + normals[j]!.z * pos[j]! * reach,
    };
  };
  for (let sweep = 0; sweep < sweeps; sweep++) {
    for (let i = 0; i < n; i++) {
      if (fixed.has(i)) continue;
      // pos[i] appears in the second differences centred at i-1, i, i+1, with weights 1, -2, 1.
      let num = 0;
      let den = 0;
      for (const [k, w] of [
        [i - 1, 1],
        [i, -2],
        [i + 1, 1],
      ] as const) {
        if (!closed && (k <= 0 || k >= n - 1)) continue;
        const terms = [k - 1, k, k + 1];
        const weights = [1, -2, 1];
        // Residual of the second difference without pos[i]'s own contribution.
        let rx = 0;
        let rz = 0;
        terms.forEach((t, m) => {
          const p = t === i ? { x: c[at(t)]!.x, z: c[at(t)]!.z } : point(t);
          rx += weights[m]! * p.x;
          rz += weights[m]! * p.z;
        });
        const nx = normals[at(i)]!.x * reach * w;
        const nz = normals[at(i)]!.z * reach * w;
        num -= rx * nx + rz * nz;
        den += nx * nx + nz * nz;
      }
      // Over-relaxed (SOR): plain sweeps creep along slowly on long, gentle bends.
      if (den > 0)
        pos[i] = Math.max(lo[i]!, Math.min(hi[i]!, pos[i]! + 1.9 * (num / den - pos[i]!)));
    }
  }
  return pos;
}

/** Corners of the middle line: runs where it bends tighter than 1/`radius`, merged when close. */
export function findCorners(
  k: readonly number[],
  step: number,
  radius = 220,
  minDeg = 20,
): { from: number; to: number; dir: 1 | -1; angleDeg: number }[] {
  const smooth = k.map((_, i) => {
    let s = 0;
    let m = 0;
    for (let d = -3; d <= 3; d++) {
      const j = (i + d + k.length) % k.length;
      s += k[j]!;
      m++;
    }
    return s / m;
  });
  const out: { from: number; to: number; dir: 1 | -1; angleDeg: number }[] = [];
  let i = 0;
  while (i < smooth.length) {
    if (Math.abs(smooth[i]!) < 1 / radius) {
      i++;
      continue;
    }
    const dir = smooth[i]! > 0 ? 1 : -1;
    let j = i;
    while (j + 1 < smooth.length && smooth[j + 1]! * dir > 1 / radius / 2) j++;
    const angle =
      Math.abs(smooth.slice(i, j + 1).reduce((s, v) => s + v, 0) * step) * (180 / Math.PI);
    if (angle >= minDeg) out.push({ from: i, to: j, dir, angleDeg: Math.round(angle) });
    i = j + 1;
  }
  return out;
}

/**
 * The textbook line of every corner on its own: turn in from the outside, touch the inside at the
 * corner's geometric middle, run out to the outside, then the least bending in between. When two
 * corners are too close for both run-out and turn-in, only their apexes are kept (the car cannot
 * be on the outside for both), but nothing looks further ahead than that.
 */
export function cornerLine(
  c: readonly Centre[],
  half: number,
  closed: boolean,
  step: number,
): number[] {
  const n = c.length;
  const normals = leftNormals(c, closed);
  const k = curvatures(c, closed);
  const corners = findCorners(k, step);
  const pos = c.map(() => 0);
  const fixed = new Set<number>();
  const wrap = (i: number) => (closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i)));
  const lead = Math.round(45 / step);
  corners.forEach((corner, idx) => {
    // Apex: the curvature-weighted middle of the corner, on the inside.
    let w = 0;
    let sum = 0;
    for (let i = corner.from; i <= corner.to; i++) {
      w += Math.abs(k[wrap(i)]!);
      sum += Math.abs(k[wrap(i)]!) * i;
    }
    const apex = wrap(Math.round(sum / (w || 1)));
    pos[apex] = corner.dir;
    fixed.add(apex);
    const prev = corners[(idx - 1 + corners.length) % corners.length];
    const next = corners[(idx + 1) % corners.length];
    const gapBefore = prev && prev !== corner ? (corner.from - prev.to + n) % n : n;
    const gapAfter = next && next !== corner ? (next.from - corner.to + n) % n : n;
    if (gapBefore > 2 * lead || (!closed && idx === 0)) {
      const i = wrap(corner.from - lead);
      pos[i] = -corner.dir;
      fixed.add(i);
    }
    if (gapAfter > 2 * lead || (!closed && idx === corners.length - 1)) {
      const i = wrap(corner.to + lead);
      pos[i] = -corner.dir;
      fixed.add(i);
    }
  });
  return leastBending(c, normals, half, closed, pos, fixed);
}

/** Speed at every point and the lap time, for a line, with grip, braking and power limits. */
export function lapTime(
  p: readonly Centre[],
  closed: boolean,
  car: Car = TYPICAL_CAR,
): { time: number; speed: number[] } {
  const n = p.length;
  const k = curvatures(p, closed);
  const ds = p.map((a, i) => {
    const b = p[closed ? (i + 1) % n : Math.min(n - 1, i + 1)]!;
    return Math.hypot(b.x - a.x, b.z - a.z);
  });
  const corner = k.map((c) =>
    Math.min(car.top, Math.sqrt((car.grip * G) / Math.max(1e-6, Math.abs(c)))),
  );
  const v = [...corner];
  // Two rounds, so a circuit's end and start agree.
  for (let round = 0; round < (closed ? 2 : 1); round++) {
    for (let m = 1; m <= n; m++) {
      const i = closed ? m % n : Math.min(m, n - 1);
      const prev = closed ? (m - 1) % n : m - 1;
      if (!closed && m === n) break;
      const vp = v[prev]!;
      const lat = vp * vp * Math.abs(k[prev]!);
      const left = Math.sqrt(Math.max(0, 1 - (lat / (car.grip * G)) ** 2));
      const acc = Math.min(car.powerPerKg / Math.max(vp, 5), car.grip * G) * left;
      v[i] = Math.min(v[i]!, Math.sqrt(vp * vp + 2 * acc * ds[prev]!));
    }
    for (let m = n - 2 + (closed ? 1 : 0); m >= 0; m--) {
      const i = m;
      const next = closed ? (m + 1) % n : m + 1;
      const vn = v[next]!;
      const lat = vn * vn * Math.abs(k[next]!);
      const left = Math.sqrt(Math.max(0, 1 - (lat / (car.grip * G)) ** 2));
      v[i] = Math.min(v[i]!, Math.sqrt(vn * vn + 2 * car.brake * G * left * ds[i]!));
    }
  }
  let time = 0;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const vb = v[closed ? (i + 1) % n : i + 1]!;
    time += ds[i]! / Math.max(1, (v[i]! + vb) / 2);
  }
  return { time, speed: v };
}

/**
 * The fastest line: lap time minimised by moving the least-bending line sideways. The moves are
 * set at control points every `spacing` m and joined smoothly (so the line has no zigzags), and
 * found by Rprop on numerical gradients: each control point has its own step, which grows while
 * its gradient keeps its sign and shrinks when it flips.
 *
 * `pins` (index → position) are points the line must pass, from people who know the route (a
 * grass cut at a checkpoint, a late apex): a heavy penalty holds the line on them, and `limits`
 * let it leave the asphalt around off-road pins.
 */
export function fastestLine(
  c: readonly Centre[],
  half: number,
  closed: boolean,
  step: number,
  start: readonly number[],
  car: Car = TYPICAL_CAR,
  spacing = 20,
  iterations = 300,
  pins: ReadonlyMap<number, number> = new Map(),
  limits?: Limits,
): number[] {
  const n = c.length;
  const normals = leftNormals(c, closed);
  const lo = limits?.lo ?? new Array<number>(n).fill(-1);
  const hi = limits?.hi ?? new Array<number>(n).fill(1);
  const every = Math.max(1, Math.round(spacing / step));
  const m = closed ? Math.ceil(n / every) : Math.ceil((n - 1) / every) + 1;
  // Catmull–Rom between control points (wrapping on a circuit), added to the starting line.
  const expand = (q: readonly number[]) => {
    const out = new Array<number>(n);
    const get = (j: number) => (closed ? q[(j + m) % m]! : q[Math.max(0, Math.min(m - 1, j))]!);
    for (let i = 0; i < n; i++) {
      const j = Math.floor(i / every);
      const t = (i - j * every) / every;
      const p0 = get(j - 1);
      const p1 = get(j);
      const p2 = get(j + 1);
      const p3 = get(j + 2);
      const t2 = t * t;
      const t3 = t2 * t;
      const d =
        0.5 *
        (2 * p1 +
          (-p0 + p2) * t +
          (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
          (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
      out[i] = Math.max(lo[i]!, Math.min(hi[i]!, start[i]! + d));
    }
    return out;
  };
  // Seconds per unit² off a pin: 0.1 off costs 0.3 s, far more than any line gains.
  const PIN_WEIGHT = 30;
  const cost = (q: readonly number[]) => {
    const pos = expand(q);
    let miss = 0;
    for (const [i, p] of pins) miss += (pos[i]! - p) ** 2;
    return lapTime(placeLine(c, normals, pos, half), closed, car).time + PIN_WEIGHT * miss;
  };
  let delta = new Array<number>(m).fill(0);
  let best = cost(delta);
  let bestDelta = delta;
  const stepOf = new Array<number>(m).fill(0.05);
  const prev = new Array<number>(m).fill(0);
  const h = 0.02;
  for (let it = 0; it < iterations; it++) {
    const grad = delta.map((v, j) => {
      const up = [...delta];
      up[j] = v + h;
      const down = [...delta];
      down[j] = v - h;
      return (cost(up) - cost(down)) / (2 * h);
    });
    delta = delta.map((v, j) => {
      const g = grad[j]!;
      if (g * prev[j]! > 0) stepOf[j] = Math.min(0.3, stepOf[j]! * 1.2);
      else if (g * prev[j]! < 0) {
        stepOf[j] = Math.max(1e-4, stepOf[j]! * 0.5);
        prev[j] = 0;
        return v;
      }
      prev[j] = g;
      return Math.max(-2, Math.min(2, v - Math.sign(g) * stepOf[j]!));
    });
    const t = cost(delta);
    if (t < best) {
      best = t;
      bestDelta = [...delta];
    }
  }
  return expand(bestDelta);
}
