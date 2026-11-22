import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { stringify } from 'yaml';
import { ROOT } from '../paths';
import { Track } from '../schema/entities';
import { measureRoute } from '../telemetry/geometry';
import type { Sample } from '../telemetry/packet';
import { loadRoutes } from '../telemetry/routes';
import { findArrow, routeMask, thin, traceLine } from './centerline';
import {
  cornerLine,
  fastestLine,
  lapTime,
  leastBending,
  leftNormals,
  placeLine,
  type Centre,
} from './racing-line';

/**
 * A simplified model of a route nobody has recorded yet (ADR-0023): the middle line comes from
 * the route picture (labsgg.com), the size from the race distance, the road is flat and of one
 * width, and two racing lines are computed — each corner on its own, and the fastest lap.
 *
 *   pnpm tracks:sketch -- --route=<route id> [--width=12]
 *
 * Writes data/tracks/<id>.json and <id>.lines.yaml (regenerated every run), and a starting
 * <id>.scene.yaml (unpublished) only when there is none. A route with telemetry is left alone.
 */
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, v = 'true'] = a.slice(2).split('=');
      return [k, v];
    }),
);
const STEP = 5;
const MILE = 1609.344;
const OUT = path.join(ROOT, 'data', 'tracks');
const IMG = path.join(ROOT, '.cache', 'tracks', 'labsgg', 'img');

const routes = await loadRoutes();
const route = routes.find((r) => r.id === args.route);
if (!route?.key || !route.miles || !route.surface) {
  console.error(`✗ route "${args.route}" needs a picture, a distance and a surface (labsgg list)`);
  process.exit(1);
}
const target = path.join(OUT, `${route.id}.json`);
if (fs.existsSync(target)) {
  const existing = Track.parse(JSON.parse(fs.readFileSync(target, 'utf8')));
  if (existing.source === 'telemetry') {
    console.error(`✗ ${route.id} already has telemetry; a sketch would replace better data`);
    process.exit(1);
  }
}
const closed = route.kind === 'circuit';
const laps = route.laps ?? 1;
const lengthM = (route.miles * MILE) / laps;
const width = Number(args.width ?? 12);
const half = width / 2;

// 1. The middle of the route line in the picture, in travel order from the arrow.
const { data, info } = await sharp(path.join(IMG, `${route.key}.webp`))
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const pic = { width: info.width, height: info.height, data };
const mask = routeMask(pic);
let line = traceLine(thin(mask, info.width, info.height), info.width, info.height, closed);
const arrow = findArrow(pic, mask, line);
if (arrow) {
  if (closed) line = [...line.slice(arrow.index), ...line.slice(0, arrow.index)];
  if (arrow.sign < 0) line = closed ? [line[0]!, ...line.slice(1).reverse()] : line.reverse();
} else console.warn('! no direction arrow found: check the direction on the page');

// 2. Smooth the pixel steps and scale to the race distance (picture x = map x, y = −z).
const n0 = line.length;
const soft = line.map((_, i) => {
  let x = 0;
  let y = 0;
  let m = 0;
  for (let d = -4; d <= 4; d++) {
    const j = closed ? (i + d + n0) % n0 : Math.min(n0 - 1, Math.max(0, i + d));
    x += line[j]![0];
    y += line[j]![1];
    m++;
  }
  return { x: x / m, y: y / m };
});
let px = 0;
for (let i = 1; i < (closed ? n0 + 1 : n0); i++) {
  const a = soft[(i - 1) % n0]!;
  const b = soft[i % n0]!;
  px += Math.hypot(b.x - a.x, b.y - a.y);
}
const scale = lengthM / px;
const mx = soft.reduce((s, p) => s + p.x, 0) / n0;
const my = soft.reduce((s, p) => s + p.y, 0) / n0;
const raw: Centre[] = soft.map((p) => ({ x: (p.x - mx) * scale, z: -(p.y - my) * scale }));

// 3. Points every STEP m along the line.
const centre: Centre[] = [];
{
  let s = 0;
  let next = 0;
  const count = closed ? raw.length + 1 : raw.length;
  for (let i = 1; i < count; i++) {
    const a = raw[(i - 1) % raw.length]!;
    const b = raw[i % raw.length]!;
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    while (next <= s + d && d > 0) {
      const f = (next - s) / d;
      centre.push({ x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f });
      next += STEP;
    }
    s += d;
  }
  if (closed && centre.length * STEP > lengthM - STEP / 2)
    centre.length = Math.round(lengthM / STEP);
}
// The picture's pixels are ~4 m: smooth out their steps (3 passes of ±10 m), or the racing-line
// maths would chase the pixel steps instead of the corners.
for (let pass = 0; pass < 3; pass++) {
  const copy = centre.map((p) => ({ ...p }));
  const n = copy.length;
  centre.forEach((p, i) => {
    if (!closed && (i < 2 || i > n - 3)) return;
    let x = 0;
    let z = 0;
    for (let d = -2; d <= 2; d++) {
      const q = copy[(i + d + n) % n]!;
      x += q.x;
      z += q.z;
    }
    p.x = x / 5;
    p.z = z / 5;
  });
}

// 4. The two lines.
const normals = leftNormals(centre, closed);
const generic = cornerLine(centre, half, closed, STEP);
const smoothest = leastBending(
  centre,
  normals,
  half,
  closed,
  centre.map(() => 0),
);
const fastest = fastestLine(centre, half, closed, STEP, smoothest);
const tGeneric = lapTime(placeLine(centre, normals, generic, half), closed).time;
const tFastest = lapTime(placeLine(centre, normals, fastest, half), closed).time;
const tSmooth = lapTime(placeLine(centre, normals, smoothest, half), closed).time;

// 5. The route file, measured like a recorded lap (flat road, constant speed).
const samples: Sample[] = [...centre, ...(closed ? [centre[0]!] : [])].map((p, i) => ({
  t: i * 166,
  raceOn: true,
  latAcc: 0,
  pitch: 0,
  roll: 0,
  susp: [0.5, 0.5, 0.5, 0.5],
  x: p.x,
  y: 0,
  z: p.z,
  speed: 30,
  raceTime: i * 0.166,
  lap: 0,
}));
const track = Track.parse({
  id: route.id,
  name: route.name,
  surface: route.surface,
  kind: route.kind,
  laps: route.laps,
  source: 'map',
  recordings: 0,
  updatedAt: new Date().toISOString().slice(0, 10),
  ...measureRoute(samples),
});
fs.writeFileSync(target, `${JSON.stringify(track, null, 1)}\n`);

// 6. The lines file, with a note on each corner where the fastest line differs.
const r2 = (v: number) => Math.round(v * 100) / 100;
const every = 10 / STEP;
const points = (pos: number[]) =>
  pos.filter((_, i) => i % every === 0).map((v, j) => ({ at: j * 10, pos: r2(v) }));
// Corners numbered as on the page (the route file's turns).
const corners = track.turns.map((t) => ({
  from: Math.round(t.startM / STEP),
  to: Math.round(t.endM / STEP),
  dir: t.dir === 'L' ? 1 : -1,
}));
const notes = corners.flatMap((c, idx) => {
  const span = (from: number, to: number, pos: number[]) => {
    let s = 0;
    for (let i = from; i <= to; i++) s += pos[(i + centre.length) % centre.length]!;
    return s / (to - from + 1);
  };
  const lead = Math.round(40 / STEP);
  const entryG = span(c.from - lead, c.from, generic) * -c.dir;
  const entryF = span(c.from - lead, c.from, fastest) * -c.dir;
  const exitG = span(c.to, c.to + lead, generic) * -c.dir;
  const exitF = span(c.to, c.to + lead, fastest) * -c.dir;
  const next = corners[(idx + 1) % corners.length];
  const gap = next ? ((next.from - c.to + centre.length) % centre.length) * STEP : 0;
  const side = c.dir > 0 ? { pt: 'esquerda', en: 'left' } : { pt: 'direita', en: 'right' };
  const n = track.turns[idx]!.n;
  const from = Math.max(0, (c.from - lead) * STEP);
  const to = Math.min(track.lengthM, (c.to + lead) * STEP);
  if (entryG - entryF > 0.35)
    return [
      {
        from,
        to,
        line: 'otimizado',
        title: { 'pt-br': `Curva ${n} (${side.pt})`, en: `Turn ${n} (${side.en})` },
        text: {
          'pt-br': `O otimizado não abre tudo na entrada: sacrifica um pouco esta curva para ${gap < 120 ? 'chegar bem posicionado na curva seguinte' : `sair mais rápido para os ${Math.round(gap / 10) * 10} m até a próxima`}.`,
          en: `The fastest line does not swing fully wide on entry: it gives up a little here to ${gap < 120 ? 'be well placed for the next corner' : `exit faster onto the ${Math.round(gap / 10) * 10} m to the next one`}.`,
        },
      },
    ];
  if (exitG - exitF > 0.35)
    return [
      {
        from,
        to,
        line: 'otimizado',
        title: { 'pt-br': `Curva ${n} (${side.pt})`, en: `Turn ${n} (${side.en})` },
        text: {
          'pt-br':
            'O otimizado não abre na saída: segura o carro do lado de dentro para já se posicionar para a próxima curva, logo adiante.',
          en: 'The fastest line does not run wide on exit: it holds the inside to set up the next corner, just ahead.',
        },
      },
    ];
  return [];
});
const lines = {
  lines: [
    {
      id: 'generico',
      name: { 'pt-br': 'Curva a curva', en: 'Corner by corner' },
      for: {
        'pt-br': 'Cada curva do jeito clássico (aberto, ápice, aberto), como se fosse a única.',
        en: 'Each corner the textbook way (wide, apex, wide), as if it were the only one.',
      },
      colors: ['#ffb02e', '#ff7a1a'],
      visible: false,
      points: points(generic),
    },
    {
      id: 'otimizado',
      name: { 'pt-br': 'Otimizado', en: 'Optimised' },
      for: {
        'pt-br': 'A volta mais rápida para um carro típico: pensa no que vem antes e depois.',
        en: 'The fastest lap for a typical car: thinks about what comes before and after.',
      },
      colors: ['#2fb7ff', '#3ee07a'],
      visible: true,
      points: points(fastest),
    },
  ],
  notes,
};
const header = `# Generated by \`pnpm tracks:sketch -- --route=${route.id}\` (ADR-0023): do not edit by hand.\n`;
fs.writeFileSync(
  path.join(OUT, `${route.id}.lines.yaml`),
  header + stringify(lines, { lineWidth: 0 }),
);

// 7. A starting scene, only once (it may be edited afterwards).
const sceneFile = path.join(OUT, `${route.id}.scene.yaml`);
if (!fs.existsSync(sceneFile)) {
  const scene = {
    published: false,
    road: { width, surface: route.surface === 'road' ? 'asphalt' : 'dirt', edgeLines: true },
    camber: 'flat',
    sections: [{ from: 0, width }],
    checkpoints: [],
  };
  fs.writeFileSync(
    sceneFile,
    `# Simplified model from the route picture (ADR-0023). Widths and scenery can be refined by hand.\n${stringify(scene)}`,
  );
}

console.log(
  `${route.name}: ${(track.lengthM / 1000).toFixed(2)} km (${scale.toFixed(2)} m/px), ` +
    `${track.turns.length} turns, ${notes.length} notes · lap: corner by corner ${tGeneric.toFixed(1)} s, ` +
    `least bending ${tSmooth.toFixed(1)} s, optimised ${tFastest.toFixed(1)} s`,
);
