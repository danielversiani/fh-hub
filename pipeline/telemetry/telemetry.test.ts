import { describe, expect, it } from 'vitest';
import { measureRoute } from './geometry';
import { oneLap, parsePacket, splitRuns, type Sample } from './packet';
import { parseRaceList, recognise, type Route } from './routes';

const sample = (t: number, x: number, z: number, extra: Partial<Sample> = {}): Sample => ({
  t,
  raceOn: true,
  latAcc: 0,
  pitch: 0,
  roll: 0,
  susp: [0.5, 0.5, 0.5, 0.5],
  x,
  y: 100,
  z,
  speed: 30,
  raceTime: t / 1000,
  lap: 0,
  ...extra,
});

/** A counter-clockwise circle of radius r, one packet per metre. */
const circle = (r: number, laps = 1) => {
  const n = Math.round(2 * Math.PI * r * laps);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / (2 * Math.PI * r)) * 2 * Math.PI;
    return sample(i * 33, r * Math.cos(a), r * Math.sin(a), {
      lap: Math.floor(i / (2 * Math.PI * r)),
    });
  });
};

describe('Data Out packets', () => {
  it('reads position, speed, lap and race state from the Dash layout', () => {
    const p = Buffer.alloc(324);
    p.writeInt32LE(1, 0);
    p.writeFloatLE(-180.5, 244);
    p.writeFloatLE(109.5, 248);
    p.writeFloatLE(-5388, 252);
    p.writeFloatLE(25, 256);
    p.writeUInt16LE(2, 312);
    expect(parsePacket(p, 0)).toMatchObject({
      raceOn: true,
      x: -180.5,
      y: 109.5,
      z: -5388,
      speed: 25,
      lap: 2,
    });
    expect(parsePacket(Buffer.alloc(100), 0)).toBeUndefined();
  });
  it('drops idle stretches and splits races when the race clock restarts', () => {
    const race = circle(200);
    const idle = Array.from({ length: 50 }, (_, i) => sample(i, 0, 0, { speed: 0 }));
    const second = circle(200).map((s) => ({ ...s, t: s.t + 1e6 }));
    expect(splitRuns([...idle, ...race, ...second])).toHaveLength(2);
  });
  it('keeps one full lap of a circuit', () => {
    const { samples, laps } = oneLap(circle(150, 3));
    expect(laps).toBe(3);
    expect(samples.length).toBeLessThan(1000);
  });
});

describe('route geometry', () => {
  it('finds a left turn of about 360° and the right radius on a circle', () => {
    const m = measureRoute(circle(120));
    const total = m.turns.reduce((s, t) => s + (t.dir === 'L' ? t.angleDeg : -t.angleDeg), 0);
    expect(total).toBeGreaterThan(300);
    expect(m.turns.every((t) => Math.abs(t.radiusM - 120) < 25)).toBe(true);
    expect(m.lengthM).toBeGreaterThan(700);
  });
  it('finds a straight and the climb on a straight slope', () => {
    const line = Array.from({ length: 800 }, (_, i) => sample(i * 33, i, 0, { y: 100 + i * 0.05 }));
    const m = measureRoute(line);
    expect(m.turns).toHaveLength(0);
    expect(m.straights).toHaveLength(1);
    expect(m.stats.climbM).toBeGreaterThan(35);
    expect(m.stats.maxGradePct).toBeCloseTo(5, 0);
  });
});

describe('route list and recognition', () => {
  it('reads name, race type and laps from the public list', () => {
    const html =
      '<h2 class="race-group__title" x>Road Races</h2><img src="/images/RaceDaikokuCircuitTrack.webp" alt="Daikoku Circuit track layout"><span>3.3 mi</span><span>2 laps</span>';
    expect(parseRaceList(html)).toEqual([
      { name: 'Daikoku Circuit', key: 'RaceDaikokuCircuit', group: 'Road Races', laps: 2 },
    ]);
  });
  it('recognises a shape and refuses an unlike one', () => {
    const ring = (r: number, n = 300): [number, number][] =>
      Array.from({ length: n }, (_, i) => [
        200 + r * Math.cos((i / n) * 2 * Math.PI),
        150 + r * Math.sin((i / n) * 2 * Math.PI),
      ]);
    const line: [number, number][] = Array.from({ length: 300 }, (_, i) => [i, 150]);
    const routes: Route[] = [
      { id: 'ring', name: 'Ring', surface: 'road', kind: 'circuit', shape: ring(80) },
      { id: 'line', name: 'Line', surface: 'road', kind: 'sprint', shape: line },
    ];
    const driven = circle(500).map((s) => ({ x: s.x, z: s.z }));
    expect(recognise(driven, routes).route?.id).toBe('ring');
    const zigzag = Array.from({ length: 400 }, (_, i) => ({ x: i, z: (i % 80) * 3 }));
    expect(recognise(zigzag, [routes[0]!]).route).toBeUndefined();
  });
});
