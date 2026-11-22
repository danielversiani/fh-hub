import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import type { Track, TrackLines, TrackScene } from '../../pipeline/schema/entities';
import { CAR_EDGE, checkpointFlags, racingLines } from './guides';

/**
 * A simplified, realistic 3D model of a measured route (ADR-0021): the road as a ribbon over the
 * measured line, with its elevation and camber, plus what the scene file says lines each stretch.
 * Not the voxel style of the background world: the goal is to recognise the place from the game.
 *
 * Coordinates: game x (east) → X, game y (up) → Y, game z (north) → −Z, so a top view with −Z up
 * shows the map as the game does.
 */

type Side = TrackScene['sections'][number]['left'];
type SectionInfo = TrackScene['sections'][number];

interface Sample {
  s: number;
  /** The middle of the road. */
  p: THREE.Vector3;
  /** Where the recorded lap ran (the driver's line, used for the chase camera). */
  line: THREE.Vector3;
  /** Direction of travel (horizontal unit vector). */
  dir: THREE.Vector3;
  /** Unit vector to the left of the direction of travel (horizontal). */
  left: THREE.Vector3;
  /** Road tilt (rad), + = left edge higher. */
  tilt: number;
  width: number;
  section: SectionInfo;
}

const COLORS = {
  asphalt: '#3a3b3d',
  concrete: '#8d8b86',
  dirt: '#8a6a45',
  gravel: '#9b9284',
  snow: '#e8eef2',
  grass: '#4f7a34',
  'dry-grass': '#8f8a4f',
  sand: '#c9b37e',
  line: '#f2f2ee',
  curbRed: '#c8302c',
  curbWhite: '#f0f0f0',
  sidewalk: '#a6a39b',
  guardrail: '#cfd2d5',
  wall: '#9a978f',
  fence: '#6f7377',
  tires: '#1d1d1f',
  trunk: '#5b4330',
  leaves: ['#3d6b2d', '#4a7a33', '#35602a', '#58833a'],
  autumn: ['#b5552a', '#c97a2c', '#8e3b22', '#d39a3a', '#6f7d34'],
  snowy: ['#dfe6ea', '#c9d3d8', '#5f7058'],
  building: ['#c9c6bf', '#b5b9be', '#d9d6cf', '#9fa4aa'],
  hangar: '#cfd3d6',
  tank: '#e6e6e2',
  water: '#3f6f8f',
  field: '#7d9a45',
  rocks: '#7a756d',
  stands: '#8c8f94',
  boards: ['#e9e4d6', '#2a63b0', '#f2f0ea', '#d9c43a', '#e9e4d6', '#2a63b0'],
  retaining: '#a39c8c',
  concreteWall: '#9a8f7e',
} as const;

function asphaltTexture(surface: TrackScene['road']['surface']): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = COLORS[surface] ?? COLORS.asphalt;
  g.fillRect(0, 0, 256, 256);
  // Fine grain, so the road does not look like plastic.
  for (let i = 0; i < 9000; i++) {
    const v = Math.random() * 40 - 20;
    g.fillStyle = `rgba(${128 + v},${128 + v},${128 + v},0.08)`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const sectionAt = (scene: TrackScene, s: number): SectionInfo =>
  [...scene.sections].reverse().find((x) => x.from <= s) ?? scene.sections[0]!;

/** A stretch's width carries on until a later stretch sets another. */
const widthAt = (scene: TrackScene, s: number): number =>
  [...scene.sections].reverse().find((x) => x.from <= s && x.width)?.width ?? scene.road.width;

/** Smooth (cosine) interpolation through `{ at, value }` points; wraps around on a circuit. */
function smoothAt(
  points: readonly { at: number; v: number }[],
  s: number,
  length: number,
  closed: boolean,
): number {
  if (points.length === 0) return 0;
  if (points.length === 1) return points[0]!.v;
  const pts = closed
    ? [
        { at: points[points.length - 1]!.at - length, v: points[points.length - 1]!.v },
        ...points,
        { at: points[0]!.at + length, v: points[0]!.v },
      ]
    : points;
  if (s <= pts[0]!.at) return pts[0]!.v;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if (s <= b.at) {
      const t = (s - a.at) / Math.max(1e-6, b.at - a.at);
      return a.v + (b.v - a.v) * ((1 - Math.cos(Math.PI * t)) / 2);
    }
  }
  return pts[pts.length - 1]!.v;
}

/** Moving average over ±`half` samples (wrapping on a circuit). */
function average(values: readonly number[], half: number, closed: boolean): number[] {
  const n = values.length;
  return values.map((_, i) => {
    let sum = 0;
    let count = 0;
    for (let k = -half; k <= half; k++) {
      let j = i + k;
      if (closed) j = (j + n) % n;
      else if (j < 0 || j >= n) continue;
      sum += values[j]!;
      count++;
    }
    return sum / count;
  });
}

/**
 * The road every `step` metres along the recorded lap. The measured line is the driver's line;
 * `scene.drivenLine` says where it ran across the road, so the road's middle is put back where it
 * is (otherwise the road bends along with the driver's line and the bends look sharper).
 */
function sampleRoad(track: Track, scene: TrackScene, step = 2): Sample[] {
  const pts = track.path.map(([x, z, y]) => new THREE.Vector3(x, y, -z));
  const closed = track.kind === 'circuit';
  const curve = new THREE.CatmullRomCurve3(pts, closed, 'centripetal');
  const length = curve.getLength();
  const n = Math.max(2, Math.round(length / step));
  const up = new THREE.Vector3(0, 1, 0);
  const drivenPts = scene.drivenLine.map((d) => ({ at: d.at, v: d.pos }));
  const raw = Array.from({ length: n + 1 }, (_, i) => {
    const u = i / n;
    const s = u * length;
    const line = curve.getPointAt(u);
    const dir = curve.getTangentAt(u).setY(0).normalize();
    const left = new THREE.Vector3().crossVectors(up, dir).normalize();
    const section = sectionAt(scene, s);
    const width = widthAt(scene, s);
    return { s, line, left, section, width, u };
  });
  // Width and the line's place across the road, both smoothed: video readings are a little noisy.
  const widths = average(
    raw.map((r) => r.width),
    5,
    closed,
  );
  const offsets = average(
    raw.map((r, i) => smoothAt(drivenPts, r.s, length, closed) * (widths[i]! / 2 - CAR_EDGE)),
    4,
    closed,
  );
  const centers = raw.map((r, i) => r.line.clone().addScaledVector(r.left, -offsets[i]!));
  return raw.map((r, i) => {
    const prev = centers[closed ? (i - 1 + raw.length) % raw.length : Math.max(0, i - 1)]!;
    const next = centers[closed ? (i + 1) % raw.length : Math.min(raw.length - 1, i + 1)]!;
    const dir = next.clone().sub(prev).setY(0).normalize();
    const left = new THREE.Vector3().crossVectors(up, dir).normalize();
    let tilt = 0;
    if (scene.camber === 'measured') {
      // Camber is stored relative to the bend (+ = into it); the bend's side comes from the line.
      const k = Math.min(track.path.length - 1, Math.round((r.u * track.lengthM) / 10));
      const camber = ((track.path[k]?.[3] ?? 0) * Math.PI) / 180;
      const ahead = curve.getTangentAt(Math.min(1, r.u + 0.002));
      const turnLeft = new THREE.Vector3().crossVectors(curve.getTangentAt(r.u), ahead).y > 0;
      tilt = turnLeft ? -camber : camber;
    }
    return {
      s: r.s,
      p: centers[i]!,
      line: r.line,
      dir,
      left,
      tilt,
      width: widths[i]!,
      section: r.section,
    };
  });
}

/** A strip along the road between two lateral offsets (m, + = left), raised by `lift`. */
function strip(
  samples: readonly Sample[],
  from: (f: Sample) => number,
  to: (f: Sample) => number,
  lift: number,
  material: THREE.Material,
  include: (f: Sample) => boolean = () => true,
  uvScale = 0.1,
): THREE.Mesh {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const at = (f: Sample, off: number) => {
    const q = f.p.clone().addScaledVector(f.left, off);
    q.y += Math.tan(f.tilt) * off + lift;
    return q;
  };
  let base = -1;
  samples.forEach((f, i) => {
    if (!include(f)) {
      base = -1;
      return;
    }
    const a = at(f, from(f));
    const b = at(f, to(f));
    const v = pos.length / 3;
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    uv.push(0, f.s * uvScale, (to(f) - from(f)) * uvScale, f.s * uvScale);
    if (base >= 0 && i > 0) idx.push(v - 2, v, v - 1, v - 1, v, v + 1);
    base = v;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, material);
  mesh.receiveShadow = true;
  return mesh;
}

/** An upright band along the road at a lateral offset, from `bottom` to `top` above the road. */
function band(
  samples: readonly Sample[],
  off: (f: Sample) => number,
  bottom: number,
  top: number,
  material: THREE.Material,
  include: (f: Sample) => boolean,
  /** Moves the bottom edge sideways (m, + = left), for a sloping bank instead of a wall. */
  spread: (f: Sample) => number = () => 0,
): THREE.Mesh {
  const pos: number[] = [];
  const idx: number[] = [];
  let open = false;
  samples.forEach((f) => {
    if (!include(f)) {
      open = false;
      return;
    }
    const q = f.p.clone().addScaledVector(f.left, off(f));
    q.y += Math.tan(f.tilt) * off(f);
    const b = q.clone().addScaledVector(f.left, spread(f));
    const v = pos.length / 3;
    pos.push(b.x, q.y + bottom, b.z, q.x, q.y + top, q.z);
    if (open) idx.push(v - 2, v, v - 1, v - 1, v, v + 1);
    open = true;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, material);
  mesh.castShadow = true;
  return mesh;
}

const mat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...extra });

/**
 * Ground that follows the road's height near it and flattens out far away. Each point takes the
 * lowest of "road height plus a gentle slope with distance" over the road nearby: it hugs every
 * stretch, so the road never seems to float, and where two stretches pass close at different
 * heights it never pokes up through the lower one.
 */
function terrain(samples: readonly Sample[], ground: TrackScene['ground']): THREE.Mesh {
  const box = new THREE.Box3();
  samples.forEach((f) => box.expandByPoint(f.p));
  box.expandByScalar(350);
  const size = box.getSize(new THREE.Vector3());
  const seg = 300;
  const g = new THREE.PlaneGeometry(size.x, size.z, seg, seg);
  g.rotateX(-Math.PI / 2);
  g.translate((box.min.x + box.max.x) / 2, 0, (box.min.z + box.max.z) / 2);
  const avg = samples.reduce((a, f) => a + f.p.y, 0) / samples.length;
  const pos = g.attributes.position as THREE.BufferAttribute;
  // Road points in 50 m cells, for quick lookups.
  const cell = 50;
  const cells = new Map<string, Sample[]>();
  samples
    .filter((_, i) => i % 3 === 0)
    .forEach((f) => {
      const key = `${Math.floor(f.p.x / cell)},${Math.floor(f.p.z / cell)}`;
      cells.set(key, [...(cells.get(key) ?? []), f]);
    });
  const thin = samples.filter((_, i) => i % 6 === 0);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const cx = Math.floor(x / cell);
    const cz = Math.floor(z / cell);
    let low = Infinity;
    let nearest = Infinity;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        for (const f of cells.get(`${cx + dx},${cz + dz}`) ?? []) {
          const d = Math.hypot(f.p.x - x, f.p.z - z);
          // Hug every piece of road close by, and between pieces at different heights rise or
          // fall in a gentle slope: the ground stays under each one without dropping away.
          low = Math.min(low, f.p.y + 0.35 * Math.max(0, d - f.width / 2 - 3));
          nearest = Math.min(nearest, d);
        }
      }
    }
    if (!Number.isFinite(low)) {
      // Far from the road: the nearest road height, fading to the average.
      let best = Infinity;
      for (const f of thin) {
        const d = Math.hypot(f.p.x - x, f.p.z - z);
        if (d < best) {
          best = d;
          low = f.p.y;
        }
      }
      nearest = best;
    }
    const w = Math.min(1, Math.max(0, (nearest - 30) / 250));
    pos.setY(i, (low - 0.6) * (1 - w) + (avg - 0.6) * w);
  }
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, mat(COLORS[ground] ?? COLORS.grass));
  mesh.receiveShadow = true;
  return mesh;
}

/** Simple seeded random, so the scenery is the same on every visit. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Barriers and scenery along each side, as instanced meshes. */
function dressing(
  samples: readonly Sample[],
  root: THREE.Group,
  foliage: TrackScene['foliage'],
  ground: TrackScene['ground'],
  seed = 7,
) {
  const paved = asphaltTexture('asphalt');
  const leaves =
    foliage === 'autumn' ? COLORS.autumn : foliage === 'snow' ? COLORS.snowy : COLORS.leaves;
  const rand = rng(seed);
  const trees: THREE.Matrix4[] = [];
  const crowns: { m: THREE.Matrix4; c: THREE.Color }[] = [];
  const blocks: { m: THREE.Matrix4; c: THREE.Color }[] = [];
  const tanks: THREE.Matrix4[] = [];
  const posts: THREE.Matrix4[] = [];
  const poles: THREE.Matrix4[] = [];
  const banners: THREE.Matrix4[] = [];
  const cones: THREE.Matrix4[] = [];
  const placeAt = (f: Sample, off: number) => {
    const q = f.p.clone().addScaledVector(f.left, off);
    q.y = f.p.y - 0.3;
    return q;
  };
  // Local X across the road (to the left), local Z along it.
  const yaw = (f: Sample) => Math.atan2(-f.left.z, f.left.x);
  const chevronsL: THREE.Matrix4[] = [];
  const chevronsR: THREE.Matrix4[] = [];
  const tents: THREE.Matrix4[] = [];
  const stands: THREE.Matrix4[] = [];
  const walls: THREE.Matrix4[] = [];
  const up = new THREE.Vector3(0, 1, 0);

  for (const [sideName, sign] of [
    ['left', 1],
    ['right', -1],
  ] as const) {
    const sideOf = (f: Sample): Side => f.section[sideName];
    const edge = (f: Sample) => sign * (f.width / 2);
    /** The strip right beyond the road's edge (grass, run-off, sidewalk…), as wide as given. */
    const shoulderOf = (f: Sample) => sideOf(f).edgeWidth ?? (sideOf(f).edge === 'paved' ? 6 : 2);
    // Shoulder and curbs.
    for (const kind of ['grass', 'gravel', 'sand', 'sidewalk', 'dirt', 'snow', 'paved'] as const) {
      root.add(
        strip(
          samples,
          (f) => edge(f),
          (f) => edge(f) + sign * shoulderOf(f),
          -0.02,
          kind === 'paved'
            ? new THREE.MeshStandardMaterial({ map: paved, roughness: 0.95 })
            : mat(kind === 'sidewalk' ? COLORS.sidewalk : (COLORS[kind] ?? COLORS.grass)),
          (f) => sideOf(f).edge === kind,
        ),
      );
    }
    // A bank sloping down from the outer end of the shoulder into the ground, so no gap ever
    // shows under the road and it catches the light like the ground does.
    root.add(
      band(
        samples,
        (f) => edge(f) + sign * shoulderOf(f),
        -4,
        -0.02,
        mat(COLORS[ground] ?? COLORS.grass, { side: THREE.DoubleSide }),
        () => true,
        () => sign * 8,
      ),
    );
    const curbMat = new THREE.MeshStandardMaterial({ roughness: 0.7, vertexColors: false });
    curbMat.map = (() => {
      const c = document.createElement('canvas');
      c.width = 4;
      c.height = 2;
      const g = c.getContext('2d')!;
      g.fillStyle = COLORS.curbRed;
      g.fillRect(0, 0, 4, 1);
      g.fillStyle = COLORS.curbWhite;
      g.fillRect(0, 1, 4, 1);
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.magFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    root.add(
      strip(
        samples,
        (f) => edge(f),
        (f) => edge(f) + sign * 1.2,
        0.04,
        curbMat,
        (f) => sideOf(f).edge === 'curb',
        0.25,
      ),
    );

    // Barriers.
    const barrierOff = (f: Sample) => edge(f) + sign * (shoulderOf(f) + 0.4);
    root.add(
      band(
        samples,
        barrierOff,
        0.45,
        0.8,
        mat(COLORS.guardrail, { metalness: 0.2, roughness: 0.5, side: THREE.DoubleSide }),
        (f) => sideOf(f).barrier === 'guardrail',
      ),
    );
    for (const f of samples) {
      const b = sideOf(f).barrier;
      if (b === 'guardrail' && Math.round(f.s) % 4 === 0) {
        posts.push(
          new THREE.Matrix4().compose(
            placeAt(f, barrierOff(f)).setY(f.p.y + 0.35),
            new THREE.Quaternion(),
            new THREE.Vector3(0.12, 0.9, 0.12),
          ),
        );
      }
      if (
        (b === 'wall' || b === 'tires' || b === 'fence' || b === 'boards') &&
        Math.round(f.s) % 2 === 0
      ) {
        const h = b === 'wall' ? 1.1 : b === 'fence' ? 2.5 : b === 'boards' ? 1.2 : 0.7;
        const color = new THREE.Color(
          b === 'wall'
            ? COLORS.wall
            : b === 'fence'
              ? COLORS.fence
              : b === 'boards'
                ? COLORS.boards[Math.floor(f.s / 8) % COLORS.boards.length]!
                : COLORS.tires,
        );
        blocks.push({
          m: new THREE.Matrix4().compose(
            placeAt(f, barrierOff(f)).setY(f.p.y + h / 2 - 0.1),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw(f)),
            new THREE.Vector3(b === 'fence' ? 0.08 : 0.5, h, 2.1),
          ),
          c: color,
        });
      }
    }

    // Scenery bands.
    let last: Record<string, number> = {};
    for (const f of samples) {
      for (const item of sideOf(f).scenery) {
        const spacing =
          item.type === 'trees'
            ? 9
            : item.type === 'lights'
              ? 40
              : item.type === 'tanks'
                ? 45
                : item.type === 'chevrons'
                  ? 5
                  : item.type === 'cones'
                    ? 10
                    : item.type === 'retaining-wall' || item.type === 'concrete-wall'
                      ? 2
                      : item.type === 'tents'
                        ? 14
                        : item.type === 'stands'
                          ? 22
                          : 30;
        const every = spacing / Math.max(0.05, item.density);
        const key = `${sideName}-${item.type}`;
        if (f.s - (last[key] ?? -Infinity) < every) continue;
        last = { ...last, [key]: f.s };
        const jitter =
          item.type === 'trees'
            ? 25
            : item.type === 'chevrons' ||
                item.type === 'retaining-wall' ||
                item.type === 'concrete-wall' ||
                item.type === 'stands' ||
                item.type === 'cones'
              ? 0
              : 10;
        const off = edge(f) + sign * (shoulderOf(f) + item.offset + rand() * jitter);
        const q = placeAt(f, off);
        if (item.type === 'trees') {
          const h = (item.height ?? 9) * (0.7 + rand() * 0.6);
          trees.push(
            new THREE.Matrix4().compose(
              q.clone().setY(q.y + h * 0.2),
              new THREE.Quaternion(),
              new THREE.Vector3(0.35, h * 0.4, 0.35),
            ),
          );
          crowns.push({
            m: new THREE.Matrix4().compose(
              q.clone().setY(q.y + h * 0.62),
              new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6),
              new THREE.Vector3(h * 0.32, h * 0.6, h * 0.32),
            ),
            c: new THREE.Color(leaves[Math.floor(rand() * leaves.length)]!),
          });
        } else if (item.type === 'stands') {
          // A raked stand rising away from the road, full of people.
          const h = item.height ?? 8;
          stands.push(
            new THREE.Matrix4().compose(
              q.clone(),
              new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(0, 1, 0),
                yaw(f) + (sign > 0 ? 0 : Math.PI),
              ),
              new THREE.Vector3(h * 1.4, h, 24),
            ),
          );
        } else if (item.type === 'buildings' || item.type === 'hangars') {
          const h = item.height ?? (item.type === 'hangars' ? 14 : 10 + rand() * 25);
          const w = item.type === 'hangars' ? 45 : 14 + rand() * 20;
          const d = item.type === 'hangars' ? 35 : 12 + rand() * 18;
          blocks.push({
            m: new THREE.Matrix4().compose(
              q
                .clone()
                .addScaledVector(f.left, sign * (d / 2))
                .setY(q.y + h / 2),
              new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw(f)),
              new THREE.Vector3(d, h, w),
            ),
            c: new THREE.Color(
              item.type === 'hangars'
                ? COLORS.hangar
                : COLORS.building[Math.floor(rand() * COLORS.building.length)]!,
            ),
          });
        } else if (item.type === 'tanks') {
          const r = (item.height ?? 18) * 0.9;
          tanks.push(
            new THREE.Matrix4().compose(
              q
                .clone()
                .addScaledVector(f.left, sign * r)
                .setY(q.y + (item.height ?? 18) / 2),
              new THREE.Quaternion(),
              new THREE.Vector3(r, item.height ?? 18, r),
            ),
          );
        } else if (item.type === 'chevrons') {
          // Facing the driver, pointing across the road (they stand on the outside of a bend).
          (sign > 0 ? chevronsL : chevronsR).push(
            new THREE.Matrix4().compose(
              q.clone().setY(f.p.y + 2.4),
              new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw(f) + Math.PI),
              new THREE.Vector3(1, 1, 1),
            ),
          );
        } else if (item.type === 'retaining-wall') {
          // A crib wall leaning back from the road, like the game's diamond-pattern embankments.
          const h = item.height ?? 8;
          const lean = 0.45;
          // Far out on the outside of a bend the wall runs longer than the road: stretch each
          // piece to reach the next one, so it stays continuous.
          const i = samples.indexOf(f);
          const n = samples[Math.min(samples.length - 1, i + 1)]!;
          const span = placeAt(n, edge(n) + sign * (shoulderOf(n) + item.offset)).distanceTo(q);
          walls.push(
            new THREE.Matrix4().compose(
              q
                .clone()
                .addScaledVector(f.left, sign * (0.3 + (Math.sin(lean) * h) / 2))
                .setY(q.y + (Math.cos(lean) * h) / 2),
              new THREE.Quaternion()
                .setFromAxisAngle(up, yaw(f))
                .multiply(
                  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -sign * lean),
                ),
              new THREE.Vector3(0.6, h, Math.max(2.3, span * 1.15)),
            ),
          );
        } else if (item.type === 'concrete-wall') {
          // A plain upright wall, like the sides of a cutting.
          const h = item.height ?? 6;
          blocks.push({
            m: new THREE.Matrix4().compose(
              q
                .clone()
                .addScaledVector(f.left, sign * 0.4)
                .setY(q.y + h / 2),
              new THREE.Quaternion().setFromAxisAngle(up, yaw(f)),
              new THREE.Vector3(0.8, h, 2.2),
            ),
            c: new THREE.Color(COLORS.concreteWall),
          });
        } else if (item.type === 'tents') {
          const h = item.height ?? 5;
          tents.push(
            new THREE.Matrix4().compose(
              q
                .clone()
                .addScaledVector(f.left, sign * 4)
                .setY(q.y + h / 2),
              new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(0, 1, 0),
                yaw(f) + Math.PI / 4,
              ),
              new THREE.Vector3(5, h, 5),
            ),
          );
        } else if (item.type === 'banners') {
          // The Festival's tall blue feather flags with the "H".
          banners.push(
            new THREE.Matrix4().compose(
              q.clone().setY(q.y + 2.4),
              new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(0, 1, 0),
                yaw(f) + Math.PI + (rand() - 0.5) * 0.6,
              ),
              new THREE.Vector3(1, 1, 1),
            ),
          );
        } else if (item.type === 'cones') {
          // Traffic cones along the verge (offset counted from the road's edge, not the strip).
          cones.push(
            new THREE.Matrix4().compose(
              placeAt(f, edge(f) + sign * (0.8 + item.offset)).setY(f.p.y + 0.05),
              new THREE.Quaternion(),
              new THREE.Vector3(1, 1, 1),
            ),
          );
        } else if (item.type === 'lights') {
          poles.push(
            new THREE.Matrix4().compose(
              q.clone().setY(q.y + 6),
              new THREE.Quaternion(),
              new THREE.Vector3(0.18, 12, 0.18),
            ),
          );
        }
      }
    }
    // Water, fields and rocks: flat bands.
    for (const kind of ['water', 'field', 'rocks'] as const) {
      const off = (f: Sample) => sideOf(f).scenery.find((x) => x.type === kind)?.offset ?? 0;
      root.add(
        strip(
          samples,
          (f) => edge(f) + sign * (shoulderOf(f) + off(f)),
          (f) => edge(f) + sign * (shoulderOf(f) + off(f) + 120),
          kind === 'water' ? -0.6 : -0.15,
          mat(COLORS[kind], kind === 'water' ? { roughness: 0.15, metalness: 0.1 } : {}),
          (f) => sideOf(f).scenery.some((x) => x.type === kind),
        ),
      );
    }
  }

  const instanced = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    list: { m: THREE.Matrix4; c?: THREE.Color }[],
  ) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(geometry, material, list.length);
    list.forEach((x, i) => {
      mesh.setMatrixAt(i, x.m);
      if (x.c) mesh.setColorAt(i, x.c);
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  };
  instanced(
    new THREE.CylinderGeometry(1, 1, 1, 6),
    mat(COLORS.trunk),
    trees.map((m) => ({ m })),
  );
  instanced(new THREE.ConeGeometry(1, 1, 7), mat('#ffffff'), crowns);
  instanced(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({
      map: cribTexture(),
      color: COLORS.retaining,
      roughness: 0.95,
    }),
    walls.map((m) => ({ m })),
  );
  instanced(new THREE.BoxGeometry(1, 1, 1), mat('#ffffff', { roughness: 0.8 }), blocks);
  instanced(
    new THREE.CylinderGeometry(1, 1, 1, 24),
    mat(COLORS.tank, { roughness: 0.5, metalness: 0.2 }),
    tanks.map((m) => ({ m })),
  );
  instanced(
    new THREE.BoxGeometry(1, 1, 1),
    mat(COLORS.guardrail, { metalness: 0.5 }),
    posts.map((m) => ({ m })),
  );
  instanced(
    new THREE.CylinderGeometry(1, 1, 1, 6),
    mat('#8a8d90', { metalness: 0.5 }),
    poles.map((m) => ({ m })),
  );
  instanced(
    new THREE.ConeGeometry(1, 1, 4),
    mat('#f4f4f2', { roughness: 0.7 }),
    tents.map((m) => ({ m })),
  );
  instanced(
    new THREE.PlaneGeometry(1.1, 4.4),
    new THREE.MeshStandardMaterial({
      map: bannerTexture(),
      side: THREE.DoubleSide,
      roughness: 0.7,
    }),
    banners.map((m) => ({ m })),
  );
  instanced(
    standGeometry(),
    new THREE.MeshStandardMaterial({ map: crowdTexture(), roughness: 0.9 }),
    stands.map((m) => ({ m })),
  );
  instanced(
    new THREE.ConeGeometry(0.2, 0.7, 10).translate(0, 0.35, 0),
    mat('#ff6a1a', { roughness: 0.6 }),
    cones.map((m) => ({ m })),
  );
  // The game's chevron boards are big and stand on posts (scenery video, 2026-11-15).
  const sign = new THREE.PlaneGeometry(3.4, 2);
  instanced(
    sign,
    new THREE.MeshStandardMaterial({
      map: chevronTexture('right'),
      side: THREE.DoubleSide,
      roughness: 0.6,
    }),
    chevronsL.map((m) => ({ m })),
  );
  instanced(
    sign,
    new THREE.MeshStandardMaterial({
      map: chevronTexture('left'),
      side: THREE.DoubleSide,
      roughness: 0.6,
    }),
    chevronsR.map((m) => ({ m })),
  );
}

/** Blue Festival flag with a lime "H". */
function bannerTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1f63b8';
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(64, 18);
  g.lineTo(64, 256);
  g.lineTo(0, 256);
  g.closePath();
  g.fill();
  g.fillStyle = '#c8f02a';
  g.font = 'bold 54px sans-serif';
  g.textAlign = 'center';
  g.fillText('H', 32, 92);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A unit stand: a wedge rising from x = 0 (by the road) to x = 1, 1 high, z from −0.5 to 0.5. */
function standGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(1, 0);
  shape.lineTo(1, 1);
  shape.lineTo(0, 0.12);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
  g.translate(0, 0, -0.5);
  // Seats and people repeat along the stand.
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.5, uv.getY(i) * 2.5);
  return g;
}

/** Diamond lattice of a crib retaining wall (tinted by the material colour). */
function cribTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d8d4cc';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#8f8a80';
  g.lineWidth = 7;
  for (let k = -128; k <= 256; k += 32) {
    g.beginPath();
    g.moveTo(k, 0);
    g.lineTo(k + 128, 128);
    g.moveTo(k, 128);
    g.lineTo(k + 128, 0);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Rows of seats with spectators in many colours. */
function crowdTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#5b6066';
  g.fillRect(0, 0, 256, 256);
  const rand = rng(11);
  const shirts = ['#d8d8d8', '#2b2b2b', '#c0392b', '#2e6db4', '#e0a12a', '#f1f1f1', '#3a3d42'];
  for (let row = 0; row < 256; row += 16) {
    g.fillStyle = '#3f444a';
    g.fillRect(0, row + 12, 256, 4);
    for (let x = 0; x < 256; x += 9) {
      if (rand() < 0.3) continue;
      g.fillStyle = shirts[Math.floor(rand() * shirts.length)]!;
      g.fillRect(x + 1, row + 5, 7, 8);
      g.fillStyle = '#d9b08c';
      g.fillRect(x + 3, row + 1, 4, 4);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Yellow-and-black chevron board pointing to one side. */
function chevronTexture(dir: 'left' | 'right'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#121212';
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = '#f2b705';
  for (const x of [8, 48, 88]) {
    g.beginPath();
    if (dir === 'right') {
      g.moveTo(x, 6);
      g.lineTo(x + 18, 6);
      g.lineTo(x + 34, 32);
      g.lineTo(x + 18, 58);
      g.lineTo(x, 58);
      g.lineTo(x + 16, 32);
    } else {
      g.moveTo(x + 34, 6);
      g.lineTo(x + 16, 6);
      g.lineTo(x, 32);
      g.lineTo(x + 16, 58);
      g.lineTo(x + 34, 58);
      g.lineTo(x + 18, 32);
    }
    g.closePath();
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Something that spans the road (built in road space: X across, Z along): the Festival arch, an
 * overpass the road runs under, a steel footbridge.
 */
function spanning(
  type: 'arch' | 'overpass' | 'truss',
  width: number,
  length: number,
): THREE.Object3D {
  const g = new THREE.Group();
  const span = width + 8;
  if (type === 'overpass') {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(span + 30, 2.2, length), mat('#8e8a83'));
    deck.position.y = 7.2;
    g.add(deck);
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 7, length), mat('#7f7b74'));
      wall.position.set((side * (span + 2)) / 2, 3.5, 0);
      g.add(wall);
    }
  } else if (type === 'truss') {
    const steel = mat('#5d6166', { metalness: 0.6, roughness: 0.5 });
    for (const y of [6.5, 8.5]) {
      for (const z of [-1, 1]) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(span + 10, 0.35, 0.35), steel);
        beam.position.set(0, y, z * 1.2);
        g.add(beam);
      }
    }
    for (let x = -span / 2 - 5; x <= span / 2 + 5; x += 3) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2, 2.4), steel);
      post.position.set(x, 7.5, 0);
      g.add(post);
    }
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8.5, 0.8), steel);
      leg.position.set((side * (span + 10)) / 2, 4.25, 0);
      g.add(leg);
    }
  } else {
    const pink = mat('#e0218a', { roughness: 0.6 });
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.4, 9, 1.4), mat('#e8e8e4'));
      leg.position.set((side * span) / 2, 4.5, 0);
      g.add(leg);
    }
    const banner = new THREE.Mesh(new THREE.BoxGeometry(span + 1.4, 2.4, 0.6), pink);
    banner.position.y = 8.4;
    g.add(banner);
  }
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
  });
  return g;
}

function landmark(type: TrackScene['landmarks'][number]['type'], size: number): THREE.Object3D {
  const g = new THREE.Group();
  const white = mat('#ecebe7', { roughness: 0.6 });
  if (type === 'sphere') {
    // A spherical gas holder on legs.
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(size / 2, 32, 20),
      mat('#e9e7e1', { roughness: 0.45, metalness: 0.2 }),
    );
    ball.position.y = size * 0.75;
    g.add(ball);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(size * 0.02, size * 0.02, size * 0.6, 6),
        mat('#9c9a93', { metalness: 0.5 }),
      );
      leg.position.set(Math.cos(a) * size * 0.4, size * 0.3, Math.sin(a) * size * 0.4);
      g.add(leg);
    }
  } else if (type === 'rocket') {
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(size * 0.06, size * 0.06, size, 20),
      white,
    );
    body.position.y = size / 2;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(size * 0.06, size * 0.15, 20), white);
    nose.position.y = size + size * 0.075;
    g.add(body, nose);
    for (const dx of [-1, 1]) {
      const booster = new THREE.Mesh(
        new THREE.CylinderGeometry(size * 0.035, size * 0.035, size * 0.5, 16),
        white,
      );
      booster.position.set(dx * size * 0.1, size * 0.25, 0);
      g.add(booster);
    }
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(size * 0.12, size * 1.1, size * 0.12),
      mat('#b44a2c'),
    );
    tower.position.set(0, size * 0.55, size * 0.18);
    g.add(tower);
  } else if (type === 'tower' || type === 'gantry') {
    // A lattice tower: four legs narrowing to the top, with cross bracing and platforms.
    const steel = mat('#a4a8ad', { metalness: 0.5, roughness: 0.5 });
    const base = size * 0.18;
    const top = size * 0.05;
    for (const [dx, dz] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const) {
      const from = new THREE.Vector3(dx * base, 0, dz * base);
      const to = new THREE.Vector3(dx * top, size, dz * top);
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.35, from.distanceTo(to), 6),
        steel,
      );
      leg.position.copy(from).lerp(to, 0.5);
      leg.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        to.clone().sub(from).normalize(),
      );
      g.add(leg);
    }
    for (let k = 1; k <= 6; k++) {
      const y = (k / 7) * size;
      const w = (base + (top - base) * (k / 7)) * 2;
      const ring = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, w), steel);
      ring.position.y = y;
      g.add(ring);
    }
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(top * 4, size * 0.05, top * 4), steel);
    cabin.position.y = size * 0.72;
    g.add(cabin);
  } else if (type === 'dome') {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(size / 2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      white,
    );
    g.add(m);
  } else if (type === 'tank') {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(size / 2, size / 2, size * 0.6, 32), white);
    m.position.y = size * 0.3;
    g.add(m);
  } else {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(size, size * 0.6, size * 0.8),
      mat(COLORS.building[0]),
    );
    m.position.y = size * 0.3;
    g.add(m);
  }
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
  });
  return g;
}

const paintMaterial = (color: string) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.6,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });

/** Paint on the road: centre lines, zebra crossings, coloured blocks and painted words. */
function paint(samples: readonly Sample[], scene: TrackScene, root: THREE.Group) {
  for (const m of scene.markings) {
    const within = (f: Sample) => f.s >= m.from && f.s <= m.to;
    const material = paintMaterial(
      m.color ?? (m.type === 'center-yellow' ? '#e8b520' : COLORS.line),
    );
    if (m.type === 'center-dashed') {
      root.add(
        strip(
          samples,
          () => -0.08,
          () => 0.08,
          0.02,
          material,
          (f) => within(f) && (f.s - m.from) % 9 < 3,
        ),
      );
    } else if (m.type === 'center-solid' || m.type === 'center-yellow') {
      root.add(
        strip(
          samples,
          () => -0.08,
          () => 0.08,
          0.02,
          material,
          within,
        ),
      );
    } else if (m.type === 'crosswalk') {
      // Zebra bars, parallel to the traffic, across the whole width.
      for (let k = 0; k < 40; k++) {
        const off = (f: Sample) => -f.width / 2 + 1 + k * 1.1;
        root.add(
          strip(
            samples,
            off,
            (f) => off(f) + 0.55,
            0.02,
            material,
            (f) => within(f) && off(f) + 0.55 < f.width / 2 - 1,
          ),
        );
      }
    } else if (m.type === 'block') {
      const half = (m.width ?? 3) / 2;
      root.add(
        strip(
          samples,
          (f) => (m.pos * f.width) / 2 - half,
          (f) => (m.pos * f.width) / 2 + half,
          0.02,
          material,
          within,
        ),
      );
    } else if (m.type === 'text' && m.text) {
      root.add(
        textDecal(samples, m.from, m.to, m.pos, m.width ?? 8, m.text, m.color ?? COLORS.line),
      );
    }
  }
}

/** Painted letters lying on the road, read from the driver's side. */
function textDecal(
  samples: readonly Sample[],
  from: number,
  to: number,
  pos: number,
  width: number,
  text: string,
  color: string,
): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 1024;
  const g = c.getContext('2d')!;
  g.translate(128, 512);
  g.rotate(-Math.PI / 2);
  g.font = 'bold 150px "Barlow Condensed", sans-serif';
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 0, 0, 980);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const pos3: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const span = samples.filter((f) => f.s >= from && f.s <= to);
  span.forEach((f, i) => {
    const mid = (pos * f.width) / 2;
    const a = f.p.clone().addScaledVector(f.left, mid + width / 2);
    const b = f.p.clone().addScaledVector(f.left, mid - width / 2);
    a.y += 0.03;
    b.y += 0.03;
    pos3.push(a.x, a.y, a.z, b.x, b.y, b.z);
    const v = span.length > 1 ? i / (span.length - 1) : 0;
    uv.push(0, v, 1, v);
    if (i > 0) idx.push(i * 2 - 2, i * 2, i * 2 - 1, i * 2 - 1, i * 2, i * 2 + 1);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos3, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      map,
      transparent: true,
      roughness: 0.6,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -3,
    }),
  );
  mesh.receiveShadow = true;
  return mesh;
}

/** A plain sports car (no brand) for scale in the chase view. */
function carModel(): THREE.Group {
  const g = new THREE.Group();
  const paintMat = mat('#c4c7cb', { roughness: 0.35, metalness: 0.6 });
  const dark = mat('#16181b', { roughness: 0.3, metalness: 0.4 });
  const accent = mat('#caff02', { roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.6), paintMat);
  body.position.y = 0.55;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.48, 2.1), dark);
  cabin.position.set(0, 1.1, -0.15);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.06, 0.38), accent);
  wing.position.set(0, 1.3, -2.15);
  g.add(body, cabin, wing);
  for (const x of [-0.6, 0.6]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.12), dark);
    post.position.set(x, 1.05, -2.15);
    g.add(post);
  }
  for (const [x, z] of [
    [-0.82, 1.4],
    [0.82, 1.4],
    [-0.82, -1.4],
    [0.82, -1.4],
  ] as const) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.3, 16), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.34, z);
    g.add(wheel);
  }
  for (const x of [-0.6, 0.6]) {
    const light = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.12, 0.05),
      mat('#d2232a', { emissive: '#7a0a0a' }),
    );
    light.position.set(x, 0.72, -2.31);
    g.add(light);
  }
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return g;
}

/** Numbered marker over each turn. */
function turnLabel(n: number): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#caff02';
  g.beginPath();
  g.arc(64, 64, 56, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#0d0d0d';
  g.font = 'bold 60px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(`T${n}`, 64, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
  sprite.scale.set(16, 16, 1);
  return sprite;
}

export interface TrackView {
  /** 'orbit' = free view; 'drive' = camera on the road at `distance` (m). */
  setMode(mode: 'orbit' | 'drive'): void;
  setDistance(m: number): void;
  /** Shows or hides one racing line (with its marks and notes). */
  setLine(id: string, visible: boolean): void;
  length: number;
  destroy(): void;
}

export function mountTrack(
  canvas: HTMLCanvasElement,
  track: Track,
  scene: TrackScene,
  guide: TrackLines | undefined,
  lang: 'pt-br' | 'en',
): TrackView {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const world = new THREE.Scene();
  world.background = new THREE.Color('#b9d3e6');
  world.fog = new THREE.Fog('#b9d3e6', 600, 2600);

  const samples = sampleRoad(track, scene);
  const center = new THREE.Box3()
    .setFromPoints(samples.map((f) => f.p))
    .getCenter(new THREE.Vector3());
  const root = new THREE.Group();
  root.position.set(-center.x, -center.y, -center.z);
  world.add(root);

  // Road, lines, ground, scenery.
  const surface = asphaltTexture(scene.road.surface);
  const road = strip(
    samples,
    (f) => -f.width / 2,
    (f) => f.width / 2,
    0,
    new THREE.MeshStandardMaterial({ map: surface, roughness: 0.95 }),
    undefined,
    0.08,
  );
  root.add(road);
  const lineMat = mat(COLORS.line, { roughness: 0.6 });
  if (scene.road.edgeLines) {
    root.add(
      strip(
        samples,
        (f) => f.width / 2 - 0.5,
        (f) => f.width / 2 - 0.3,
        0.02,
        lineMat,
      ),
    );
    root.add(
      strip(
        samples,
        (f) => -f.width / 2 + 0.3,
        (f) => -f.width / 2 + 0.5,
        0.02,
        lineMat,
      ),
    );
  }
  if (scene.road.centerLine !== 'none') {
    const dashed = scene.road.centerLine === 'dashed';
    root.add(
      strip(
        samples,
        () => -0.1,
        () => 0.1,
        0.02,
        lineMat,
        (f) => !dashed || Math.floor(f.s / 6) % 2 === 0,
      ),
    );
  }
  const ground = terrain(samples, scene.ground);
  root.add(ground);
  paint(samples, scene, root);
  dressing(samples, root, scene.foliage, scene.ground);
  for (const l of scene.landmarks) {
    const f = samples.reduce((a, b) => (Math.abs(b.s - l.at) < Math.abs(a.s - l.at) ? b : a));
    if (l.type === 'arch' || l.type === 'overpass' || l.type === 'truss') {
      const obj = spanning(l.type, f.width, l.length ?? 8);
      obj.position.copy(f.p).setY(f.p.y - 0.1);
      obj.rotation.y = Math.atan2(-f.left.z, f.left.x);
      root.add(obj);
      continue;
    }
    const obj = landmark(l.type, l.size);
    obj.position
      .copy(f.p)
      .addScaledVector(f.left, (l.side === 'left' ? 1 : -1) * (f.width / 2 + l.offset));
    obj.position.y = f.p.y - 0.3;
    root.add(obj);
  }
  checkpointFlags(samples, scene.checkpoints, root);
  const lineGroups = guide
    ? racingLines(samples, guide, samples[samples.length - 1]!.s, root, lang)
    : new Map<string, THREE.Group>();
  const turnLabels: THREE.Sprite[] = [];
  for (const t of track.turns) {
    const f = samples.reduce((a, b) =>
      Math.abs(b.s - (t.startM + t.endM) / 2) < Math.abs(a.s - (t.startM + t.endM) / 2) ? b : a,
    );
    const label = turnLabel(t.n);
    label.position.copy(f.p).setY(f.p.y + 18);
    turnLabels.push(label);
    root.add(label);
  }
  // Start / finish line.
  const start = samples[0]!;
  const gate = new THREE.Mesh(new THREE.BoxGeometry(start.width + 4, 0.6, 0.6), mat('#caff02'));
  gate.position.copy(start.p).setY(start.p.y + 7);
  gate.rotation.y = Math.atan2(-start.left.z, start.left.x);
  if (!scene.landmarks.some((l) => l.type === 'arch' && l.at < 20)) root.add(gate);

  // Light: a high sun with soft shadows over the whole route.
  world.add(new THREE.HemisphereLight('#dbe8f5', '#4d5a3a', 0.9));
  const sun = new THREE.DirectionalLight('#fff4e0', 2.2);
  const radius =
    new THREE.Box3()
      .setFromPoints(samples.map((f) => f.p))
      .getSize(new THREE.Vector3())
      .length() /
      2 +
    100;
  sun.position.set(radius * 0.5, radius, radius * 0.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, {
    left: -radius,
    right: radius,
    top: radius,
    bottom: -radius,
    near: 1,
    far: radius * 4,
  });
  sun.shadow.bias = -0.0005;
  world.add(sun);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 8000);
  camera.position.set(radius * 0.6, radius * 0.7, radius * 0.9);
  // Free view, like a map: drag to move over the ground, right button (or Ctrl / Shift + drag)
  // to turn and tilt, wheel to zoom towards the pointer, arrow keys once the view has focus.
  const controls = new MapControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.zoomToCursor = true;
  controls.zoomSpeed = 1.6;
  controls.minDistance = 6;
  controls.maxDistance = radius * 3;
  controls.maxPolarAngle = Math.PI / 2.1;
  controls.keyPanSpeed = 25;
  canvas.tabIndex = 0;
  canvas.style.outline = 'none';
  controls.listenToKeyEvents(canvas);

  let mode: 'orbit' | 'drive' = 'orbit';
  let distance = 0;
  const length = samples[samples.length - 1]!.s;
  const closed = track.kind === 'circuit';
  const last = samples.length - 1;
  /**
   * The driven line at `m` metres, interpolated between samples so the car and the camera glide
   * instead of hopping from one sample to the next; on a sprint it carries on straight beyond
   * either end.
   */
  const lineAt = (m: number) => {
    if (!closed && (m < 0 || m > length)) {
      const end = m < 0 ? samples[0]! : samples[last]!;
      return end.line.clone().addScaledVector(end.dir, m < 0 ? m : m - length);
    }
    const at = closed ? ((m % length) + length) % length : m;
    const k = (at / length) * last;
    const i = Math.min(last - 1, Math.floor(k));
    return samples[i]!.line.clone().lerp(samples[i + 1]!.line, k - i);
  };

  /** Free view: 50° vertical. Driving: the game's ~67° horizontal, whatever the page's shape. */
  const fitFov = () => {
    camera.fov =
      mode === 'drive'
        ? (2 * Math.atan(Math.tan((67 * Math.PI) / 360) / camera.aspect) * 180) / Math.PI
        : 50;
    camera.updateProjectionMatrix();
  };
  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    fitFov();
  };
  const car = carModel();
  car.visible = false;
  world.add(car);
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  // Double-click (or double-tap) in the free view: glide over to that spot of the ground.
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  let flight:
    | { target: [THREE.Vector3, THREE.Vector3]; camera: [THREE.Vector3, THREE.Vector3]; t: number }
    | undefined;
  const onDoubleClick = (e: MouseEvent) => {
    if (mode !== 'orbit') return;
    const r = canvas.getBoundingClientRect();
    pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([road, ground], false)[0];
    if (!hit) return;
    const offset = camera.position.clone().sub(controls.target);
    offset.setLength(Math.min(offset.length(), 70));
    flight = {
      target: [controls.target.clone(), hit.point.clone()],
      camera: [camera.position.clone(), hit.point.clone().add(offset)],
      t: 0,
    };
  };
  canvas.addEventListener('dblclick', onDoubleClick);
  // Grabbing the view stops a glide on its way.
  controls.addEventListener('start', () => (flight = undefined));

  let raf = 0;
  let then = performance.now();
  const tick = () => {
    raf = requestAnimationFrame(tick);
    const now = performance.now();
    const dt = Math.min(0.1, (now - then) / 1000);
    then = now;
    if (mode === 'drive') drivePose();
    else {
      if (flight) {
        flight.t = Math.min(1, flight.t + dt / 0.7);
        const k = flight.t * flight.t * (3 - 2 * flight.t);
        controls.target.lerpVectors(flight.target[0], flight.target[1], k);
        camera.position.lerpVectors(flight.camera[0], flight.camera[1], k);
        if (flight.t >= 1) flight = undefined;
      }
      controls.update();
    }
    renderer.render(world, camera);
  };
  /**
   * The game's chase camera (measured on the reference video): about 2 m up and 6.3 m behind the
   * car's tail, looking a little ahead, with ~67° of horizontal view.
   */
  function drivePose() {
    const here = lineAt(distance).add(root.position);
    const fore = lineAt(distance + 3);
    const aft = lineAt(distance - 3);
    car.position.copy(here);
    // Heading along the line, nose up or down with the slope.
    car.rotation.set(
      -Math.atan2(fore.y - aft.y, Math.hypot(fore.x - aft.x, fore.z - aft.z)),
      Math.atan2(fore.x - aft.x, fore.z - aft.z),
      0,
      'YXZ',
    );
    camera.position.copy(lineAt(distance - 8.6).add(root.position));
    camera.position.y = here.y + 2.0;
    const ahead = lineAt(distance + 9).add(root.position);
    camera.lookAt(ahead.setY(ahead.y + 1.45));
  }
  tick();
  if (import.meta.env.DEV) {
    // Debugging aids. `shot` renders the drive view at `m` metres at w × h (no guide lines), to lay
    // the model over frames of a race video and check how well it fits.
    const snap = (w: number, h: number, pose: () => void, vfov?: number) => {
      const was = { mode, distance, ratio: renderer.getPixelRatio() };
      mode = 'drive';
      car.visible = true;
      turnLabels.forEach((l) => (l.visible = false));
      lineGroups.forEach((g) => (g.userData.was = g.visible));
      lineGroups.forEach((g) => (g.visible = false));
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      fitFov();
      if (vfov) {
        // A video recorded at another aspect: the game keeps the vertical angle (Hor+).
        camera.fov = vfov;
        camera.updateProjectionMatrix();
      }
      pose();
      renderer.render(world, camera);
      const url = canvas.toDataURL('image/png');
      lineGroups.forEach((g) => (g.visible = Boolean(g.userData.was)));
      ({ mode, distance } = was);
      car.visible = mode === 'drive';
      turnLabels.forEach((l) => (l.visible = mode === 'orbit'));
      renderer.setPixelRatio(was.ratio);
      resize();
      return url;
    };
    const shot = (m: number, w: number, h: number) =>
      snap(w, h, () => {
        distance = ((m % length) + length) % length;
        drivePose();
      });
    /**
     * The chase view from a telemetry pose (game x, y, z and yaw, as recorded), with the camera
     * turned `look` radians from straight behind (+ = to the left), for frames synced to a video.
     */
    const shotPose = (
      p: { x: number; y: number; z: number; yaw: number },
      w: number,
      h: number,
      look = 0,
      cam: { back?: number; up?: number; aim?: number; vfov?: number } = {},
    ) =>
      snap(
        w,
        h,
        () => {
          const at = new THREE.Vector3(p.x, p.y, -p.z).add(root.position);
          const dir = new THREE.Vector3(Math.sin(p.yaw), 0, -Math.cos(p.yaw));
          car.position.copy(at);
          car.rotation.set(0, Math.atan2(dir.x, dir.z), 0, 'YXZ');
          const view = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), look);
          camera.position
            .copy(at)
            .addScaledVector(view, -(cam.back ?? 8.6))
            .setY(at.y + (cam.up ?? 2.0));
          camera.lookAt(
            at
              .clone()
              .addScaledVector(view, 9)
              .setY(at.y + (cam.aim ?? 1.45)),
          );
        },
        cam.vfov,
      );
    Object.assign(window, { __track: { camera, car, controls, shot, shotPose } });
  }

  return {
    length,
    setMode(next) {
      if (next === 'orbit' && mode === 'drive') {
        // Back to the free view: from above and behind the car, looking at where it was.
        const fwd = new THREE.Vector3(Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y));
        controls.target.copy(car.position);
        camera.position
          .copy(car.position)
          .addScaledVector(fwd, -45)
          .setY(car.position.y + 32);
        flight = undefined;
      }
      mode = next;
      controls.enabled = next === 'orbit';
      // From the driver's seat the turn numbers are too big; the checkpoints guide instead.
      turnLabels.forEach((l) => (l.visible = next === 'orbit'));
      car.visible = next === 'drive';
      fitFov();
      if (next === 'orbit') controls.update();
    },
    setLine(id, visible) {
      const g = lineGroups.get(id);
      if (g) g.visible = visible;
    },
    setDistance(m) {
      distance = ((m % length) + length) % length;
    },
    destroy() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener('dblclick', onDoubleClick);
      controls.stopListenToKeyEvents();
      controls.dispose();
      // Free the GPU memory and the WebGL context (browsers allow only a few at a time).
      world.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
          o.geometry.dispose();
          for (const m of [o.material].flat()) {
            for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose();
            m.dispose();
          }
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
