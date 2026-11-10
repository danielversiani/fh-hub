import * as THREE from 'three';
import { Builder, SHARED_MATERIAL, pick, type Turn } from './voxel';

/**
 * The voxel models of the world (ADR-0019): a paddock and a race circuit. All original and
 * generic: no real car, team, sponsor or logo.
 * Units: 1 = one block. Models are built from whole (or half) blocks so they read as clear,
 * chunky shapes over the fine checkered ground, like the owner's reference.
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
  trunk: '#4e3626',
  leaf: ['#1e5c2c', '#257034', '#2f823c'],
  skin: ['#f0c6a0', '#d39b70', '#9a6440', '#6e4428'],
  hair: ['#1b1410', '#3c2414', '#a8743c', '#d8c69a', '#262626'],
  shirt: ['#ececec', '#2f6fe0', '#d9372b', '#f2c200', '#19b8a6', '#ff7a1a', '#8d5cf6', '#2a2a2a'],
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

/** A pit garage, open towards +Z: 12 wide, 10 deep, front at z + 5. */
export function garage(
  b: Builder,
  x: number,
  z: number,
  team: readonly [string, string],
  rand: () => number,
) {
  b.at(x, 0, z);
  b.box(-6, 0, -5, 12, 0.25, 10, PAL.concreteDark);
  b.box(-6, 0, -6, 12, 6, 1, PAL.concrete); // back wall
  b.box(-7, 0, -6, 1, 6, 11, PAL.concrete); // side walls
  b.box(6, 0, -6, 1, 6, 11, PAL.concrete);
  b.box(-7, 6, -6, 14, 1, 11, PAL.steelDark); // roof
  b.box(-7, 5, 5, 14, 1, 1, team[0]); // sign band
  b.box(-7, 5, 5, 2, 1, 1, team[1]);
  // Inside: a tool chest and tyre stacks.
  b.box(-5, 0, -5, 2, 2, 1, PAL.red);
  for (let i = 0; i < 2; i++) {
    const stack = 2 + Math.floor(rand() * 2);
    for (let k = 0; k < stack; k++) b.box(3 + i * 1.5, k, -5, 1, 1, 1, PAL.tire);
  }
}

/** A team truck in the paddock, 18 long, cab towards -X. */
export function truck(b: Builder, x: number, z: number, team: readonly [string, string]) {
  b.at(x, 0, z);
  b.box(-9, 1, -2, 3, 4, 4, team[1]); // cab
  b.box(-9.1, 3, -1.5, 0.2, 1, 3, PAL.glassLight); // windscreen
  b.box(-5, 1, -2, 14, 5, 4, PAL.white); // trailer
  b.box(-5.05, 3, -2.05, 14.1, 1, 4.1, team[0]); // stripe
  for (const wx of [-8, 3, 6]) {
    b.box(wx, 0, -2.5, 2, 1, 1, PAL.tire);
    b.box(wx, 0, 1.5, 2, 1, 1, PAL.tire);
  }
}

/** A hospitality tent. */
export function tent(b: Builder, x: number, z: number, color: string) {
  b.at(x, 0, z);
  for (const [px, pz] of [
    [-3, -3],
    [2, -3],
    [-3, 2],
    [2, 2],
  ] as const)
    b.box(px, 0, pz, 1, 3, 1, PAL.steel);
  b.box(-4, 3, -4, 8, 1, 8, color);
  b.box(-3, 4, -3, 6, 1, 6, color);
  b.box(-1, 0, -1, 2, 1, 2, PAL.white); // table
}

/** A tree: trunk and a cubic canopy. */
export function tree(b: Builder, x: number, z: number, rand: () => number) {
  const h = 2 + Math.floor(rand() * 2);
  const s = rand() < 0.5 ? 3 : 4;
  b.at(x, 0, z);
  b.box(-0.5, 0, -0.5, 1, h, 1, PAL.trunk);
  b.box(-s / 2, h, -s / 2, s, 2, s, pick(rand, PAL.leaf));
  b.box(-s / 2 + 1, h + 2, -s / 2 + 1, s - 2, 1, s - 2, pick(rand, PAL.leaf));
}

/** A wall of tyre stacks, `n` stacks long along local X. */
export function tireWall(b: Builder, x: number, z: number, n: number, turn: Turn = 0) {
  b.at(x, 0, z, turn);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 2; k++) b.box(i, k, 0, 1, 1, 1, (i + k) % 3 === 0 ? PAL.white : PAL.tire);
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
  b.box(-6, 0, 0, 1, 4, 1, PAL.steelDark);
  b.box(5, 0, 0, 1, 4, 1, PAL.steelDark);
  b.box(-7, 4, 0, 14, 4, 1, PAL.rubber);
  for (let i = 0; i < 12; i++) {
    const h = 1 + ((i * 7) % 3);
    b.box(-6 + i, 5, -0.2, 1, h, 1, colors[i % colors.length]!);
  }
}

/** A marshal post (small tower). */
export function marshalPost(b: Builder, x: number, z: number) {
  b.at(x, 0, z);
  b.box(-1, 0, -1, 2, 3, 2, PAL.concrete);
  b.box(-1.5, 3, -1.5, 3, 0.5, 3, PAL.steel);
}

/** The pit wall along X, with the crew stand. */
export function pitWall(b: Builder, x0: number, x1: number, z: number, accent: string) {
  b.at(0, 0, z);
  b.box(x0, 0, 0, x1 - x0, 1, 1, PAL.concreteLight);
  for (let x = x0 + 4; x < x1 - 4; x += 14) b.box(x, 1, 0, 3, 1, 1, accent);
}

/** Grandstand facing -Z: `steps` tiers rising towards +Z. Returns the seat positions. */
export function grandstand(
  b: Builder,
  x: number,
  z: number,
  width: number,
  steps: number,
): THREE.Vector3[] {
  b.at(x, 0, z);
  const seats: THREE.Vector3[] = [];
  for (let k = 0; k < steps; k++) {
    b.box(0, 0, k * 2, width, 1 + k, 2, k % 2 ? PAL.concrete : PAL.concreteDark);
    for (let i = 1; i < width - 1; i += 1.5)
      seats.push(new THREE.Vector3(x + i, 1 + k, z + k * 2 + 1));
  }
  const back = steps * 2;
  b.box(0, 0, back, width, steps + 3, 1, PAL.concreteDark);
  for (let i = 0; i <= width; i += width / 4) b.box(i - 0.5, 0, back, 1, steps + 6, 1, PAL.steel);
  b.box(-1, steps + 6, -1, width + 2, 1, back + 2, PAL.steelDark); // roof
  return seats;
}

/** Start gantry across the track (along Z) at x. Returns the light positions. */
export function gantry(b: Builder, x: number, z0: number, z1: number): THREE.Vector3[] {
  b.at(x, 0, 0);
  b.box(-0.5, 0, z0 - 2, 1, 9, 1, PAL.steel);
  b.box(-0.5, 0, z1 + 1, 1, 9, 1, PAL.steel);
  b.box(-1, 9, z0 - 2, 2, 2, z1 - z0 + 4, PAL.steelDark);
  const mid = (z0 + z1) / 2;
  return [-2, -1, 0, 1, 2].map((i) => new THREE.Vector3(x + 1, 10, mid + i * 1.5));
}

/** Festival stage facing +Z. Returns the screen tile positions (animated). */
export function stage(b: Builder, x: number, z: number): THREE.Vector3[] {
  b.at(x, 0, z);
  b.box(-13, 0, -7, 26, 2, 14, PAL.concreteDark); // platform
  for (const px of [-13, 12]) {
    b.box(px, 2, -7, 1, 12, 1, PAL.steel);
    b.box(px, 2, -3, 1, 12, 1, PAL.steel);
  }
  b.box(-14, 14, -8, 28, 1, 6, PAL.steel); // truss
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
  return new THREE.Vector3(x + 0.5, 8, z);
}

// --- dynamic models -------------------------------------------------------------------------

export type CarKind = 'gt' | 'proto' | 'hatch';

/** A car facing +X, centred on its footprint (7 × 3 blocks, 2–3 tall). */
export function car(body: string, accent: string, kind: CarKind): THREE.Mesh {
  const b = new Builder();
  const long = kind === 'hatch' ? 6 : 7;
  const h = long / 2;
  b.box(-h, 0.5, -1.5, long, 1, 3, body); // body
  b.box(-h + 0.5, 0.25, -1.5, long - 1, 0.25, 3, '#121212'); // floor shadow line
  if (kind === 'proto') {
    b.box(-1, 1.5, -1, 2, 1, 2, PAL.glass);
    b.box(-h, 1.5, -1.5, 2, 0.5, 3, body);
  } else {
    const [cx, cw] = kind === 'hatch' ? [-2, 3] : [-2, 3];
    b.box(cx, 1.5, -1.25, cw, 1, 2.5, PAL.glass);
    b.box(cx, 2.5, -1.25, cw, 0.25, 2.5, body);
  }
  b.box(-h, 1.5, -0.25, long, 0.01, 0.5, accent); // stripe on the bonnet and roof line
  b.box(-h - 0.01, 0.75, -0.5, 0.02, 0.5, 1, accent);
  // Wheels: one block at each corner.
  for (const wx of [-h + 0.5, h - 1.5]) {
    b.box(wx, 0, -1.75, 1, 1, 0.5, PAL.tire);
    b.box(wx, 0, 1.25, 1, 1, 0.5, PAL.tire);
  }
  b.box(h - 0.05, 1, -1.25, 0.1, 0.5, 0.75, '#fff3c4'); // headlights
  b.box(h - 0.05, 1, 0.5, 0.1, 0.5, 0.75, '#fff3c4');
  if (kind !== 'hatch') b.box(-h, 2, -1.5, 1, 0.25, 3, accent); // wing
  return b.mesh();
}

/** A person (3 blocks tall) facing +X; legs are separate meshes for the walk. */
export function person(rand: () => number): { group: THREE.Group; legs: [THREE.Mesh, THREE.Mesh] } {
  const shirt = pick(rand, PAL.shirt);
  const trousers = pick(rand, ['#22252b', '#3a3a3a', '#26324a', '#4a3a2a']);
  const body = new Builder()
    .box(-0.5, 1, -0.5, 1, 1, 1, shirt)
    .box(-0.5, 2, -0.5, 1, 1, 1, pick(rand, PAL.skin))
    .box(-0.5, 2.75, -0.5, 1, 0.25, 1, pick(rand, PAL.hair));
  const group = new THREE.Group();
  group.add(body.mesh());
  const leg = () =>
    new THREE.Mesh(
      new Builder().box(-0.25, -1, -0.25, 0.5, 1, 0.5, trousers).geometry(),
      SHARED_MATERIAL,
    );
  const left = leg();
  const right = leg();
  left.position.set(0, 1, -0.25);
  right.position.set(0, 1, 0.25);
  group.add(left, right);
  return { group, legs: [left, right] };
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
