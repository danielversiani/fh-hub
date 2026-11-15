import fs from 'node:fs';

/**
 * Forza Horizon "Data Out" packets (324 bytes, the FH4/FH5 "Dash" layout; FH6 sends the same).
 * Only the fields the track tools use.
 */
export interface Sample {
  /** Milliseconds since the recording started. */
  t: number;
  raceOn: boolean;
  /** Local lateral acceleration (m/s²), used to remove body roll from the roll angle. */
  latAcc: number;
  pitch: number;
  roll: number;
  /** Normalised suspension travel per wheel (0 = fully extended, i.e. in the air). */
  susp: [number, number, number, number];
  x: number;
  y: number;
  z: number;
  speed: number;
  raceTime: number;
  lap: number;
}

export const PACKET_SIZE = 324;

export function parsePacket(p: Buffer, t: number): Sample | undefined {
  if (p.length !== PACKET_SIZE) return undefined;
  return {
    t,
    raceOn: p.readInt32LE(0) !== 0,
    latAcc: p.readFloatLE(20),
    pitch: p.readFloatLE(60),
    roll: p.readFloatLE(64),
    susp: [p.readFloatLE(68), p.readFloatLE(72), p.readFloatLE(76), p.readFloatLE(80)],
    x: p.readFloatLE(244),
    y: p.readFloatLE(248),
    z: p.readFloatLE(252),
    speed: p.readFloatLE(256),
    raceTime: p.readFloatLE(308),
    lap: p.readUInt16LE(312),
  };
}

/** Reads a file written by `pnpm telemetry:record` (float64 time, uint16 length, packet). */
export function readRecording(file: string): Sample[] {
  const data = fs.readFileSync(file);
  const out: Sample[] = [];
  for (let i = 0; i + 10 <= data.length;) {
    const t = data.readDoubleLE(i);
    const n = data.readUInt16LE(i + 8);
    i += 10;
    if (i + n > data.length) break;
    const s = parsePacket(data.subarray(i, i + n), t);
    if (s?.raceOn) out.push(s);
    i += n;
  }
  return out;
}

/**
 * Splits a recording into races: race-on stretches whose race clock keeps running. Idle stretches
 * (menus, the Festival, standing on the grid) are dropped: under 1 km driven or never above 40 km/h.
 */
export function splitRuns(samples: readonly Sample[]): Sample[][] {
  const runs: Sample[][] = [];
  let cur: Sample[] = [];
  for (const s of samples) {
    const prev = cur[cur.length - 1];
    if (prev && (s.raceTime + 0.5 < prev.raceTime || s.t - prev.t > 3000)) {
      runs.push(cur);
      cur = [];
    }
    cur.push(s);
  }
  if (cur.length) runs.push(cur);
  return runs.filter((run) => {
    let d = 0;
    for (let i = 1; i < run.length; i++)
      d += Math.hypot(run[i]!.x - run[i - 1]!.x, run[i]!.z - run[i - 1]!.z);
    return d > 1000 && Math.max(...run.map((s) => s.speed)) > 11;
  });
}

/**
 * The part of a run that describes the route once: for a circuit, the lap whose end comes closest
 * to its start (a full lap); for a sprint, the whole run from the moment the car moves.
 */
export function oneLap(run: readonly Sample[]): { samples: Sample[]; laps: number } {
  const moving = run.slice(
    Math.max(
      0,
      run.findIndex((s) => s.speed > 2),
    ),
  );
  const laps = new Map<number, Sample[]>();
  for (const s of moving) {
    const lap = laps.get(s.lap);
    if (lap) lap.push(s);
    else laps.set(s.lap, [s]);
  }
  if (laps.size <= 1) return { samples: moving, laps: 1 };
  const full = [...laps.values()]
    .filter((l) => l.length > 50)
    .map((l) => ({
      l,
      gap: Math.hypot(l[0]!.x - l[l.length - 1]!.x, l[0]!.z - l[l.length - 1]!.z),
    }))
    .sort((a, b) => a.gap - b.gap);
  return { samples: full[0]?.l ?? moving, laps: laps.size };
}
