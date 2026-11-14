import type { World } from './world';

/**
 * Home page in track mode (ADR-0019): the page scrolls along a lap of the circuit.
 *
 * - The manifesto and the footer ([data-stop="hero"|"footer"]) are fixed boxes too: the manifesto
 *   shows at the start next to the logo, the footer only at the very end. Any other [data-stop]
 *   is a board laid along the route.
 * - Panels ([data-source] for each reference list, [data-panel] for the playlist) show in a fixed
 *   "timing tower" (owner's choice among three versions, 2026-11-10): the list scrolls inside it
 *   while the camera keeps lapping the circuit. Above the tower, the section's header ([data-cap]:
 *   "What's new in the reference lists", "Festival Playlist") stays fixed while its panels show.
 *   Desktop: a column on the left. Phones: centred on the screen.
 * A native scroll runs underneath (scroll bar, touch, keyboard all work); only the drawing moves.
 */

const WIDTH: Record<string, number> = { hero: 520, footer: 620 };
const GAP = 64;
/** Scroll (px) before a list starts moving, and the pause at its end before the next list. */
const LEAD_IN = 120;
const END_PAUSE = 520;
/** Boards drift down-right a little, so the end of the lap never lands on the first boards. */
const DRIFT = { x: 0.42, y: 0.23 };
/** One colour per source (garage sign and tower band); the playlist uses the season colour. */
const SOURCE_COLORS = [
  '#d9372b',
  '#2f6fe0',
  '#caff02',
  '#ff7a1a',
  '#19b8a6',
  '#8d5cf6',
  '#f2c200',
  '#ececec',
];

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Unit =
  { kind: 'board'; el: HTMLElement } | { kind: 'panel'; el: HTMLElement; cap: HTMLElement | null };

interface Segment {
  unit: Unit;
  s0: number;
  s1: number;
  /** Board centre on the plane. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Panels: how far the list scrolls inside the tower. */
  scroll: number;
}

export interface RouteLayout {
  destroy(): void;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export function layoutRoute(world: World): RouteLayout {
  const root = document.documentElement;
  const main = document.querySelector('main');
  const footer = document.querySelector<HTMLElement>('body > footer');
  if (!main) return { destroy() {} };

  // The footer travels too, as the last board.
  const footerHome = footer ? { parent: footer.parentElement!, next: footer.nextSibling } : null;
  if (footer) {
    footer.dataset.stop = 'footer';
    main.appendChild(footer);
  }

  const sources = [...main.querySelectorAll<HTMLElement>('[data-source]')];
  const caps = [...main.querySelectorAll<HTMLElement>('[data-cap]')];
  const units: Unit[] = [
    ...main.querySelectorAll<HTMLElement>(
      '[data-stop]:not([data-source] [data-stop], [data-panel] [data-stop]), [data-source], [data-panel]',
    ),
  ].map((el) =>
    el.dataset.source === undefined && el.dataset.panel === undefined
      ? { kind: 'board', el }
      : {
          kind: 'panel',
          el,
          cap: el.closest('section')?.querySelector<HTMLElement>('[data-cap]') ?? null,
        },
  );
  // Wrappers collapse (display: contents); anything else in <main> is hidden.
  const wraps = new Set<HTMLElement>();
  for (const el of [...units.map((u) => u.el), ...caps]) {
    let p = el.parentElement;
    while (p && p !== main) {
      wraps.add(p);
      p = p.parentElement;
    }
  }
  wraps.forEach((w) => w.classList.add('route-wrap'));
  sources.forEach((el, i) =>
    el.style.setProperty('--src', SOURCE_COLORS[i % SOURCE_COLORS.length]!),
  );
  units.forEach(({ el }) => el.querySelectorAll('img').forEach((img) => (img.loading = 'eager')));
  root.classList.add('route-on');
  world.setHome(
    sources.map((el, i) => ({
      name: el.dataset.sourceName ?? '',
      color: SOURCE_COLORS[i % SOURCE_COLORS.length]!,
    })),
  );

  let segments: Segment[] = [];
  let total = 0;
  let path: { s: number; x: number; y: number }[] = [{ s: 0, x: 0, y: 0 }];
  let raf = 0;
  /** Current shift of <main>: fixed boxes inside it must cancel it. */
  let shift = { x: 0, y: 0 };

  const vw = () => window.innerWidth;
  const vh = () => window.innerHeight;
  const narrow = () => vw() < 700;
  const headerH = () => parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) || 64;
  const anchor = () => ({ x: vw() / 2, y: vh() * 0.48 });

  /** The tower's whole area (header included): left column, or centred on phones. */
  const towerArea = (): Box => {
    const top = headerH() + 16;
    if (narrow()) {
      const h = Math.min(vh() * 0.7, vh() - top - 16);
      return { x: 16, y: top + (vh() - top - 16 - h) / 2, w: vw() - 32, h };
    }
    // Wide enough for legible cards with photos (owner, 2026-11-14).
    return { x: 24, y: top, w: Math.min(720, Math.max(440, vw() * 0.46)), h: vh() - top - 24 };
  };
  const capHeight = new Map<HTMLElement, number>();
  /** The list part of the tower, under its section header. */
  const towerBox = (cap: HTMLElement | null): Box => {
    const a = towerArea();
    const c = cap ? (capHeight.get(cap) ?? 0) : 0;
    return { x: a.x, y: a.y + c, w: a.w, h: a.h - c };
  };

  const layout = () => {
    const area = towerArea();
    for (const cap of caps) {
      cap.style.width = `${area.w}px`;
      capHeight.set(cap, cap.offsetHeight);
    }
    // 1. Size and measure every unit.
    const sizes = units.map((unit) => {
      const { el } = unit;
      el.style.transform = '';
      if (unit.kind === 'board') {
        const w = Math.min(vw() - 32, narrow() ? 560 : (WIDTH[el.dataset.stop ?? 'footer'] ?? 560));
        el.style.width = `${w}px`;
        return { w: el.offsetWidth, h: el.offsetHeight, box: null };
      }
      const box = towerBox(unit.cap);
      el.style.width = `${box.w}px`;
      el.style.height = `${box.h}px`;
      const content = [...el.children].reduce(
        (sum, c) => sum + (c as HTMLElement).offsetHeight + 16,
        0,
      );
      return { w: box.w, h: content + 48, box };
    });

    // 2. Lay the units along the route (the camera moves evenly along the lap).
    const dirAt = (s: number, end: number) => {
      const d = world.routeDirection(clamp01(s / Math.max(1, end)));
      const dx = d.x + DRIFT.x;
      const dy = d.y + DRIFT.y;
      const n = Math.hypot(dx, dy);
      return { x: dx / n, y: dy / n };
    };
    const pass = (end: number) => {
      const segs: Segment[] = [];
      const pts = [{ s: 0, x: 0, y: 0 }];
      let s = 0;
      let x = 0;
      let y = 0;
      units.forEach((unit, i) => {
        const { w, h, box } = sizes[i]!;
        const u = dirAt(s, end);
        if (unit.kind === 'board') {
          const extra = unit.el.dataset.stop === 'hero' ? vh() * 0.9 : 0;
          const advance = Math.abs(u.x) * w + Math.abs(u.y) * h + extra;
          const first = segs.length === 0;
          const cx = x + (first ? 0 : (u.x * advance) / 2);
          const cy = y + (first ? 0 : (u.y * advance) / 2);
          const step = (first ? advance / 2 : advance) + GAP;
          segs.push({ unit, s0: s, s1: s + step, x: cx, y: cy, w, h, scroll: 0 });
          x += u.x * step;
          y += u.y * step;
          s += step;
        } else {
          // The list scrolls inside the tower while the page moves along an empty stretch of road.
          const scroll = Math.max(0, h - box!.h);
          // A short lead-in, the list, then a pause at its end before the next one (owner, 2026-11-10).
          const step = scroll + LEAD_IN + END_PAUSE;
          segs.push({ unit, s0: s, s1: s + step, x, y, w, h, scroll });
          x += u.x * step;
          y += u.y * step;
          s += step;
        }
        pts.push({ s, x, y });
      });
      return { segs, pts, end: s };
    };
    const first = pass(20000);
    const result = pass(first.end);
    segments = result.segs;
    path = result.pts;
    total = result.end;

    // 3. Place the boards (the tower is placed on every update).
    for (const seg of segments) {
      if (seg.unit.kind !== 'board' || fixedBoard(seg.unit.el)) continue;
      seg.unit.el.style.transform = `translate(${Math.round(seg.x - seg.w / 2)}px, ${Math.round(seg.y - seg.h / 2)}px)`;
    }
    document.body.style.minHeight = `${total + vh()}px`;
    update();
  };

  const pathAt = (s: number) => {
    if (s <= 0) return path[0]!;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      if (s <= b.s) {
        const t = b.s === a.s ? 1 : (s - a.s) / (b.s - a.s);
        return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
      }
    }
    return path[path.length - 1]!;
  };

  const fixedBoard = (el: HTMLElement) =>
    el.dataset.stop === 'hero' || el.dataset.stop === 'footer';
  /** Manifesto: left column on wide screens, centred under the logo on phones. Footer: bottom. */
  const fixedBox = (el: HTMLElement): Box => {
    const w = Math.min(vw() - 32, el.dataset.stop === 'hero' ? 520 : 620);
    const h = el.offsetHeight;
    if (el.dataset.stop === 'footer') return { x: (vw() - w) / 2, y: vh() - h - 24, w, h };
    if (vw() < 1100) return { x: (vw() - w) / 2, y: Math.max(headerH() + 16, vh() * 0.46), w, h };
    const top = headerH() + 16;
    return { x: 32, y: top + (vh() - top - h) / 2, w, h };
  };

  /** Position a fixed box (inside the moving <main>, so the shift is cancelled). */
  const place = (el: HTMLElement, box: Box, show: number) => {
    el.classList.toggle('is-active', show > 0.02);
    el.style.opacity = String(show);
    el.style.left = `${Math.round(box.x - shift.x)}px`;
    el.style.top = `${Math.round(box.y - shift.y)}px`;
    el.style.width = `${Math.round(box.w)}px`;
  };

  /** The tower: which panel shows, how far its list has scrolled, and its section header. */
  const placeTower = (s: number) => {
    const fade = 160;
    for (const seg of segments) {
      if (seg.unit.kind !== 'panel') continue;
      const { el, cap } = seg.unit;
      const show = Math.min(clamp01((s - seg.s0 + fade) / fade), clamp01((seg.s1 - s) / fade));
      const box = towerBox(cap);
      place(el, box, show);
      el.style.height = `${Math.round(box.h)}px`;
      const into = clamp01((s - seg.s0 - LEAD_IN) / Math.max(1, seg.scroll));
      el.style.setProperty('--news-scroll', `${-Math.round(into * seg.scroll)}px`);
    }
    // Manifesto from the start, footer at the very end.
    for (const seg of segments) {
      if (seg.unit.kind !== 'board' || !fixedBoard(seg.unit.el)) continue;
      const el = seg.unit.el;
      const show =
        el.dataset.stop === 'hero'
          ? clamp01((seg.s1 - s) / fade)
          : clamp01((s - seg.s0 + fade) / fade);
      place(el, fixedBox(el), show);
    }
    // Each section header shows from its first panel to its last, without blinking in between.
    for (const cap of caps) {
      const panels = segments.filter((q) => q.unit.kind === 'panel' && q.unit.cap === cap);
      if (!panels.length) continue;
      const s0 = panels[0]!.s0;
      const s1 = panels[panels.length - 1]!.s1;
      place(cap, towerArea(), Math.min(clamp01((s - s0 + fade) / fade), clamp01((s1 - s) / fade)));
    }
  };

  const update = () => {
    raf = 0;
    const s = Math.min(window.scrollY, total);
    const at = pathAt(s);
    const a = anchor();
    shift = { x: Math.round(a.x - at.x), y: Math.round(a.y - at.y) };
    main.style.transform = `translate3d(${shift.x}px, ${shift.y}px, 0)`;
    world.follow(total ? s / total : 0);
    placeTower(s);
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const progress = total ? window.scrollY / total : 0;
      world.resize();
      layout();
      window.scrollTo(0, progress * total);
    }, 150);
  };
  // Keyboard users: focusing a link brings its unit into view.
  const onFocus = (e: FocusEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>(
      '[data-source], [data-panel], [data-stop]',
    );
    // Only when the unit is off screen: a click inside the visible tower must not jump.
    if (!el || el.classList.contains('is-active')) return;
    const seg = segments.find((q) => q.unit.el === el);
    if (seg) window.scrollTo({ top: (seg.s0 + seg.s1) / 2 });
  };
  // An update opened or closed in the tower: re-measure. Before the panel's own segment nothing
  // changes, so the same scroll keeps the clicked card where it was.
  const onRelayout = () => {
    const y = window.scrollY;
    layout();
    window.scrollTo(0, y);
  };

  layout();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  main.addEventListener('focusin', onFocus);
  window.addEventListener('fp:relayout', onRelayout);
  // Fonts and photos can change heights after the first layout.
  const relayout = () => layout();
  void document.fonts?.ready.then(relayout);
  window.addEventListener('load', relayout, { once: true });

  return {
    destroy() {
      cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('load', relayout);
      main.removeEventListener('focusin', onFocus);
      window.removeEventListener('fp:relayout', onRelayout);
      root.classList.remove('route-on');
      main.style.transform = '';
      document.body.style.minHeight = '';
      wraps.forEach((w) => w.classList.remove('route-wrap'));
      for (const el of [...units.map((u) => u.el), ...caps]) {
        el.classList.remove('is-active');
        for (const prop of ['transform', 'width', 'height', 'left', 'top', 'opacity'] as const)
          el.style[prop] = '';
        el.style.removeProperty('--news-scroll');
        el.style.removeProperty('--src');
      }
      if (footer && footerHome) {
        delete footer.dataset.stop;
        footerHome.parent.insertBefore(footer, footerHome.next);
      }
    },
  };
}
