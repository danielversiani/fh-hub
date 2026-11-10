import * as THREE from 'three';

/**
 * Voxel building blocks for the animated background (ADR-0019).
 *
 * Everything in the world is made of axis-aligned boxes. Each face gets a fixed shade (top
 * brightest, sides darker), so the scene reads like pixel art without any lights: cheap to
 * render and crisp once the canvas is upscaled with nearest-neighbour filtering.
 */

/** Shade of each face, by its normal. */
const SHADE = { top: 1, bottom: 0.4, px: 0.8, nx: 0.6, pz: 0.7, nz: 0.52 } as const;

/** Quarter turns around Y (0–3), so models stay axis-aligned like voxels. */
export type Turn = 0 | 1 | 2 | 3;

/** Collects boxes and turns them into one mesh (one draw call). */
export class Builder {
  private positions: number[] = [];
  private colors: number[] = [];
  private indices: number[] = [];
  private readonly color = new THREE.Color();

  /** Origin and quarter turn applied to the boxes added next (see `at`). */
  private ox = 0;
  private oy = 0;
  private oz = 0;
  private turn: Turn = 0;

  /** Place the next boxes relative to (x, y, z), turned `turn` quarter turns. */
  at(x: number, y: number, z: number, turn: Turn = 0): this {
    this.ox = x;
    this.oy = y;
    this.oz = z;
    this.turn = turn;
    return this;
  }

  /** A box from (x, y, z) with size (w, h, d), in the current local frame. */
  box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: THREE.ColorRepresentation,
  ): this {
    // Rotate the box's corners by the quarter turn, then re-normalise min/max.
    const corners: [number, number][] = [
      [x, z],
      [x + w, z + d],
    ];
    const turned = corners.map(([cx, cz]) => {
      switch (this.turn) {
        case 1:
          return [cz, -cx];
        case 2:
          return [-cx, -cz];
        case 3:
          return [-cz, cx];
        default:
          return [cx, cz];
      }
    });
    const x0 = Math.min(turned[0]![0]!, turned[1]![0]!) + this.ox;
    const x1 = Math.max(turned[0]![0]!, turned[1]![0]!) + this.ox;
    const z0 = Math.min(turned[0]![1]!, turned[1]![1]!) + this.oz;
    const z1 = Math.max(turned[0]![1]!, turned[1]![1]!) + this.oz;
    const y0 = y + this.oy;
    const y1 = y0 + h;
    this.color.set(color);
    const faces: [number[][], number][] = [
      [
        [
          [x0, y1, z0],
          [x0, y1, z1],
          [x1, y1, z1],
          [x1, y1, z0],
        ],
        SHADE.top,
      ],
      [
        [
          [x0, y0, z0],
          [x1, y0, z0],
          [x1, y0, z1],
          [x0, y0, z1],
        ],
        SHADE.bottom,
      ],
      [
        [
          [x1, y0, z0],
          [x1, y1, z0],
          [x1, y1, z1],
          [x1, y0, z1],
        ],
        SHADE.px,
      ],
      [
        [
          [x0, y0, z1],
          [x0, y1, z1],
          [x0, y1, z0],
          [x0, y0, z0],
        ],
        SHADE.nx,
      ],
      [
        [
          [x0, y0, z1],
          [x1, y0, z1],
          [x1, y1, z1],
          [x0, y1, z1],
        ],
        SHADE.pz,
      ],
      [
        [
          [x1, y0, z0],
          [x0, y0, z0],
          [x0, y1, z0],
          [x1, y1, z0],
        ],
        SHADE.nz,
      ],
    ];
    for (const [quad, shade] of faces) {
      const base = this.positions.length / 3;
      for (const v of quad) {
        this.positions.push(v[0]!, v[1]!, v[2]!);
        this.colors.push(this.color.r * shade, this.color.g * shade, this.color.b * shade);
      }
      this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return this;
  }

  get empty(): boolean {
    return this.positions.length === 0;
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    g.setIndex(this.indices);
    return g;
  }

  mesh(material: THREE.Material = SHARED_MATERIAL): THREE.Mesh {
    return new THREE.Mesh(this.geometry(), material);
  }
}

/** One unlit material for every voxel mesh: colours come from the vertices. */
export const SHARED_MATERIAL = new THREE.MeshBasicMaterial({
  vertexColors: true,
  // Both sides: faces are added in a fixed order, not a consistent winding.
  side: THREE.DoubleSide,
});

/** Small deterministic random generator, so the world is the same on every visit. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T>(rand: () => number, list: readonly T[]): T =>
  list[Math.floor(rand() * list.length)]!;
