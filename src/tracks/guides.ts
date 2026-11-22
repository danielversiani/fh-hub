import * as THREE from 'three';
import type { TrackLines, TrackScene } from '../../pipeline/schema/entities';

/**
 * What the racing-line guides add to a route model (ADR-0021): the checkpoint flags (the aiming
 * references of the game), the lines painted on the road and the aiming arrows, like the
 * reference videos the owner picked.
 */

/** A point of the road every few metres (from the route model). */
export interface RoadFrame {
  s: number;
  p: THREE.Vector3;
  /** Horizontal unit vector to the left of the direction of travel. */
  left: THREE.Vector3;
  /** Road tilt (rad), + = left edge higher. */
  tilt: number;
  width: number;
}

const nearest = (frames: readonly RoadFrame[], s: number) => {
  const step = frames.length > 1 ? frames[1]!.s - frames[0]!.s : 1;
  return frames[Math.min(frames.length - 1, Math.max(0, Math.round(s / step)))]!;
};

/** A point on the road surface at lateral offset `off` (m, + = left), raised by `lift`. */
const onRoad = (f: RoadFrame, off: number, lift = 0) => {
  const q = f.p.clone().addScaledVector(f.left, off);
  q.y += Math.tan(f.tilt) * off + lift;
  return q;
};

/**
 * Lateral positions (racing lines, the recorded lap) go from −1 to +1: the car's centre against the
 * right or left edge, which is this far (m) inside the edge.
 */
export const CAR_EDGE = 1.3;

/** Lateral position (−1 right edge … +1 left edge) → metres from the middle. */
const lateral = (f: RoadFrame, pos: number) => pos * (f.width / 2 - CAR_EDGE);

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function textSprite(text: string, color: string, background: string, height: number) {
  const font = 'bold 44px "Barlow Condensed", sans-serif';
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = font;
  const w = Math.ceil(probe.measureText(text).width) + 36;
  const map = canvasTexture(w, 64, (g) => {
    g.fillStyle = background;
    g.fillRect(0, 0, w, 64);
    g.font = font;
    g.fillStyle = color;
    g.textBaseline = 'middle';
    g.fillText(text, 18, 34);
  });
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false }));
  sprite.scale.set((height * w) / 64, height, 1);
  sprite.renderOrder = 10;
  return sprite;
}

// --- checkpoints ---------------------------------------------------------------------------

/** The green checkpoint banner with black chevrons, as in the game. */
const flagTexture = () =>
  canvasTexture(64, 256, (g) => {
    g.fillStyle = '#9be22d';
    g.fillRect(0, 0, 64, 256);
    g.fillStyle = '#111';
    for (const y of [40, 80, 120]) {
      g.beginPath();
      g.moveTo(8, y + 18);
      g.lineTo(32, y - 6);
      g.lineTo(56, y + 18);
      g.lineTo(56, y + 30);
      g.lineTo(32, y + 6);
      g.lineTo(8, y + 30);
      g.closePath();
      g.fill();
    }
    g.fillStyle = '#e7f7c9';
    g.fillRect(0, 200, 64, 56);
  });

export function checkpointFlags(
  frames: readonly RoadFrame[],
  checkpoints: TrackScene['checkpoints'],
  root: THREE.Group,
  numbered = true,
) {
  const banner = new THREE.MeshStandardMaterial({
    map: flagTexture(),
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  const pole = new THREE.MeshStandardMaterial({ color: '#d9d9d6', metalness: 0.4, roughness: 0.5 });
  const marker = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 });
  checkpoints.forEach((cp, i) => {
    const f = nearest(frames, cp.at);
    const facing = Math.atan2(-f.left.z, f.left.x) + Math.PI;
    for (const [side, extra] of [
      [1, cp.left ?? 0],
      [-1, cp.right ?? 0],
    ] as const) {
      const base = onRoad(f, side * (f.width / 2 + 0.9 + extra));
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 6.4, 8), pole);
      p.position.copy(base).setY(base.y + 3.2);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 4.6), banner);
      b.position
        .copy(base)
        .addScaledVector(f.left, side * 0.65)
        .setY(base.y + 3.9);
      b.rotation.y = facing;
      p.castShadow = b.castShadow = true;
      root.add(p, b);
    }
    // The game's floating marker: a thin line down to the road and the checkpoint's number
    // (left out while only some checkpoints are placed: the numbers would be wrong).
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 12, 6), marker);
    line.position.copy(onRoad(f, 0, 8));
    root.add(line);
    if (numbered) {
      const label = textSprite(`CP${i + 1}`, '#0d0d0d', '#f2f2ee', 2.6);
      label.position.copy(onRoad(f, 0, 14));
      root.add(label);
    }
  });
}

// --- racing lines --------------------------------------------------------------------------

/**
 * The line's lateral position between its points. `ease` (hand-written lines, few points) eases in
 * and out of each point, so the line holds there; `spline` (computed lines, a point every 10 m)
 * runs a smooth curve through them — easing there would make a staircase of small waves.
 */
export function positionAt(
  points: readonly { at: number; pos: number }[],
  s: number,
  mode: 'ease' | 'spline' = 'ease',
): number {
  if (s <= points[0]!.at) return points[0]!.pos;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (s <= b.at) {
      const t = (s - a.at) / Math.max(1e-6, b.at - a.at);
      if (mode === 'ease') return a.pos + (b.pos - a.pos) * ((1 - Math.cos(Math.PI * t)) / 2);
      const p0 = points[Math.max(0, i - 2)]!.pos;
      const p3 = points[Math.min(points.length - 1, i + 1)]!.pos;
      const [p1, p2] = [a.pos, b.pos];
      return (
        0.5 *
        (2 * p1 +
          (-p0 + p2) * t +
          (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
          (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
      );
    }
  }
  return points[points.length - 1]!.pos;
}

function ribbon(
  frames: readonly RoadFrame[],
  line: TrackLines['lines'][number],
  length: number,
  layer: number,
): THREE.Mesh {
  const from = line.from ?? 0;
  const to = line.to ?? length;
  const colors = line.colors.map((c) => new THREE.Color(c));
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const half = 1.25;
  const span = frames.filter((f) => f.s >= from && f.s <= to);
  span.forEach((f, i) => {
    const off = lateral(f, positionAt(line.points, f.s, line.interpolation));
    // Each line a few centimetres above the previous one, so overlaps do not flicker.
    const a = onRoad(f, off - half, 0.06 + layer * 0.04);
    const b = onRoad(f, off + half, 0.06 + layer * 0.04);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    // Colour along the line, through the given colours.
    const u = span.length > 1 ? i / (span.length - 1) : 0;
    const k = Math.min(colors.length - 1.0001, u * (colors.length - 1));
    const c = colors[Math.floor(k)]!.clone().lerp(colors[Math.ceil(k)]!, k - Math.floor(k));
    col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    if (i > 0) {
      const v = i * 2;
      idx.push(v - 2, v, v - 1, v - 1, v, v + 1);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  const m = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4 - layer,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.renderOrder = 2 + layer;
  return mesh;
}

const MARK_COLORS = { best: '#c9f227', good: '#3ee07a', ok: '#ff9a2e', avoid: '#ff4b2b' } as const;

/** A big arrow pointing down at the road, or a ✓ / ✗, like the reference videos. */
function mark(kind: TrackLines['marks'][number]['kind']): THREE.Object3D {
  const g = new THREE.Group();
  const color = MARK_COLORS[kind];
  if (kind === 'good' || kind === 'ok') {
    const material = new THREE.MeshBasicMaterial({ color });
    const head = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.6, 4), material);
    head.rotation.x = Math.PI;
    head.position.y = 0.8;
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.8, 0.25), material);
    shaft.position.y = 3;
    g.add(head, shaft);
  } else {
    const symbol = kind === 'best' ? '✓' : '✕';
    const map = canvasTexture(128, 128, (c) => {
      c.font = 'bold 120px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 10;
      c.strokeStyle = '#1a1a1a';
      c.strokeText(symbol, 64, 70);
      c.fillStyle = color;
      c.fillText(symbol, 64, 70);
    });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false }));
    s.scale.set(3.2, 3.2, 1);
    s.position.y = 2;
    g.add(s);
  }
  return g;
}

/** Builds every line, its marks and notes; returns a group per line id ("" for shared marks). */
export function racingLines(
  frames: readonly RoadFrame[],
  guide: TrackLines,
  length: number,
  root: THREE.Group,
  lang: 'pt-br' | 'en',
): Map<string, THREE.Group> {
  const groups = new Map<string, THREE.Group>();
  const groupOf = (id = '') => {
    let g = groups.get(id);
    if (!g) {
      g = new THREE.Group();
      groups.set(id, g);
      root.add(g);
    }
    return g;
  };
  guide.lines.forEach((line, i) => {
    const g = groupOf(line.id);
    g.add(ribbon(frames, line, length, i));
    // Some lines start hidden (switched on from the page).
    g.visible = line.visible;
  });
  for (const m of guide.marks) {
    const f = nearest(frames, m.at);
    const obj = mark(m.kind);
    obj.position.copy(onRoad(f, lateral(f, m.pos), 1.2));
    groupOf(m.line).add(obj);
  }
  for (const n of guide.notes) {
    const f = nearest(frames, (n.from + n.to) / 2);
    const label = textSprite(n.title[lang], '#f2f2ee', 'rgba(13,13,13,0.85)', 2.4);
    label.position.copy(onRoad(f, 0, 11));
    groupOf(n.line).add(label);
  }
  return groups;
}
