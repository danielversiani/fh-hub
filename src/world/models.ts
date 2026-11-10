import * as THREE from 'three';
import { Builder, SHARED_MATERIAL, pick, type Turn } from './voxel';

/**
 * The voxel models of the world (ADR-0019): a paddock and a race circuit. All original and
 * generic: no real car, team, sponsor or logo.
 * Units: 1 = one block. Models are built from whole (or half) blocks so they read as clear,
 * chunky shapes over the fine checkered ground, and every one drops a contact shadow.
 * Cars face +X; garages open towards +Z.
 */

export const PAL = {
  concrete: '#3c3d42',
  concreteDark: '#2c2d31',
  concreteLight: '#55565c',
  steel: '#8a8e96',
  steelDark: '#5a5d64',
  glass: '#1c2834',
  glassLight: '#3d5a72',
  tire: '#161616',
  rim: '#9a9a9a',
  rubber: '#26262a',
  white: '#ececec',
  red: '#d9372b',
  blue: '#2f6fe0',
  yellow: '#f2c200',
  trunk: '#4e3626',
  leaf: ['#1e5c2c', '#257034', '#2f823c', '#3a8f3f'],
  skin: ['#f0c6a0', '#d39b70', '#9a6440', '#6e4428'],
  hair: ['#1b1410', '#3c2414', '#a8743c', '#d8c69a', '#262626'],
  shirt: ['#ececec', '#2f6fe0', '#d9372b', '#f2c200', '#19b8a6', '#ff7a1a', '#8d5cf6', '#2a2a2a'],
  trousers: ['#22252b', '#3a3a3a', '#26324a', '#4a3a2a'],
} as const;

/** Team colours: body and accent pairs (generic liveries). */
export const TEAMS: readonly [string, string][] = [
  ['#caff02', '#151515'],
  ['#d9372b', '#ececec'],
  ['#2f6fe0', '#f2c200'],
  ['#ececec', '#d9372b'],
  ['#f2c200', '#151515'],
  ['#19b8a6', '#ececec'],
  ['#ff7a1a', '#1d1d1d'],
  ['#8d5cf6', '#caff02'],
];

// --- static models (added to one Builder) -----------------------------------------------------

/** A pit garage, open towards +Z: 12 wide, 10 deep, front at z + 5, with a gap to the next. */
export function garage(
  b: Builder,
  x: number,
  z: number,
  team: readonly [string, string],
  rand: () => number,
) {
  b.at(x, 0, z);
  b.shadow(-7, -6, 14, 11, 7);
  b.box(-6, 0, -5, 12, 0.25, 10, PAL.concreteDark);
  b.box(-6, 0, -6, 12, 6, 1, PAL.concrete); // back wall
  b.box(-7, 0, -6, 1, 6, 11, PAL.concrete); // side walls
  b.box(6, 0, -6, 1, 6, 11, PAL.concrete);
  b.box(-7, 6, -6, 14, 1, 11, PAL.steelDark); // roof
  b.box(-2, 7, -4, 3, 1, 3, PAL.steel); // air unit on the roof
  b.box(3, 7, -3, 2, 0.6, 2, PAL.steelDark);
  b.box(-6, 5, 4.6, 12, 1, 0.4, PAL.steelDark); // rolled-up door
  b.box(-7, 5, 5, 14, 1, 1, team[0]); // sign band
  b.box(-7, 5, 5, 2, 1, 1, team[1]);
  // Inside: a tool chest, a workbench, tyre stacks, a screen on the wall.
  b.box(-5, 0.25, -5, 2, 2, 1, PAL.red);
  b.box(-2, 0.25, -5, 3, 1.5, 1, PAL.steelDark);
  b.box(-6, 3, -4.9, 2.5, 1.5, 0.2, PAL.glassLight);
  for (let i = 0; i < 2; i++) {
    const stack = 2 + Math.floor(rand() * 2);
    for (let k = 0; k < stack; k++) b.box(3 + i * 1.5, 0.25 + k, -5, 1, 1, 1, PAL.tire);
  }
}

/** A team truck in the paddock, 18 long, cab towards -X. */
export function truck(b: Builder, x: number, z: number, team: readonly [string, string]) {
  b.at(x, 0, z);
  b.shadow(-9, -2.5, 18, 5, 6);
  b.box(-9, 1, -2, 3, 4, 4, team[1]); // cab
  b.box(-9.1, 3, -1.5, 0.2, 1, 3, PAL.glassLight); // windscreen
  b.box(-8, 5, -1.2, 1, 0.6, 2.4, team[0]); // roof marker
  b.box(-5, 1, -2, 14, 5, 4, PAL.white); // trailer
  b.box(-5.05, 3, -2.05, 14.1, 1, 4.1, team[0]); // stripe
  b.box(-5.05, 2, -2.05, 14.1, 0.3, 4.1, team[1]);
  for (const wx of [-8, 3, 6]) {
    b.box(wx, 0, -2.5, 2, 1, 1, PAL.tire);
    b.box(wx + 0.5, 0.25, -2.55, 1, 0.5, 0.1, PAL.rim);
    b.box(wx, 0, 1.5, 2, 1, 1, PAL.tire);
    b.box(wx + 0.5, 0.25, 2.45, 1, 0.5, 0.1, PAL.rim);
  }
}

/** A hospitality tent. */
export function tent(b: Builder, x: number, z: number, color: string) {
  b.at(x, 0, z);
  b.shadow(-4, -4, 8, 8, 5);
  for (const [px, pz] of [
    [-3, -3],
    [2, -3],
    [-3, 2],
    [2, 2],
  ] as const)
    b.box(px, 0, pz, 1, 3, 1, PAL.steel);
  b.box(-4, 3, -4, 8, 1, 8, color);
  b.box(-3, 4, -3, 6, 1, 6, color);
  b.box(-2, 5, -2, 4, 0.6, 4, PAL.white);
  b.box(-1, 0, -1, 2, 1, 2, PAL.white); // table
  b.box(-2.5, 0, 0.5, 1, 1, 1, PAL.steelDark); // chairs
  b.box(1.5, 0, -1.5, 1, 1, 1, PAL.steelDark);
}

/** A tree: round canopy, pine, or a low bush. */
export function tree(b: Builder, x: number, z: number, rand: () => number) {
  const kind = rand();
  b.at(x, 0, z);
  if (kind < 0.18) {
    // Bush.
    const c = pick(rand, PAL.leaf);
    b.shadow(-1.5, -1.5, 3, 3, 1.5);
    b.box(-1.5, 0, -1.5, 3, 1.5, 3, c);
    b.box(-1, 1.5, -1, 2, 0.5, 2, c);
    return;
  }
  if (kind < 0.45) {
    // Pine: stacked, shrinking layers.
    const h = 2 + Math.floor(rand() * 2);
    const c = pick(rand, PAL.leaf);
    b.shadow(-2, -2, 4, 4, h + 5);
    b.box(-0.5, 0, -0.5, 1, h, 1, PAL.trunk);
    b.box(-2, h, -2, 4, 1.5, 4, c);
    b.box(-1.5, h + 1.5, -1.5, 3, 1.5, 3, c);
    b.box(-1, h + 3, -1, 2, 1.5, 2, c);
    b.box(-0.5, h + 4.5, -0.5, 1, 1, 1, c);
    return;
  }
  // Round canopy, two shades.
  const h = 2 + Math.floor(rand() * 2);
  const s = rand() < 0.5 ? 3 : 4;
  const c = pick(rand, PAL.leaf);
  const light = pick(rand, PAL.leaf);
  b.shadow(-s / 2, -s / 2, s, s, h + 3);
  b.box(-0.5, 0, -0.5, 1, h, 1, PAL.trunk);
  b.box(-s / 2, h, -s / 2, s, 2, s, c);
  b.box(-s / 2 + 1, h + 2, -s / 2 + 1, s - 2, 1, s - 2, light);
  b.box(-s / 2 - 0.5, h + 0.5, -s / 2 + 1, 0.5, 1, s - 2, c);
  b.box(s / 2, h + 0.5, -s / 2 + 1, 0.5, 1, s - 2, c);
}

/** A wall of tyre stacks, `n` stacks long along local X. */
export function tireWall(b: Builder, x: number, z: number, n: number, turn: Turn = 0) {
  b.at(x, 0, z, turn);
  b.shadow(0, 0, n, 1, 2);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 2; k++) b.box(i, k, 0, 1, 1, 1, (i + k) % 3 === 0 ? PAL.white : PAL.tire);
  }
}

/** A catch fence along a polyline (ground points): posts and a dark mesh. */
export function fence(b: Builder, pts: readonly THREE.Vector3[]) {
  b.at(0, 0, 0);
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    b.box(p.x - 0.25, 0, p.z - 0.25, 0.5, 3.5, 0.5, PAL.steelDark);
    const q = pts[i + 1];
    if (!q) continue;
    // Mesh panel between posts: a thin dark slab, axis-aligned to the longer direction.
    const dx = q.x - p.x;
    const dz = q.z - p.z;
    if (Math.abs(dx) >= Math.abs(dz))
      b.box(Math.min(p.x, q.x), 0.5, (p.z + q.z) / 2 - 0.08, Math.abs(dx), 2.8, 0.16, '#1b1d20');
    else b.box((p.x + q.x) / 2 - 0.08, 0.5, Math.min(p.z, q.z), 0.16, 2.8, Math.abs(dz), '#1b1d20');
  }
}

/** A trackside billboard with a generic block pattern (no brand). */
export function billboard(
  b: Builder,
  x: number,
  z: number,
  colors: readonly string[],
  turn: Turn = 0,
) {
  b.at(x, 0, z, turn);
  b.shadow(-7, 0, 14, 1, 8);
  b.box(-6, 0, 0, 1, 4, 1, PAL.steelDark);
  b.box(5, 0, 0, 1, 4, 1, PAL.steelDark);
  b.box(-7, 4, 0, 14, 4, 1, PAL.rubber);
  for (let i = 0; i < 12; i++) {
    const h = 1 + ((i * 7) % 3);
    b.box(-6 + i, 5, -0.2, 1, h, 1, colors[i % colors.length]!);
  }
}

/** A marshal post (small tower). Returns where the marshal stands. */
export function marshalPost(b: Builder, x: number, z: number): THREE.Vector3 {
  b.at(x, 0, z);
  b.shadow(-1, -1, 2, 2, 3.5);
  b.box(-1, 0, -1, 2, 3, 2, PAL.concrete);
  b.box(-1.5, 3, -1.5, 3, 0.5, 3, PAL.steel);
  b.box(-1.5, 3.5, -1.5, 3, 0.5, 0.3, PAL.yellow); // railing
  return new THREE.Vector3(x, 3.5, z);
}

/** The pit wall along X, with the crews' boards. */
export function pitWall(b: Builder, x0: number, x1: number, z: number, accent: string) {
  b.at(0, 0, z);
  b.shadow(x0, 0, x1 - x0, 1, 1);
  b.box(x0, 0, 0, x1 - x0, 1, 1, PAL.concreteLight);
  for (let x = x0 + 4; x < x1 - 4; x += 14) {
    b.box(x, 1, 0.2, 2, 1.2, 0.6, accent);
    b.box(x + 0.5, 1.2, 0.1, 1, 0.8, 0.1, '#151515');
  }
}

/**
 * Grandstand with `steps` tiers of seats. Facing -Z by default (tiers rise towards +Z); with
 * `mirror`, facing +Z and spanning x - width … x. Returns the seat positions (world).
 */
export function grandstand(
  b: Builder,
  x: number,
  z: number,
  width: number,
  steps: number,
  seatColors: readonly string[],
  mirror = false,
): THREE.Vector3[] {
  b.at(x, 0, z, mirror ? 2 : 0);
  const m = mirror ? -1 : 1;
  const seats: THREE.Vector3[] = [];
  const back = steps * 2;
  b.shadow(-1, -1, width + 2, back + 2, steps + 7);
  for (let k = 0; k < steps; k++) {
    b.box(0, 0, k * 2, width, 1 + k, 2, k % 2 ? PAL.concrete : PAL.concreteDark);
    for (let i = 1; i < width - 1; i += 1.5) {
      const color = seatColors[(k + Math.floor(i / 1.5)) % seatColors.length]!;
      b.box(i - 0.4, 1 + k, k * 2 + 0.9, 0.8, 0.4, 0.8, color);
      seats.push(new THREE.Vector3(x + m * i, 1.4 + k, z + m * (k * 2 + 1.3)));
    }
  }
  b.box(0, 0, back, width, steps + 3, 1, PAL.concreteDark);
  for (let i = 0; i <= width; i += width / 4) b.box(i - 0.5, 0, back, 1, steps + 6, 1, PAL.steel);
  b.box(-1, steps + 6, -1, width + 2, 1, back + 2, PAL.steelDark); // roof
  b.box(-1, steps + 6.5, -1, width + 2, 0.5, 0.6, PAL.white); // roof edge
  return seats;
}

/** Start gantry across the track (along Z) at x. Returns the light positions. */
export function gantry(b: Builder, x: number, z0: number, z1: number): THREE.Vector3[] {
  b.at(x, 0, 0);
  b.shadow(-1, z0 - 2, 2, z1 - z0 + 4, 11);
  b.box(-0.5, 0, z0 - 2, 1, 9, 1, PAL.steel);
  b.box(-0.5, 0, z1 + 1, 1, 9, 1, PAL.steel);
  b.box(-1, 9, z0 - 2, 2, 2, z1 - z0 + 4, PAL.steelDark);
  const mid = (z0 + z1) / 2;
  b.box(0.9, 9.2, mid - 4.1, 0.6, 1.6, 8.2, '#141414'); // light housing
  return [-2, -1, 0, 1, 2].map((i) => new THREE.Vector3(x + 1.5, 10, mid + i * 1.5));
}

/** Festival stage facing +Z. Returns the screen tile positions (animated). */
export function stage(b: Builder, x: number, z: number): THREE.Vector3[] {
  b.at(x, 0, z);
  b.shadow(-16, -8, 34, 16, 15);
  b.box(-13, 0, -7, 26, 2, 14, PAL.concreteDark); // platform
  b.box(-13, 2, -7, 26, 0.2, 14, '#35363c');
  for (const px of [-13, 12]) {
    b.box(px, 2, -7, 1, 12, 1, PAL.steel);
    b.box(px, 2, -3, 1, 12, 1, PAL.steel);
  }
  b.box(-14, 14, -8, 28, 1, 6, PAL.steel); // truss
  for (let i = -12; i < 12; i += 4) b.box(i, 13, -5, 1, 1, 1, PAL.yellow); // spotlights
  b.box(-11, 2, -7, 22, 11, 1, PAL.rubber); // screen frame
  for (const sx of [-16, 14]) {
    for (let k = 0; k < 3; k++) b.box(sx, k * 2, -2, 2, 2, 2, k % 2 ? PAL.rubber : '#1d1d1d'); // speakers
  }
  const tiles: THREE.Vector3[] = [];
  for (let i = 0; i < 10; i++)
    for (let j = 0; j < 5; j++)
      tiles.push(new THREE.Vector3(x - 10 + i * 2 + 1, 3 + j * 2 + 1, z - 5.9));
  return tiles;
}

/** A flag pole; returns the pole top (the flag itself is animated). */
export function flagPole(b: Builder, x: number, z: number): THREE.Vector3 {
  b.at(x, 0, z);
  b.box(-0.5, 0, -0.5, 1, 9, 1, PAL.steel);
  b.box(-0.4, 9, -0.4, 0.8, 0.5, 0.8, PAL.yellow);
  return new THREE.Vector3(x + 0.5, 8, z);
}

// --- dynamic models -------------------------------------------------------------------------

export type CarKind = 'gt' | 'proto' | 'hatch';

export interface CarModel {
  group: THREE.Group;
  /** Brake lights: bright red while braking. */
  brakes: THREE.MeshBasicMaterial;
}

/** A race car facing +X, centred on its footprint (8 × 4 blocks), with a shadow. */
export function car(body: string, accent: string, kind: CarKind): CarModel {
  const b = new Builder();
  const long = kind === 'hatch' ? 7 : 8;
  const h = long / 2;
  b.shadow(-h, -2, long, 4, 2);
  // Floor, body and wheel arches (the body is wider over the wheels).
  b.box(-h + 0.5, 0.3, -1.6, long - 1, 0.4, 3.2, '#121212');
  b.box(-h, 0.7, -1.5, long, 1.1, 3, body);
  for (const wx of [-h + 0.25, h - 2.25]) {
    b.box(wx, 0.6, -2, 2, 1.2, 0.6, body);
    b.box(wx, 0.6, 1.4, 2, 1.2, 0.6, body);
  }
  // Nose, cabin, roof.
  if (kind === 'proto') {
    b.box(h - 1, 0.7, -1.9, 1, 0.5, 3.8, body); // wide nose
    b.box(-1.5, 1.8, -1, 2.5, 1, 2, PAL.glass);
    b.box(-1.5, 2.8, -0.5, 1.5, 0.3, 1, body); // air intake
    b.box(-h, 1.8, -1.5, 2.5, 0.5, 3, body); // rear deck
  } else {
    const cx = kind === 'hatch' ? -2.5 : -2;
    b.box(cx, 1.8, -1.3, 3, 1, 2.6, PAL.glass);
    b.box(cx + 0.3, 2.8, -1.1, 2.4, 0.3, 2.2, body); // roof
    b.box(cx + 2.9, 1.9, -1.2, 0.2, 0.8, 2.4, PAL.glassLight); // windscreen
  }
  // Livery: stripe, number panels, mirrors.
  b.box(-h, 1.8, -0.3, long, 0.05, 0.6, accent);
  b.box(h - 0.02, 0.9, -0.5, 0.04, 0.7, 1, accent);
  b.box(-0.3, 1.1, 1.51, 1.2, 0.6, 0.05, PAL.white);
  b.box(-0.3, 1.1, -1.56, 1.2, 0.6, 0.05, PAL.white);
  b.box(0.2, 1.9, -1.9, 0.4, 0.3, 0.4, body);
  b.box(0.2, 1.9, 1.5, 0.4, 0.3, 0.4, body);
  // Wheels with rims.
  for (const wx of [-h + 0.5, h - 2]) {
    for (const wz of [-2.1, 1.6]) {
      b.box(wx, 0, wz, 1.5, 1.2, 0.5, PAL.tire);
      b.box(wx + 0.4, 0.3, wz < 0 ? wz - 0.05 : wz + 0.5, 0.7, 0.6, 0.05, PAL.rim);
    }
  }
  // Lights and wing.
  b.box(h - 0.05, 1.1, -1.3, 0.1, 0.4, 0.8, '#fff3c4');
  b.box(h - 0.05, 1.1, 0.5, 0.1, 0.4, 0.8, '#fff3c4');
  if (kind !== 'hatch') {
    b.box(-h + 0.3, 2.1, -1.7, 0.3, 0.9, 0.3, '#151515');
    b.box(-h + 0.3, 2.1, 1.4, 0.3, 0.9, 0.3, '#151515');
    b.box(-h - 0.2, 3, -1.9, 1.3, 0.3, 3.8, accent); // wing
  }
  const group = b.group();
  const brakes = new THREE.MeshBasicMaterial({ color: '#5a1410', side: THREE.DoubleSide });
  const lamp = new Builder(false).box(-0.1, 0, 0, 0.1, 0.4, 0.9, '#ffffff').geometry();
  for (const wz of [-1.4, 0.5]) {
    const m = new THREE.Mesh(lamp, brakes);
    m.position.set(-h - 0.02, 1.1, wz);
    group.add(m);
  }
  return { group, brakes };
}

export interface PersonModel {
  group: THREE.Group;
  legs: [THREE.Mesh, THREE.Mesh];
  arms: [THREE.Mesh, THREE.Mesh];
}

/**
 * A person (3 blocks tall) facing +X: body, head, hair (or a helmet), with legs and arms as
 * separate meshes for the walk. `overalls` dresses a pit crew member in the team colour.
 */
export function person(rand: () => number, overalls?: string): PersonModel {
  const shirt = overalls ?? pick(rand, PAL.shirt);
  const trousers = overalls ?? pick(rand, PAL.trousers);
  const body = new Builder()
    .shadow(-0.5, -0.5, 1, 1, 3)
    .box(-0.5, 1, -0.5, 1, 1, 1, shirt)
    .box(-0.5, 2, -0.5, 1, 1, 1, pick(rand, PAL.skin));
  if (overalls)
    body.box(-0.55, 2.55, -0.55, 1.1, 0.5, 1.1, PAL.white); // helmet
  else body.box(-0.5, 2.75, -0.5, 1, 0.25, 1, pick(rand, PAL.hair));
  const group = new THREE.Group();
  group.add(body.mesh());
  const shadow = body.shadowMesh();
  if (shadow) group.add(shadow);
  const limb = (w: number, color: string) =>
    new THREE.Mesh(
      new Builder(false).box(-w / 2, -1, -w / 2, w, 1, w, color).geometry(),
      SHARED_MATERIAL,
    );
  const legs: [THREE.Mesh, THREE.Mesh] = [limb(0.5, trousers), limb(0.5, trousers)];
  legs[0].position.set(0, 1, -0.25);
  legs[1].position.set(0, 1, 0.25);
  const arms: [THREE.Mesh, THREE.Mesh] = [limb(0.3, shirt), limb(0.3, shirt)];
  arms[0].position.set(0, 2, -0.65);
  arms[1].position.set(0, 2, 0.65);
  group.add(...legs, ...arms);
  return { group, legs, arms };
}

/** A hot-air balloon (season colour and lime stripes), with a basket; about 12 tall. */
export function balloon(color: string, accent: string): THREE.Group {
  const b = new Builder(false);
  const rows: [number, number][] = [
    [2, 1],
    [3, 2],
    [4, 3],
    [4, 4],
    [3, 5],
    [2, 6],
    [1, 7],
  ];
  rows.forEach(([r, y], i) => b.box(-r, 3 + y, -r, r * 2, 1, r * 2, i % 2 ? accent : color));
  b.box(-1, 0, -1, 2, 1.2, 2, PAL.trunk); // basket
  b.box(-0.8, 1.2, -0.8, 0.2, 1.8, 0.2, PAL.steelDark); // ropes
  b.box(0.6, 1.2, 0.6, 0.2, 1.8, 0.2, PAL.steelDark);
  return b.group();
}

/** A waving flag on a short stick (marshals). */
export function handFlag(color: string): THREE.Mesh {
  return new THREE.Mesh(
    new Builder(false)
      .box(0, 0, -0.1, 1.4, 1, 0.15, color)
      .box(-0.1, -0.8, -0.1, 0.15, 1.8, 0.15, PAL.steelDark)
      .geometry(),
    SHARED_MATERIAL,
  );
}

// --- the logo ---------------------------------------------------------------------------------

/** 5×7 block letters for "FORZA PADDOCK". */
const GLYPHS: Record<string, string[]> = {
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
};

/**
 * "FORZA PADDOCK" in giant block letters, built from racing things (owner's choice, 2026-11-10):
 * "FORZA" in red-and-white curb blocks, "PADDOCK" in steel barrier rails with lime stripes.
 * Upright, facing +Z, standing on the ground with its left end at (x, z). One block per pixel.
 */
export function logo(b: Builder, x: number, z: number, accent: string) {
  const cell = 1;
  const lines = ['FORZA', 'PADDOCK'];
  const widest = Math.max(...lines.map((l) => l.length * 6 - 1));
  b.at(x, 0, z);
  b.shadow(-1, -1, widest * cell + 2, 3, 16);
  lines.forEach((word, line) => {
    const offset = Math.floor((widest - (word.length * 6 - 1)) / 2);
    const top = (lines.length - line) * 8 - 1; // rows from the ground up
    [...word].forEach((ch, i) => {
      const glyph = GLYPHS[ch]!;
      glyph.forEach((row, r) => {
        [...row].forEach((on, c) => {
          if (on !== '#') return;
          const px = (offset + i * 6 + c) * cell;
          const py = (top - r) * cell;
          const color =
            line === 0 ? ((r + c + i) % 2 ? PAL.red : PAL.white) : r % 3 === 1 ? accent : PAL.steel;
          b.box(px, py, 0, cell, cell, 1.2, color);
        });
      });
    });
  });
  // A low base so the letters stand on something.
  b.box(-1, 0, -1, widest * cell + 2, 1, 3, PAL.concreteDark);
  return { width: widest * cell, height: 16 * cell };
}
