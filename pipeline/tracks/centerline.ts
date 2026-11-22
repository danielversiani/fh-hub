/**
 * The middle of a route, read from its route picture (the game map with the route drawn as a thick
 * cyan line, as published by labsgg.com; ADR-0023). Pure functions over a raw RGBA buffer, so they
 * run without the network or sharp in tests.
 */

export interface Picture {
  width: number;
  height: number;
  /** RGBA, row by row. */
  data: Uint8Array | Uint8ClampedArray | Buffer;
}

type P = [number, number];

const isCyan = (r: number, g: number, b: number) => r < 120 && g > 170 && b > 190 && b - r > 90;
const isWhite = (r: number, g: number, b: number) => r > 215 && g > 215 && b > 215;

/**
 * Pixels of the route line. The direction arrow is painted white over the line, so white pixels
 * count too when cyan surrounds them (the arrow), but not the white of map labels elsewhere.
 */
export function routeMask(pic: Picture): Uint8Array {
  const { width: w, height: h, data } = pic;
  const cyan = new Uint8Array(w * h);
  const white = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const [r, g, b] = [data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!];
    if (isCyan(r, g, b)) cyan[i] = 1;
    else if (isWhite(r, g, b)) white[i] = 1;
  }
  const mask = cyan.slice();
  for (const blob of arrowBlobs(white, cyan, w, h)) for (const i of blob) mask[i] = 1;
  return close(mask, w, h, 3);
}

/** Small white blobs on the cyan line: the direction arrow (map labels do not touch it). */
function arrowBlobs(white: Uint8Array, cyan: Uint8Array, w: number, h: number): number[][] {
  const seen = new Uint8Array(w * h);
  const out: number[][] = [];
  for (let s = 0; s < w * h; s++) {
    if (!white[s] || seen[s]) continue;
    const blob: number[] = [];
    let touches = false;
    const stack = [s];
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      blob.push(i);
      const x = i % w;
      const y = (i - x) / w;
      // The arrow has a thin dark outline, so cyan counts within 3 px.
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          if (cyan[j]) touches = true;
          if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && white[j] && !seen[j]) {
            seen[j] = 1;
            stack.push(j);
          }
        }
    }
    if (touches && blob.length >= 15 && blob.length < 800) out.push(blob);
  }
  return out;
}

/** Morphological closing (dilate then erode) with a square of radius r. */
function close(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const pass = (src: Uint8Array, want: number) => {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let hit = want === 1 ? 0 : 1;
        for (let dy = -r; dy <= r && hit !== want; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            const v = xx < 0 || yy < 0 || xx >= w || yy >= h ? 0 : src[yy * w + xx]!;
            if (v === want) {
              hit = want;
              break;
            }
          }
        }
        out[y * w + x] = hit;
      }
    }
    return out;
  };
  return pass(pass(mask, 1), 0);
}

/** Zhang–Suen thinning: the line becomes one pixel wide, along its middle. */
export function thin(mask: Uint8Array, w: number, h: number): Uint8Array {
  const m = mask.slice();
  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= w || y >= h ? 0 : (m[y * w + x] as number);
  let changed = true;
  while (changed) {
    changed = false;
    for (const step of [0, 1]) {
      const kill: number[] = [];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (!m[y * w + x]) continue;
          const n = [
            at(x, y - 1),
            at(x + 1, y - 1),
            at(x + 1, y),
            at(x + 1, y + 1),
            at(x, y + 1),
            at(x - 1, y + 1),
            at(x - 1, y),
            at(x - 1, y - 1),
          ];
          const b = n.reduce((s, v) => s + v, 0);
          if (b < 2 || b > 6) continue;
          let a = 0;
          for (let i = 0; i < 8; i++) if (!n[i] && n[(i + 1) % 8]) a++;
          if (a !== 1) continue;
          const [p2, , p4, , p6, , p8] = n;
          if (step === 0 ? p2! * p4! * p6! || p4! * p6! * p8! : p2! * p4! * p8! || p2! * p6! * p8!)
            continue;
          kill.push(y * w + x);
        }
      }
      for (const i of kill) m[i] = 0;
      if (kill.length) changed = true;
    }
  }
  return m;
}

/**
 * The longest closed loop (circuit) or longest path (sprint) through the thinned line, as ordered
 * pixels. Short spurs left by the thinning are dropped by keeping only the main loop/path.
 */
export function traceLine(skel: Uint8Array, w: number, h: number, closed: boolean): P[] {
  const nodes: number[] = [];
  for (let i = 0; i < w * h; i++) if (skel[i]) nodes.push(i);
  const set = new Set(nodes);
  const nbrs = (i: number) => {
    const x = i % w;
    const y = (i - x) / w;
    const out: number[] = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h && set.has(yy * w + xx)) out.push(yy * w + xx);
      }
    return out;
  };
  // Prune spurs: repeatedly remove end points (one neighbour) — a loop has none.
  if (closed) {
    let ends = nodes.filter((i) => nbrs(i).length <= 1);
    while (ends.length) {
      for (const i of ends) set.delete(i);
      ends = [...set].filter((i) => nbrs(i).length <= 1);
    }
  }
  const left = [...set];
  if (!left.length) return [];
  // BFS distances give the farthest point; for a sprint walk from one end to the other.
  const bfs = (start: number) => {
    const prev = new Map<number, number>([[start, -1]]);
    const queue = [start];
    let last = start;
    while (queue.length) {
      const i = queue.shift()!;
      last = i;
      for (const j of nbrs(i)) {
        if (!prev.has(j)) {
          prev.set(j, i);
          queue.push(j);
        }
      }
    }
    return { prev, last };
  };
  const toP = (i: number): P => [i % w, Math.floor(i / w)];
  if (!closed) {
    const a = bfs(left[0]!).last;
    const { prev, last } = bfs(a);
    const path: P[] = [];
    for (let i = last; i !== -1; i = prev.get(i)!) path.push(toP(i));
    return path.reverse();
  }
  // Loop: walk along neighbours, always to the unvisited one that keeps the heading straightest.
  const start = left.reduce((a, b) => (nbrs(a).length <= nbrs(b).length ? a : b));
  const seen = new Set([start]);
  const path = [start];
  let cur = start;
  for (;;) {
    const options = nbrs(cur).filter((j) => !seen.has(j));
    if (!options.length) break;
    const prev = path.length > 1 ? path[path.length - 2]! : undefined;
    const hx = prev === undefined ? 0 : (cur % w) - (prev % w);
    const hy = prev === undefined ? 0 : Math.floor(cur / w) - Math.floor(prev / w);
    options.sort((a, b) => {
      const score = (j: number) => {
        const dx = (j % w) - (cur % w);
        const dy = Math.floor(j / w) - Math.floor(cur / w);
        return (
          -(dx * hx + dy * hy) / Math.hypot(dx, dy) +
          (Math.abs(dx) + Math.abs(dy) === 1 ? -0.01 : 0)
        );
      };
      return score(a) - score(b);
    });
    cur = options[0]!;
    seen.add(cur);
    path.push(cur);
  }
  return path.map(toP);
}

/**
 * The direction arrow (the white blob on the line): where it sits along the traced line and
 * whether travel follows the line's order (+1) or runs against it (−1). The arrow is a triangle
 * across the line, so its narrow end along the line is the tip.
 */
export function findArrow(
  pic: Picture,
  mask: Uint8Array,
  line: readonly P[],
): { index: number; sign: 1 | -1 } | undefined {
  const { width: w, height: h, data } = pic;
  const pts: P[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (mask[i] && isWhite(data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!)) pts.push([x, y]);
    }
  if (pts.length < 15 || line.length < 10) return undefined;
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  let index = 0;
  line.forEach((p, i) => {
    const q = line[index]!;
    if (Math.hypot(p[0] - cx, p[1] - cy) < Math.hypot(q[0] - cx, q[1] - cy)) index = i;
  });
  const a = line[(index - 5 + line.length) % line.length]!;
  const b = line[(index + 5) % line.length]!;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const t: P = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  const along = pts.map((p) => ({
    u: (p[0] - cx) * t[0] + (p[1] - cy) * t[1],
    v: -(p[0] - cx) * t[1] + (p[1] - cy) * t[0],
  }));
  const span = (keep: (u: number) => boolean) => {
    const vs = along.filter((q) => keep(q.u)).map((q) => q.v);
    return vs.length ? Math.max(...vs) - Math.min(...vs) : 0;
  };
  const uMax = Math.max(...along.map((q) => q.u));
  const uMin = Math.min(...along.map((q) => q.u));
  const ahead = span((u) => u > uMax * 0.5);
  const behind = span((u) => u < uMin * 0.5);
  return { index, sign: ahead < behind ? 1 : -1 };
}
