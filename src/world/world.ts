import * as THREE from 'three';
import {
  PAL,
  TEAMS,
  billboard,
  car,
  flagPole,
  gantry,
  garage,
  grandstand,
  logo,
  marshalPost,
  person,
  pitWall,
  stage,
  tent,
  tireWall,
  tree,
  truck,
  type CarKind,
} from './models';
import type { SpotName } from './spots';
import { Builder, SHARED_MATERIAL, pick, seeded } from './voxel';

/**
 * The animated background (ADR-0019): one voxel race circuit shared by the whole site. The
 * home page does a lap of it while scrolling; every other page parks the camera somewhere
 * (garages for Tunes, the grid for Meta, the stage for the Playlist…), and changing page flies
 * the camera there. Look: a fine checkered ground with chunky, clearly defined blocks on top,
 * rendered at full resolution.
 */

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface World {
  readonly canvas: HTMLCanvasElement;
  /** Home page: paint the sources' names on the paddock garages. */
  setHome(sources: readonly { name: string; color: string }[]): void;
  /** Unit direction (on screen) of the home route at fraction f. */
  routeDirection(f: number): ScreenPoint;
  /** Home page: camera on the route at fraction f (0 = logo, 1 = end of the lap). */
  follow(f: number, animate?: boolean): void;
  /** Other pages: park the camera at a spot. */
  park(spot: Exclude<SpotName, 'home'>, animate?: boolean): void;
  /** Parked pages drift slightly with the page scroll. */
  setScroll(y: number): void;
  /** A still frame of a spot (normal mode's static backgrounds), as a data URL. */
  snapshot(spot: SpotName, width: number, height: number): string;
  resize(): void;
  start(): void;
  stop(): void;
}

// --- layout ------------------------------------------------------------------------------------

/** Circuit centre line (x, z); the main straight runs along z = 20, left to right. */
const CIRCUIT: [number, number][] = [
  [-30, 20],
  [40, 20],
  [110, 20],
  [150, 21],
  [178, 30],
  [196, 46],
  [220, 54],
  [248, 48],
  [266, 32],
  [292, 22],
  [340, 22],
  [372, 30],
  [392, 46],
  [418, 54],
  [448, 46],
  [468, 28],
  [498, 18],
  [560, 18],
  [612, 24],
  [646, 40],
  [668, 20],
  [664, -12],
  [640, -46],
  [600, -66],
  [520, -70],
  [420, -66],
  [320, -72],
  [220, -66],
  [120, -70],
  [40, -66],
  [-20, -60],
  [-52, -36],
  [-58, -4],
  [-48, 14],
];
const HALF = 4.5; // half the track width
const START_X = 72; // start/finish line

/** Pit lane: in at the last corner, along the garages, out after the first stretch. */
const PIT: [number, number][] = [
  [-54, 2],
  [-44, 9],
  [-30, 9.5],
  [-12, 9.5],
  [130, 9.5],
  [146, 11],
  [160, 17],
  [172, 26],
];

/** Logo: behind the circuit's back straight, facing the camera side (+Z). */
const LOGO_AT: [number, number] = [-6, -96];

const SPOTS: Record<Exclude<SpotName, 'home'>, [number, number]> = {
  tunes: [52, 0],
  tuners: [56, -24],
  car: [24, 2],
  meta: [72, 22],
  playlist: [600, -24],
  stands: [84, 32],
};

const X0 = -100;
const Z0 = -160;
const X1 = 730;
const Z1 = 92;
const TEX = 2; // ground texels per block: one checker square = half a block

/** Points are (x, z) on the ground, or (x, z, y) when the camera should look higher up. */
const curveOf = (
  points: (readonly [number, number] | readonly [number, number, number])[],
  closed: boolean,
) =>
  new THREE.CatmullRomCurve3(
    points.map(([x, z, y = 0]) => new THREE.Vector3(x, y, z)),
    closed,
    'centripetal',
  );

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Parameter of the circuit point closest to (x, z). */
function nearestU(circuit: THREE.Curve<THREE.Vector3>, x: number, z: number): number {
  let best = 0;
  let bestD = Infinity;
  const p = new THREE.Vector3();
  for (let i = 0; i < 2000; i++) {
    circuit.getPointAt(i / 2000, p);
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i / 2000;
    }
  }
  return best;
}

// --- ground ------------------------------------------------------------------------------------

/** Ground texture: crisp blocks of colour (no anti-aliasing), then a fine checker and faded edges. */
function groundTexture(
  circuit: THREE.Curve<THREE.Vector3>,
  pit: THREE.Curve<THREE.Vector3>,
  rand: () => number,
) {
  const w = (X1 - X0) * TEX;
  const h = (Z1 - Z0) * TEX;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const tx = (x: number) => Math.round((x - X0) * TEX);
  const tz = (z: number) => Math.round((z - Z0) * TEX);
  const rect = (x0: number, z0: number, x1: number, z1: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(tx(x0), tz(z0), tx(x1) - tx(x0), tz(z1) - tz(z0));
  };
  /** A pixel-exact disc (no anti-aliasing), radius in blocks. */
  const disc = (x: number, z: number, r: number, color: string) => {
    ctx.fillStyle = color;
    const cx = tx(x);
    const cz = tz(z);
    const rr = Math.round(r * TEX);
    for (let dy = -rr; dy <= rr; dy++) {
      const half = Math.floor(Math.sqrt(rr * rr - dy * dy));
      ctx.fillRect(cx - half, cz + dy, half * 2 + 1, 1);
    }
  };

  // Grass, with a few darker patches.
  ctx.fillStyle = '#12260f';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    disc(X0 + rand() * (X1 - X0), Z0 + rand() * (Z1 - Z0), 2 + rand() * 6, '#0f210d');
  }

  // Paddock (concrete), the sidewalk in front of the garages, the pit lane and its line.
  rect(-20, -54, 130, 4, '#1d1e22');
  for (let x = -16; x < 128; x += 21) rect(x, -50, x + 0.5, -10, '#26272c'); // parking lines
  rect(-20, 4, 140, 7, '#34353b'); // sidewalk (people walk here, never on the pit lane)
  for (const p of pit.getSpacedPoints(800)) disc(p.x, p.z, 3, '#28282d');
  rect(-14, 12, 140, 12.5, '#d0d0d0');
  for (let i = 0; i < 8; i++) rect(1 + i * 13.5, 7.5, 11 + i * 13.5, 8, '#4a4b52'); // pit boxes

  // Stage square and the logo's plinth area.
  rect(574, -46, 626, -6, '#19191d');
  rect(LOGO_AT[0] - 6, LOGO_AT[1] - 6, LOGO_AT[0] + 92, LOGO_AT[1] + 6, '#1a1b1f');

  // Track: gravel and curbs on the bends, then the asphalt.
  const samples = circuit.getSpacedPoints(3600);
  const bend = samples.map((b, i) => {
    const a = samples[(i - 6 + samples.length) % samples.length]!;
    const c = samples[(i + 6) % samples.length]!;
    let turn = Math.atan2(c.z - b.z, c.x - b.x) - Math.atan2(b.z - a.z, b.x - a.x);
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    return Math.abs(turn) > 0.05;
  });
  samples.forEach((p, i) => bend[i] && disc(p.x, p.z, HALF + 7, '#3b3428'));
  samples.forEach((p, i) => {
    if (bend[i]) disc(p.x, p.z, HALF + 1.5, Math.floor(i / 6) % 2 ? '#d43a2f' : '#e6e6e6');
  });
  samples.forEach((p) => disc(p.x, p.z, HALF, '#2d2d32'));
  // Start/finish line (checkered) and grid slots.
  for (let z = 20 - HALF; z < 20 + HALF; z += 0.5) {
    for (let k = 0; k < 2; k++) {
      rect(
        START_X + k * 0.5,
        z,
        START_X + k * 0.5 + 0.5,
        z + 0.5,
        (z * 2 + k) % 2 ? '#111' : '#f0f0f0',
      );
    }
  }
  for (let i = 0; i < 6; i++) {
    const z = i % 2 ? 17 : 21;
    rect(START_X + 6 + i * 8, z, START_X + 9 + i * 8, z + 0.5, '#9a9a9a');
  }

  // Fine checker everywhere, and edges fading into the page background.
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const fade = 24 * TEX;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if ((x + y) % 2) {
        d[o] = d[o]! * 0.88;
        d[o + 1] = d[o + 1]! * 0.88;
        d[o + 2] = d[o + 2]! * 0.88;
      }
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (edge < fade) d[o + 3] = Math.round((edge / fade) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// --- actors ------------------------------------------------------------------------------------

interface Walker {
  group: THREE.Group;
  legs: [THREE.Mesh, THREE.Mesh];
  target: THREE.Vector2;
  /** Graph node (paddock footpaths), or -1 for walkers that roam a small area. */
  node: number;
  area?: [number, number, number, number];
  speed: number;
  wait: number;
  phase: number;
  side: number;
}

interface Racer {
  mesh: THREE.Mesh;
  garageX: number;
  state: 'track' | 'pit';
  u: number; // circuit position (0–1)
  s: number; // pit lane position (blocks)
  base: number; // blocks per second
  speed: number;
  lane: number;
  laneTarget: number;
  stop: number; // seconds left at the pit box
  stopped: boolean;
  laps: number;
}

/**
 * Paddock footpaths: walkers go from node to node, so nobody walks through a truck or a tent.
 * Rows: behind the garages, between trucks and tents, behind the tents.
 */
function paddockGraph() {
  const rows = [-10, -27, -44];
  const xs = [-12, 0, 11.5, 22.5, 33, 43.5, 54, 64.5, 75, 85.5, 97, 110, 118];
  const nodes: THREE.Vector2[] = [];
  const id = new Map<string, number>();
  for (const z of rows)
    for (const x of xs) {
      id.set(`${x}|${z}`, nodes.length);
      nodes.push(new THREE.Vector2(x, z));
    }
  const links: number[][] = nodes.map(() => []);
  const link = (a: string, b: string) => {
    const i = id.get(a)!;
    const j = id.get(b)!;
    links[i]!.push(j);
    links[j]!.push(i);
  };
  for (const z of rows)
    for (let k = 1; k < xs.length; k++) link(`${xs[k - 1]}|${z}`, `${xs[k]}|${z}`);
  // Crossings between the trucks (they stand at x = 3–21, 24–42, 45–63, 66–84, 87–105).
  for (const x of [-12, 22.5, 43.5, 64.5, 85.5, 110, 118]) link(`${x}|-10`, `${x}|-27`);
  // Crossings between the tents (at x = 0–8, 22–30, 44–52, 66–74, 88–96).
  for (const x of [-12, 11.5, 33, 54, 75, 97, 118]) link(`${x}|-27`, `${x}|-44`);
  return { nodes, links };
}

/** A sign texture: the text in the site's condensed font on a team colour. */
function signTexture(text: string, bg: string, fg: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 40;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = fg;
  ctx.font = "700 30px 'Barlow Condensed', 'Arial Narrow', sans-serif";
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2 + 1);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Readable text colour on a background colour. */
const inkOn = (bg: string) => {
  const c = new THREE.Color(bg);
  return c.r * 0.3 + c.g * 0.59 + c.b * 0.11 > 0.5 ? '#111111' : '#f2f2f2';
};

// --- world -------------------------------------------------------------------------------------

export function createWorld(container: HTMLElement, options: { season: string }): World {
  const small = () => window.innerWidth < 700;
  const rand = seeded(6);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'low-power',
    preserveDrawingBuffer: true,
  });
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = 'world-canvas';
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000);

  const circuit = curveOf(CIRCUIT, true);
  const circuitLength = circuit.getLength();
  const pitPath = curveOf(PIT, false);
  const pitLength = pitPath.getLength();
  const uIn = nearestU(circuit, PIT[0]![0], PIT[0]![1]);
  const uOut = nearestU(circuit, PIT[PIT.length - 1]![0], PIT[PIT.length - 1]![1]);

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(X1 - X0, Z1 - Z0),
    new THREE.MeshBasicMaterial({ map: groundTexture(circuit, pitPath, rand), transparent: true }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
  scene.add(ground);

  // Static scenery, one mesh.
  const b = new Builder();
  const garageXs = Array.from({ length: 8 }, (_, i) => 6 + i * 13.5);
  garageXs.forEach((x, i) => garage(b, x, -1, TEAMS[i % TEAMS.length]!, rand));
  for (let i = 0; i < 5; i++) truck(b, 12 + i * 21, -18, TEAMS[(i * 3) % TEAMS.length]!);
  for (let i = 0; i < 5; i++) tent(b, 4 + i * 22, -36, TEAMS[(i * 3 + 1) % TEAMS.length]![0]);
  pitWall(b, -14, 140, 12.5, '#caff02');
  const seats = grandstand(b, 24, 28, 104, 5);
  const lights = gantry(b, START_X, 20 - HALF, 20 + HALF);
  const tiles = stage(b, 600, -26);
  const poles = [30, 52, 74, 96, 118].map((x) => flagPole(b, x, 41));
  tireWall(b, 204, 64, 30);
  tireWall(b, 396, 64, 28);
  marshalPost(b, 194, 66);
  marshalPost(b, 474, 40);
  billboard(b, 418, 66, ['#caff02', '#2f6fe0', '#ececec']);
  billboard(b, 316, 10, ['#d9372b', '#f2c200', '#ececec']);
  billboard(b, 530, 6, [options.season, '#ececec', '#1d1d1d']);
  // The logo is its own mesh, turned to face the camera (see resize) so it always reads.
  const logoBuilder = new Builder();
  const logoSize = logo(logoBuilder, -20.5, 0, '#caff02');
  const logoMesh = logoBuilder.mesh();
  logoMesh.position.set(LOGO_AT[0] + logoSize.width / 2, 0, LOGO_AT[1]);
  scene.add(logoMesh);
  // Trees, away from the track and the busy areas.
  const trackPts = circuit.getSpacedPoints(700);
  const clear: [number, number, number, number][] = [
    [-24, -58, 134, 16],
    [18, 24, 134, 46],
    [570, -50, 630, -4],
    [LOGO_AT[0] - 10, LOGO_AT[1] - 10, LOGO_AT[0] + 96, LOGO_AT[1] + 10],
  ];
  const free = (x: number, z: number) =>
    trackPts.every((p) => (p.x - x) ** 2 + (p.z - z) ** 2 > (HALF + 9) ** 2) &&
    clear.every(([a, c, d2, e]) => x < a || x > d2 || z < c || z > e);
  let planted = 0;
  for (let i = 0; i < 1200 && planted < (small() ? 100 : 170); i++) {
    const x = Math.round(X0 + 28 + rand() * (X1 - X0 - 56));
    const z = Math.round(Z0 + 22 + rand() * (Z1 - Z0 - 44));
    if (!free(x, z)) continue;
    tree(b, x, z, rand);
    planted++;
  }
  scene.add(b.mesh());

  // Start lights.
  const lightMeshes = lights.map((p) => {
    const m = new THREE.Mesh(
      new Builder().box(0, -0.5, -0.5, 0.5, 1, 1, '#ffffff').geometry(),
      new THREE.MeshBasicMaterial({ color: '#2a0d0b', side: THREE.DoubleSide }),
    );
    m.position.copy(p);
    scene.add(m);
    return m;
  });

  // Flags.
  const flagColors = [options.season, '#caff02', '#ececec', '#2f6fe0', '#d9372b'];
  const flags = poles.map((top, i) =>
    [0, 1, 2, 3].map((k) => {
      const m = new THREE.Mesh(
        new Builder().box(0, -1, -0.25, 1, 2, 0.5, flagColors[i % flagColors.length]!).geometry(),
        SHARED_MATERIAL,
      );
      m.position.set(top.x + k, top.y, top.z);
      scene.add(m);
      return m;
    }),
  );

  // Crowds (instanced): grandstand and stage.
  const fanGeom = new Builder()
    .box(-0.5, 0, -0.5, 1, 1, 1, '#ffffff')
    .box(-0.5, 1, -0.5, 1, 1, 1, '#e0b090')
    .geometry();
  const instMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const fans: THREE.Vector3[] = [
    ...seats.filter(() => rand() < (small() ? 0.5 : 0.8)),
    ...Array.from(
      { length: small() ? 40 : 70 },
      () => new THREE.Vector3(Math.round(588 + rand() * 24), 0, Math.round(-15 + rand() * 6)),
    ),
  ];
  const crowd = new THREE.InstancedMesh(fanGeom, instMat, fans.length);
  const tmp = new THREE.Object3D();
  const fanPhase = fans.map(() => rand() * Math.PI * 2);
  fans.forEach((p, i) => {
    tmp.position.copy(p);
    tmp.updateMatrix();
    crowd.setMatrixAt(i, tmp.matrix);
    crowd.setColorAt(i, new THREE.Color(pick(rand, PAL.shirt)));
  });
  scene.add(crowd);

  // Stage screen tiles (instanced, colours animated).
  const tileMesh = new THREE.InstancedMesh(
    new Builder().box(-1, -1, -0.1, 1.9, 1.9, 0.3, '#ffffff').geometry(),
    instMat,
    tiles.length,
  );
  tiles.forEach((p, i) => {
    tmp.position.copy(p);
    tmp.updateMatrix();
    tileMesh.setMatrixAt(i, tmp.matrix);
    tileMesh.setColorAt(i, new THREE.Color('#111'));
  });
  scene.add(tileMesh);
  const season = new THREE.Color(options.season);
  const lime = new THREE.Color('#caff02');
  const dark = new THREE.Color('#121212');

  // Cars: they keep their distance, overtake on the other line and stop in the pits now and then.
  const kinds: CarKind[] = ['gt', 'proto', 'gt', 'hatch', 'gt', 'proto', 'gt', 'hatch'];
  const racers: Racer[] = kinds.slice(0, small() ? 6 : 8).map((kind, i) => {
    const [body, accent] = TEAMS[i % TEAMS.length]!;
    const mesh = car(body, accent, kind);
    scene.add(mesh);
    const base = 34 + rand() * 10;
    const lane = i % 2 ? 1.8 : -1.8;
    return {
      mesh,
      garageX: garageXs[i % garageXs.length]!,
      state: 'track',
      u: (i / 8 + 0.3) % 1,
      s: 0,
      base,
      speed: base,
      lane,
      laneTarget: lane,
      stop: 0,
      stopped: false,
      laps: i,
    };
  });

  // People: paddock walkers on footpaths, crews on the sidewalk, a few at the stage.
  const graph = paddockGraph();
  const walkers: Walker[] = [];
  const addWalker = (opts: {
    node?: number;
    area?: [number, number, number, number];
    speed: number;
  }) => {
    const { group, legs } = person(rand);
    let start: THREE.Vector2;
    if (opts.area) {
      const [ax, az, bx, bz] = opts.area;
      start = new THREE.Vector2(ax + rand() * (bx - ax), az + rand() * (bz - az));
    } else start = graph.nodes[opts.node!]!.clone();
    group.position.set(start.x, 0, start.y);
    scene.add(group);
    walkers.push({
      group,
      legs,
      target: start.clone(),
      node: opts.node ?? -1,
      area: opts.area,
      speed: opts.speed,
      wait: rand() * 3,
      phase: rand() * 10,
      side: (rand() - 0.5) * 2,
    });
  };
  for (let i = 0; i < (small() ? 14 : 26); i++)
    addWalker({ node: Math.floor(rand() * graph.nodes.length), speed: 3 + rand() * 2 });
  for (let i = 0; i < (small() ? 6 : 10); i++)
    addWalker({ area: [-12, 5, 114, 6.5], speed: 2 + rand() });
  for (let i = 0; i < 3; i++) addWalker({ area: [590, -12, 610, -9], speed: 1.5 });

  // --- camera ----------------------------------------------------------------------------------

  let viewH = 58;

  /** First view: the logo on the right half of the screen, the manifesto on the left. */
  const logoView = (): readonly [number, number, number] => {
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const wide = window.innerWidth >= 1100;
    // Wide screens: logo on the right, manifesto on the left. Narrower: logo above it.
    const shift = (camera.right - camera.left) * (wide ? 0.2 : 0);
    const c = logoMesh.position;
    const y = logoSize.height / 2 - (wide ? 1 : viewH * 0.24);
    return [c.x - right.x * shift, c.z - right.z * shift, y];
  };
  type RoutePoint = readonly [number, number] | readonly [number, number, number];
  /** One full lap of the circuit from a given point on it (61 points). */
  const lapFrom = (x: number, z: number): RoutePoint[] => {
    const u0 = nearestU(circuit, x, z);
    const p = new THREE.Vector3();
    return Array.from({ length: 61 }, (_, i) => {
      circuit.getPointAt((u0 + i / 60) % 1, p);
      return [p.x, p.z] as const;
    });
  };
  /** Home route: logo → paddock → start line → one full lap. */
  const homeRoute = (): RoutePoint[] => [
    logoView(),
    [LOGO_AT[0] + 40, -62],
    [48, -30],
    [56, -2],
    ...lapFrom(START_X, 20),
  ];
  let route = curveOf(homeRoute(), false);
  // The sources' names on the garages (rebuilt by setHome).
  const homeObjects = new THREE.Group();
  scene.add(homeObjects);

  let mode:
    { kind: 'route'; progress: number } | { kind: 'spot'; spot: Exclude<SpotName, 'home'> } = {
    kind: 'route',
    progress: 0,
  };
  let scrollDrift = 0;
  const target = route.getPointAt(0).clone();
  let flight: { from: THREE.Vector3; start: number; duration: number } | null = null;
  let yaw = Math.PI / 4;
  const PITCH = THREE.MathUtils.degToRad(33);

  const spotPoint = (spot: SpotName, out: THREE.Vector3) => {
    if (spot === 'home') return out.copy(route.getPointAt(0));
    const [x, z] = SPOTS[spot];
    return out.set(x, 0, z);
  };
  const desired = (out: THREE.Vector3) => {
    if (mode.kind === 'route')
      return out.copy(route.getPointAt(THREE.MathUtils.clamp(mode.progress, 0, 1)));
    spotPoint(mode.spot, out);
    return out.set(out.x + scrollDrift * 0.012, 0, out.z);
  };

  const placeCamera = () => {
    const d = 400;
    camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(PITCH) * d,
      target.y + Math.sin(PITCH) * d,
      target.z + Math.cos(yaw) * Math.cos(PITCH) * d,
    );
    camera.lookAt(target);
    camera.updateMatrixWorld();
  };

  /** Pick the yaw where world +X shows `angle` degrees below the horizontal, running right. */
  const chooseYaw = (angle: number) => {
    let best = yaw;
    let bestErr = Infinity;
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    for (let deg = 5; deg <= 175; deg += 1) {
      yaw = THREE.MathUtils.degToRad(deg);
      placeCamera();
      right.setFromMatrixColumn(camera.matrixWorld, 0);
      up.setFromMatrixColumn(camera.matrixWorld, 1);
      if (right.x <= 0) continue;
      const err = Math.abs(THREE.MathUtils.radToDeg(Math.atan2(-up.x, right.x)) - angle);
      if (err < bestErr) {
        bestErr = err;
        best = yaw;
      }
    }
    yaw = best;
  };

  const setFrustum = (w: number, h: number) => {
    viewH = small() ? 74 : 58;
    const aspect = w / h;
    camera.left = (-viewH * aspect) / 2;
    camera.right = (viewH * aspect) / 2;
    camera.top = viewH / 2;
    camera.bottom = -viewH / 2;
    camera.updateProjectionMatrix();
  };

  const resize = () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    setFrustum(w, h);
    chooseYaw(small() ? 72 : 27);
    // Facing the camera, turned a little so its depth shows (like a monument seen at an angle).
    logoMesh.rotation.y = yaw - 0.45;
    placeCamera();
  };
  resize();

  // --- animation -------------------------------------------------------------------------------

  const clock = new THREE.Clock();
  const v = new THREE.Vector3();
  const tangent = new THREE.Vector3();

  /** Distance (blocks, along the circuit) from a to b, going forward. */
  const ahead = (a: number, b2: number) => ((((b2 - a) % 1) + 1) % 1) * circuitLength;

  const moveRacers = (dt: number) => {
    const onTrack = racers.filter((r) => r.state === 'track');
    for (const r of racers) {
      if (r.state === 'track') {
        // Keep the distance; overtake on the other line when it is clear.
        let speed = r.base;
        for (const o of onTrack) {
          if (o === r) continue;
          const gap = ahead(r.u, o.u);
          const sameLine = Math.abs(o.lane - r.lane) < 2.4;
          if (sameLine && gap < 16) {
            const other = -r.laneTarget;
            const clearLine = onTrack.every(
              (q) =>
                q === r ||
                Math.abs(q.lane - other) > 2.4 ||
                (ahead(r.u, q.u) > 18 && ahead(q.u, r.u) > 10),
            );
            if (clearLine) r.laneTarget = other;
            else speed = Math.min(speed, o.speed * (gap < 9 ? 0.9 : 1));
          }
        }
        r.speed += (speed - r.speed) * Math.min(1, dt * 2);
        r.lane +=
          Math.sign(r.laneTarget - r.lane) * Math.min(Math.abs(r.laneTarget - r.lane), dt * 2.5);
        const before = r.u;
        r.u = (r.u + (r.speed * dt) / circuitLength) % 1;
        // Into the pits now and then (one lap in four).
        if (ahead(before, uIn) <= ahead(before, r.u)) {
          r.laps++;
          if (r.laps % 4 === 3) {
            r.state = 'pit';
            r.s = 0;
            r.stopped = false;
            continue;
          }
        }
        circuit.getPointAt(r.u, v);
        circuit.getTangentAt(r.u, tangent);
        r.mesh.position.set(v.x - tangent.z * r.lane, 0, v.z + tangent.x * r.lane);
        r.mesh.rotation.y = Math.atan2(-tangent.z, tangent.x);
      } else {
        // Pit lane at low speed, stop at the team's box, wait for a gap before rejoining.
        const boxS =
          pitLength * ((r.garageX - PIT[0]![0]) / (PIT[PIT.length - 1]![0] - PIT[0]![0]));
        let pitSpeed = 10;
        if (!r.stopped && r.s >= boxS) {
          r.stopped = true;
          r.stop = 3 + rand() * 2;
        }
        if (r.stopped && r.stop > 0) {
          r.stop -= dt;
          pitSpeed = 0;
        }
        const exitWait = pitLength - 4;
        if (r.s >= exitWait) {
          const clearExit = onTrack.every((q) => ahead(q.u, uOut) > 30 && ahead(uOut, q.u) > 8);
          if (clearExit) {
            r.state = 'track';
            r.u = uOut;
            r.lane = r.laneTarget = 1.8;
            r.speed = 18;
            continue;
          }
          pitSpeed = 0;
        }
        r.s = Math.min(exitWait, r.s + pitSpeed * dt);
        pitPath.getPointAt(r.s / pitLength, v);
        pitPath.getTangentAt(r.s / pitLength, tangent);
        r.mesh.position.set(v.x, 0, v.z);
        r.mesh.rotation.y = Math.atan2(-tangent.z, tangent.x);
      }
    }
  };

  const moveWalkers = (dt: number) => {
    for (const w of walkers) {
      const p = w.group.position;
      const dx = w.target.x - p.x;
      const dz = w.target.y - p.z;
      const dist = Math.hypot(dx, dz);
      if (w.wait > 0) {
        w.wait -= dt;
        w.legs[0].rotation.z = 0;
        w.legs[1].rotation.z = 0;
        p.y = 0;
        continue;
      }
      if (dist < 0.3) {
        if (w.area) {
          const [ax, az, bx, bz] = w.area;
          w.target.set(ax + rand() * (bx - ax), az + rand() * (bz - az));
        } else {
          w.node = pick(rand, graph.links[w.node]!);
          const n = graph.nodes[w.node]!;
          w.target.set(n.x + w.side * 0.8, n.y + w.side * 0.8);
        }
        w.wait = rand() < 0.35 ? 1 + rand() * 4 : 0;
        continue;
      }
      const step = Math.min(dist, w.speed * dt);
      p.x += (dx / dist) * step;
      p.z += (dz / dist) * step;
      w.group.rotation.y = Math.atan2(-dz, dx);
      w.phase += dt * w.speed * 2.4;
      const swing = Math.sin(w.phase) * 0.55;
      w.legs[0].rotation.z = swing;
      w.legs[1].rotation.z = -swing;
      p.y = Math.abs(Math.cos(w.phase)) * 0.15;
    }
  };

  let t = 0;
  const animate = (dt: number) => {
    t += dt;
    moveRacers(dt);
    moveWalkers(dt);

    fans.forEach((pos, i) => {
      const jump = Math.max(0, Math.sin(t * 5 + fanPhase[i]!)) * 0.6;
      tmp.position.set(pos.x, pos.y + Math.round(jump * 2) / 2, pos.z);
      tmp.updateMatrix();
      crowd.setMatrixAt(i, tmp.matrix);
    });
    crowd.instanceMatrix.needsUpdate = true;

    const c = new THREE.Color();
    tiles.forEach((_, i) => {
      const wave = Math.sin(t * 2 + (i % 10) * 0.6 - Math.floor(i / 10) * 0.4);
      c.copy(dark).lerp(wave > 0.6 ? lime : season, Math.max(0, wave));
      tileMesh.setColorAt(i, c);
    });
    if (tileMesh.instanceColor) tileMesh.instanceColor.needsUpdate = true;

    const cycle = t % 8;
    lightMeshes.forEach((m, i) => {
      const on = cycle > 1 + i * 0.7 && cycle < 5;
      (m.material as THREE.MeshBasicMaterial).color.set(on ? '#ff2a1a' : '#2a0d0b');
    });

    flags.forEach((segs, i) =>
      segs.forEach((m, k) => {
        m.position.y = poles[i]!.y + Math.round(Math.sin(t * 4 + k * 0.9 + i) * k) * 0.25;
      }),
    );
  };

  const tick = () => {
    const dt = Math.min(clock.getDelta(), 0.05);
    desired(v);
    if (flight) {
      const k = Math.min(1, (performance.now() - flight.start) / flight.duration);
      target.lerpVectors(flight.from, v, easeInOut(k));
      if (k >= 1) flight = null;
    } else {
      target.lerp(v, 0.25);
    }
    placeCamera();
    animate(dt);
    renderer.render(scene, camera);
  };

  // Let the scene run a little before the first frame, so cars and people are spread out.
  for (let i = 0; i < 120; i++) animate(1 / 20);

  return {
    canvas,
    setHome(sources) {
      route = curveOf(homeRoute(), false);
      homeObjects.clear();
      sources.slice(0, garageXs.length).forEach((src, k) => {
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(14, 1),
          new THREE.MeshBasicMaterial({ map: signTexture(src.name, src.color, inkOn(src.color)) }),
        );
        sign.position.set(garageXs[k]!, 5.5, 5.02);
        homeObjects.add(sign);
      });
    },
    routeDirection(f) {
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      const t = route.getTangentAt(THREE.MathUtils.clamp(f, 0, 1));
      const x = t.dot(right);
      const y = -t.dot(up);
      const len = Math.hypot(x, y) || 1;
      return { x: x / len, y: y / len };
    },
    follow(progress, animateFlight = false) {
      const wasSpot = mode.kind === 'spot';
      mode = { kind: 'route', progress };
      if (animateFlight && wasSpot)
        flight = { from: target.clone(), start: performance.now(), duration: 1100 };
    },
    park(spot, animateFlight = false) {
      const changed = mode.kind !== 'spot' || mode.spot !== spot;
      mode = { kind: 'spot', spot };
      scrollDrift = 0;
      if (animateFlight && changed)
        flight = { from: target.clone(), start: performance.now(), duration: 1100 };
      if (!animateFlight) desired(target);
    },
    setScroll(y) {
      scrollDrift = y;
    },
    snapshot(spot, width, height) {
      const keepTarget = target.clone();
      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);
      setFrustum(width, height);
      spotPoint(spot, target);
      placeCamera();
      renderer.setClearColor('#0d0d0d', 1); // the page colour, so the picture has no holes
      renderer.render(scene, camera);
      const url = canvas.toDataURL('image/webp', 0.86);
      renderer.setClearColor(0x000000, 0);
      target.copy(keepTarget);
      resize();
      return url;
    },
    resize,
    start() {
      clock.getDelta();
      renderer.setAnimationLoop(tick);
    },
    stop() {
      renderer.setAnimationLoop(null);
    },
  };
}
