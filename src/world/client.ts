import type { RouteLayout } from './route';
import { SPOT_NAMES, spotFor } from './spots';
import type { World } from './world';

/**
 * Track mode vs normal mode (ADR-0019), run once per visit (Astro's client router keeps it alive
 * across pages, together with the persisted world canvas).
 *
 * - Track mode: the voxel world in the background; the home page does a lap of the circuit while
 *   scrolling; every other page parks the camera at its own place, and changing page flies the
 *   camera there.
 * - Normal mode: the same site over a still picture of the same place (public/world/<spot>.webp),
 *   with a plain vertical scroll. The 3D code is not even downloaded.
 * The choice lives in localStorage ("fp-mode"); the <head> script applies it before the first
 * paint, and people who ask their system for reduced motion start in normal mode.
 */

const MODE_KEY = 'fp-mode';
const root = document.documentElement;

let world: World | null = null;
let loading: Promise<World | null> | null = null;
let routeLayout: RouteLayout | null = null;
let firstLoad = true;

const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private mode: the choice lasts for this page only */
    }
  },
};

const trackMode = () => root.dataset.mode !== 'normal';

async function getWorld(): Promise<World | null> {
  if (world) return world;
  loading ??= (async () => {
    const container = document.getElementById('world');
    if (!container) return null;
    try {
      const { createWorld } = await import('./world');
      const season = getComputedStyle(root).getPropertyValue('--season').trim() || '#ee5c9c';
      world = createWorld(container, { season });
      if (import.meta.env.DEV) Object.assign(window, { __world: world }); // debugging aid
      return world;
    } catch (error) {
      // No WebGL (or it failed): normal mode for this visit, without saving it as a choice.
      console.warn('[forza-paddock] animated background disabled:', error);
      root.dataset.mode = 'normal';
      return null;
    }
  })();
  return loading;
}

async function apply(animate: boolean) {
  routeLayout?.destroy();
  routeLayout = null;
  const container = document.getElementById('world');
  if (!trackMode() || !container) {
    world?.stop();
    container?.classList.remove('world-on', 'world-home');
    return;
  }
  const w = await getWorld();
  if (!w || !trackMode()) return;
  container.classList.add('world-on');
  w.resize();
  const spot = spotFor(location.pathname);
  container.classList.toggle('world-home', spot === 'home');
  if (spot === 'home') {
    w.follow(0, animate);
    routeLayout = (await import('./route')).layoutRoute(w);
  } else {
    w.park(spot, animate);
    w.setScroll(window.scrollY);
  }
  w.start();
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('snapshots'))
    void snapshots(w);
}

/**
 * Dev only (`?snapshots`): renders every spot and saves it to public/world/<spot>.webp through
 * the dev server (astro.config.mjs), for normal mode's still backgrounds.
 */
async function snapshots(w: World) {
  for (const spot of SPOT_NAMES) {
    const data = w.snapshot(spot, 1920, 1080);
    await fetch('/__world-snapshot', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: spot, data }),
    });
  }
  console.info('[forza-paddock] snapshots saved to public/world/');
}

function setMode(mode: 'track' | 'normal') {
  root.dataset.mode = mode;
  store.set(MODE_KEY, mode);
}

// Menu button: switch between track mode and normal mode.
document.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement | null)?.closest('[data-mode-toggle]');
  if (!button) return;
  setMode(trackMode() ? 'normal' : 'track');
  window.scrollTo(0, 0);
  void apply(false);
});

// Parked pages drift slightly with the scroll.
window.addEventListener(
  'scroll',
  () => {
    if (world && trackMode() && !routeLayout) world.setScroll(window.scrollY);
  },
  { passive: true },
);

document.addEventListener('astro:before-swap', () => {
  routeLayout?.destroy();
  routeLayout = null;
});

document.addEventListener('astro:page-load', () => {
  void apply(!firstLoad);
  firstLoad = false;
});
