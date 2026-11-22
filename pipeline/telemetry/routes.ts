import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { slugify } from '../lib/text';
import { ROOT } from '../paths';
import type { Surface } from '../schema/enums';

/**
 * The game's routes with their name, race type (which gives the surface) and the shape of the
 * route line, from the public race list and route images of labsgg.com (ADR-0021: game content,
 * no credit needed, owner's decision). Routes missing there come from data/manual/routes.yaml.
 */
export interface Route {
  id: string;
  name: string;
  surface: Surface | null;
  kind: 'sprint' | 'circuit';
  laps?: number;
  /** Picture key on labsgg.com (`/images/<key>Track.webp`). */
  key?: string;
  /** Whole race distance (all laps), in miles, as the list states it. */
  miles?: number;
  /** Route line in image pixels (y down = south), when there is a picture. */
  shape?: [number, number][];
}

const LIST_URL = 'https://labsgg.com/all-race-tracks';
const CACHE = path.join(ROOT, '.cache', 'tracks', 'labsgg');
/** Race type headings of the list → surface. */
const SURFACES: Readonly<Record<string, Surface | null>> = {
  'Street Races': 'road',
  'Road Races': 'road',
  'Touge Races': 'road',
  'Drag Races': 'road',
  'Dirt Races': 'dirt',
  'Cross Country Races': 'cross-country',
  'Wristband Events': null,
};

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (forza-paddock tracks)' } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

/**
 * The race list: name, picture key, race type, number of laps and race distance, in page order.
 * Each card states its name, distance and laps just before its picture.
 */
export function parseRaceList(
  html: string,
): { name: string; key: string; group: string; laps?: number; miles?: number }[] {
  const out: { name: string; key: string; group: string; laps?: number; miles?: number }[] = [];
  const marks = [...html.matchAll(/<h2 class="race-group__title"[^>]*>([^<]+)<\/h2>/g)].map(
    (m) => ({
      at: m.index,
      group: m[1]!.trim(),
    }),
  );
  const seen = new Set<string>();
  let cardStart = 0;
  for (const m of html.matchAll(
    /\/images\/(Race[A-Za-z0-9-]*?)Track\.webp[^>]*?alt="([^"]+?) track layout"/g,
  )) {
    const key = m[1]!;
    const card = html.slice(cardStart, m.index).replace(/<[^>]+>/g, '\n');
    cardStart = m.index + m[0].length;
    if (seen.has(key)) continue;
    seen.add(key);
    const group = [...marks].reverse().find((h) => h.at < m.index)?.group ?? '';
    const laps = [...card.matchAll(/\n\s*(\d+) laps?\s*\n/g)].pop()?.[1];
    const miles = [...card.matchAll(/\n\s*(\d+(?:\.\d+)?) mi\s*\n/g)].pop()?.[1];
    out.push({
      name: m[2]!.replace(/&amp;/g, '&').trim(),
      key,
      group,
      laps: laps ? Number(laps) : undefined,
      miles: miles ? Number(miles) : undefined,
    });
  }
  return out;
}

/** Pixels of the cyan route line in a route picture. */
async function routeShape(file: string): Promise<[number, number][]> {
  const { default: sharp } = await import('sharp');
  const { data, info } = await sharp(file)
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });
  const pts: [number, number][] = [];
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
      if (r < 120 && g > 170 && b > 190 && b - r > 90) pts.push([x, y]);
    }
  }
  const step = Math.max(1, Math.floor(pts.length / 600));
  return pts.filter((_, i) => i % step === 0);
}

/** Loads the route catalogue, downloading the list and pictures once into .cache/tracks. */
export async function loadRoutes(): Promise<Route[]> {
  fs.mkdirSync(path.join(CACHE, 'img'), { recursive: true });
  // v2: laps and distance read from the right card (the first version read the next card's).
  const cached = path.join(CACHE, 'routes-v2.json');
  const page = path.join(CACHE, 'all.html');
  let routes: Route[];
  if (fs.existsSync(cached)) routes = JSON.parse(fs.readFileSync(cached, 'utf8')) as Route[];
  else {
    if (!fs.existsSync(page)) fs.writeFileSync(page, await fetchText(LIST_URL));
    const list = parseRaceList(fs.readFileSync(page, 'utf8'));
    routes = [];
    for (const r of list) {
      const file = path.join(CACHE, 'img', `${r.key}.webp`);
      if (!fs.existsSync(file)) {
        const res = await fetch(`https://labsgg.com/images/${r.key}Track.webp`);
        if (!res.ok) continue;
        fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
        await new Promise((ok) => setTimeout(ok, 300));
      }
      routes.push({
        id: slugify(r.name),
        name: r.name,
        surface: SURFACES[r.group] ?? null,
        kind: (r.laps ?? 1) > 1 ? 'circuit' : 'sprint',
        laps: r.laps,
        key: r.key,
        miles: r.miles,
        shape: await routeShape(file),
      });
    }
    fs.writeFileSync(cached, JSON.stringify(routes));
  }
  // Routes the list does not have (data/manual/routes.yaml), recognised by name only.
  const manualFile = path.join(ROOT, 'data', 'manual', 'routes.yaml');
  const manual = fs.existsSync(manualFile)
    ? ((parse(fs.readFileSync(manualFile, 'utf8')) ?? {}) as Record<
        string,
        { name: string; surface: Surface; kind: 'sprint' | 'circuit'; laps?: number }
      >)
    : {};
  for (const [id, r] of Object.entries(manual)) {
    if (!routes.some((x) => x.id === id)) routes.push({ id, ...r });
  }
  return routes;
}

// --- recognition -------------------------------------------------------------------------------

type P = [number, number];

function normalise(pts: readonly P[]): P[] {
  const n = pts.length;
  const cx = pts.reduce((a, p) => a + p[0], 0) / n;
  const cy = pts.reduce((a, p) => a + p[1], 0) / n;
  const r = Math.sqrt(pts.reduce((a, p) => a + (p[0] - cx) ** 2 + (p[1] - cy) ** 2, 0) / n) || 1;
  return pts.map((p) => [(p[0] - cx) / r, (p[1] - cy) / r]);
}

const thin = <T>(pts: readonly T[], max: number) =>
  pts.filter((_, i) => i % Math.max(1, Math.floor(pts.length / max)) === 0);

/** Mean distance from each point of `a` to the nearest point of `b` (both normalised). */
function meanNearest(a: readonly P[], b: readonly P[]): number {
  const cell = 0.05;
  const grid = new Map<string, P[]>();
  for (const p of b) {
    const k = `${Math.round(p[0] / cell)},${Math.round(p[1] / cell)}`;
    grid.set(k, [...(grid.get(k) ?? []), p]);
  }
  let sum = 0;
  for (const p of a) {
    const gx = Math.round(p[0] / cell);
    const gy = Math.round(p[1] / cell);
    let best = Infinity;
    for (let r = 0; r < 12 && best > (r - 1) * cell; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          for (const q of grid.get(`${gx + dx},${gy + dy}`) ?? [])
            best = Math.min(best, Math.hypot(p[0] - q[0], p[1] - q[1]));
        }
      }
    }
    sum += Math.min(best, 1);
  }
  return sum / a.length;
}

/** Above this the best match is not trusted (0.03–0.14 for right matches, 0.33 for an unlisted route). */
export const MATCH_LIMIT = 0.25;

/**
 * The route a driven line belongs to, by shape. The game's map plane (x, z) is drawn on the
 * pictures with z pointing up, so z is flipped to match image rows.
 */
export function recognise(
  driven: readonly { x: number; z: number }[],
  routes: readonly Route[],
): { route?: Route; score: number; runnerUp?: { route: Route; score: number } } {
  const line = normalise(
    thin(
      driven.map((p): P => [p.x, -p.z]),
      400,
    ),
  );
  const scored = routes
    .filter((r) => r.shape?.length)
    .map((route) => {
      const ref = normalise(route.shape!);
      return { route, score: meanNearest(line, ref) + meanNearest(thin(ref, 200), line) };
    })
    .sort((a, b) => a.score - b.score);
  const [best, second] = scored;
  if (!best) return { score: Infinity };
  return {
    route: best.score <= MATCH_LIMIT ? best.route : undefined,
    score: Math.round(best.score * 1000) / 1000,
    runnerUp: second
      ? { route: second.route, score: Math.round(second.score * 1000) / 1000 }
      : undefined,
  };
}
