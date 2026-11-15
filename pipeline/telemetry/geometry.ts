import type { Track } from '../schema/entities';
import type { Sample } from './packet';

/** Resampling step along the driven line (m). */
const STEP = 5;
/** A bend is tighter than this radius (m); a straight is wider than STRAIGHT_RADIUS. */
const TURN_RADIUS = 250;
const STRAIGHT_RADIUS = 700;
const MIN_TURN_DEG = 15;
const MIN_STRAIGHT_M = 200;
/** Wheels count as off the ground below this normalised suspension travel. */
const AIRBORNE = 0.03;

interface Point {
  s: number;
  x: number;
  z: number;
  y: number;
  /** Roll angle with the car's own body roll removed (deg): the road's sideways tilt. */
  tilt: number;
  air: boolean;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function smooth(values: readonly number[], half: number): number[] {
  return values.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let k = Math.max(0, i - half); k <= Math.min(values.length - 1, i + half); k++) {
      sum += values[k]!;
      n++;
    }
    return sum / n;
  });
}

/** Body roll per m/s² of lateral acceleration, fitted on the run (it differs between cars). */
function bodyRoll(samples: readonly Sample[]): number {
  const n = samples.length;
  const mx = samples.reduce((a, s) => a + s.latAcc, 0) / n;
  const my = samples.reduce((a, s) => a + s.roll, 0) / n;
  let num = 0;
  let den = 0;
  for (const s of samples) {
    num += (s.latAcc - mx) * (s.roll - my);
    den += (s.latAcc - mx) ** 2;
  }
  return den ? num / den : 0;
}

/** Points every STEP metres along the driven line (linear interpolation between packets). */
function resample(samples: readonly Sample[]): Point[] {
  const k = bodyRoll(samples);
  const raw = samples.map((s) => ({
    x: s.x,
    z: s.z,
    y: s.y,
    tilt: ((s.roll - k * s.latAcc) * 180) / Math.PI,
    air: s.susp.every((v) => v < AIRBORNE),
  }));
  const out: Point[] = [];
  let s = 0;
  let next = 0;
  for (let i = 1; i < raw.length; i++) {
    const a = raw[i - 1]!;
    const b = raw[i]!;
    const d = Math.hypot(b.x - a.x, b.z - a.z, b.y - a.y);
    if (d > 60) continue; // a teleport (restart, rewind): skip the jump
    while (next <= s + d && d > 0) {
      const f = (next - s) / d;
      out.push({
        s: next,
        x: a.x + (b.x - a.x) * f,
        z: a.z + (b.z - a.z) * f,
        y: a.y + (b.y - a.y) * f,
        tilt: a.tilt + (b.tilt - a.tilt) * f,
        air: a.air && b.air,
      });
      next += STEP;
    }
    s += d;
  }
  return out;
}

/** Signed curvature (1/m, + = left turn) from the heading of a smoothed line. */
function curvature(pts: readonly Point[]): number[] {
  const x = smooth(
    pts.map((p) => p.x),
    3,
  );
  const z = smooth(
    pts.map((p) => p.z),
    3,
  );
  const heading = x.map((_, i) => {
    const a = Math.max(0, i - 2);
    const b = Math.min(x.length - 1, i + 2);
    return Math.atan2(z[b]! - z[a]!, x[b]! - x[a]!);
  });
  const k = heading.map((_, i) => {
    if (i === 0) return 0;
    let d = heading[i]! - heading[i - 1]!;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d / STEP;
  });
  return smooth(k, 2);
}

/** Runs of indices where `test` holds, at least `minLen` points long. */
function stretches(n: number, test: (i: number) => boolean, minLen: number): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  for (let i = 0; i <= n; i++) {
    const on = i < n && test(i);
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      if (i - start >= minLen) out.push([start, i - 1]);
      start = -1;
    }
  }
  return out;
}

/** Everything about the route that holds for any car (ADR-0021). */
export function measureRoute(
  samples: readonly Sample[],
): Omit<Track, 'id' | 'name' | 'surface' | 'kind' | 'laps' | 'recordings' | 'updatedAt'> {
  const pts = resample(samples);
  const n = pts.length;
  const k = curvature(pts);
  const y = smooth(
    pts.map((p) => p.y),
    4,
  );
  const tilt = smooth(
    pts.map((p) => p.tilt),
    4,
  );
  // Grade over ±20 m.
  const grade = y.map((_, i) => {
    const a = Math.max(0, i - 4);
    const b = Math.min(n - 1, i + 4);
    return b > a ? ((y[b]! - y[a]!) / ((b - a) * STEP)) * 100 : 0;
  });
  // The sign of the roll angle is the game's: camber counts as + when the road leans into the
  // bend, so the sign is fixed per run from the bends (roads are mostly banked inwards).
  const bendTilt = k.reduce(
    (sum, c, i) => sum + Math.sign(c) * tilt[i]! * (Math.abs(c) > 1 / TURN_RADIUS ? 1 : 0),
    0,
  );
  const tiltSign = bendTilt < 0 ? -1 : 1;

  // Bends: tight enough for long enough; neighbours in the same direction close together merge.
  const raw = stretches(n, (i) => Math.abs(k[i]!) > 1 / TURN_RADIUS, 3);
  const merged: [number, number][] = [];
  for (const t of raw) {
    const last = merged[merged.length - 1];
    if (last && t[0] - last[1] <= 4 && Math.sign(k[t[0]]!) === Math.sign(k[last[1]]!))
      last[1] = t[1];
    else merged.push([...t]);
  }
  const turns = merged
    .map(([a, b]) => {
      const seg = k.slice(a, b + 1);
      const angle = (seg.reduce((s, c) => s + c, 0) * STEP * 180) / Math.PI;
      const peak = Math.max(...seg.map(Math.abs));
      const dir: 'L' | 'R' = angle > 0 ? 'L' : 'R';
      const mid = Math.round((a + b) / 2);
      return {
        dir,
        startM: Math.round(pts[a]!.s),
        endM: Math.round(pts[b]!.s),
        angleDeg: Math.round(Math.abs(angle)),
        radiusM: Math.round(1 / peak),
        camberDeg: r1(tilt[mid]! * tiltSign * (dir === 'L' ? 1 : -1)),
        gradePct: r1(grade[mid]!),
      };
    })
    .filter((t) => t.angleDeg >= MIN_TURN_DEG)
    .map((t, i) => ({ n: i + 1, ...t }));

  const straights = stretches(
    n,
    (i) => Math.abs(k[i]!) < 1 / STRAIGHT_RADIUS,
    MIN_STRAIGHT_M / STEP,
  ).map(([a, b]) => ({ startM: Math.round(pts[a]!.s), endM: Math.round(pts[b]!.s) }));
  const jumps = stretches(n, (i) => pts[i]!.air, 2).map(([a, b]) => ({
    atM: Math.round(pts[a]!.s),
    lengthM: Math.round(pts[b]!.s - pts[a]!.s + STEP),
  }));
  // Crests: the grade drops by more than 8 points within 40 m (a hump the car can go light over).
  const crests: { atM: number }[] = [];
  for (let i = 4; i < n - 4; i++) {
    if (grade[i - 4]! - grade[i + 4]! > 8 && grade[i - 4]! > 0) {
      const at = Math.round(pts[i]!.s);
      if (!crests.length || at - crests[crests.length - 1]!.atM > 60) crests.push({ atM: at });
    }
  }

  let climb = 0;
  let descent = 0;
  for (let i = 1; i < n; i++) {
    const d = y[i]! - y[i - 1]!;
    if (d > 0) climb += d;
    else descent -= d;
  }
  const path = pts
    .filter((_, i) => i % 2 === 0)
    .map((p, j) => {
      const i = j * 2;
      const side = Math.abs(k[i]!) > 1 / STRAIGHT_RADIUS ? Math.sign(k[i]!) : 0;
      return [r1(p.x), r1(p.z), r1(y[i]!), r1(side ? tilt[i]! * tiltSign * side : 0)] as [
        number,
        number,
        number,
        number,
      ];
    });
  return {
    lengthM: Math.round(pts[n - 1]?.s ?? 0),
    path,
    turns,
    straights,
    jumps,
    crests,
    stats: {
      elevationMin: Math.round(Math.min(...y)),
      elevationMax: Math.round(Math.max(...y)),
      climbM: Math.round(climb),
      descentM: Math.round(descent),
      maxGradePct: r1(Math.max(...grade.map(Math.abs))),
      maxCamberDeg: r1(Math.max(...turns.map((t) => Math.abs(t.camberDeg)), 0)),
    },
  };
}
