import type { CarClass, Category, Surface, Tier } from '../../pipeline/schema/enums';
import { loadCars, loadMeta, loadSourceStatus, loadTuneIndex, maps } from './data';

/**
 * Compact data for the tune browser (src/islands/TuneBrowser.tsx) and the car cards. Built once
 * at build time; served as /data/browse.json and also used directly by the car pages.
 */
export interface BrowseCar {
  id: string;
  name: string;
  year: number;
  make: string;
  model: string;
  types: string[];
  cls?: CarClass;
  pi?: number;
  obtain?: string;
  meme: boolean;
}

export interface BrowseTune {
  id: string;
  car: string;
  code?: string;
  name: string;
  tuner: string;
  tunerName: string;
  cls: CarClass | null;
  surface: Surface | null;
  drivetrain?: string;
  tires?: string;
  tags: string[];
  cats: Category[];
  tier?: Tier;
  /** true when the tier comes from the meta table; false = default T3 */
  listed: boolean;
  rank?: number;
  credited: boolean;
  sources: string[];
  score: number;
}

export interface BrowseMeta {
  car: string;
  cls: CarClass;
  surface: Surface;
  tier: Tier;
  rank: number;
  tuners: string[];
}

export interface BrowseData {
  cars: BrowseCar[];
  tunes: BrowseTune[];
  meta: BrowseMeta[];
  sources: Record<string, { name: string; url: string }>;
  memeIds: string[];
}

const TIER_ORDER: readonly Tier[] = ['meta-plus', 'meta', 't0.5', 't1', 't1.5', 't2', 't3'];

let cached: BrowseData | undefined;

export function buildBrowseData(memeIds: readonly string[] = []): BrowseData {
  if (cached) return cached;
  const { tuners } = maps();
  const meme = new Set(memeIds);
  const cars: BrowseCar[] = loadCars().map((c) => ({
    id: c.id,
    name: c.displayName,
    year: c.year,
    make: c.make,
    model: c.model,
    types: c.carTypes,
    cls: c.stock?.class,
    pi: c.stock?.pi,
    obtain: [c.acquisition?.raw, c.addOns].filter(Boolean).join(' · ') || undefined,
    meme: meme.has(c.id),
  }));

  const tunes: BrowseTune[] = loadTuneIndex().map((t) => ({
    id: t.id,
    car: t.carId,
    code: t.shareCode,
    name: t.name,
    tuner: t.tunerId,
    tunerName: tuners.get(t.tunerId)?.displayName ?? t.tunerId,
    cls: t.class,
    surface: t.surface,
    drivetrain: t.drivetrain,
    tires: t.tires,
    tags: t.buildTags,
    cats: t.categories ?? [],
    tier: t.tier,
    listed: t.tierSource === 'meta-table',
    rank: t.metaRank,
    credited: Boolean(t.credited),
    sources: t.sourceIds,
    score: t.score ?? 0,
  }));

  // Best meta entry per car × class × surface.
  const best = new Map<string, BrowseMeta>();
  for (const m of loadMeta()) {
    const key = `${m.carId}|${m.class}|${m.surface}`;
    const current = best.get(key);
    if (
      !current ||
      TIER_ORDER.indexOf(m.tier) < TIER_ORDER.indexOf(current.tier) ||
      (m.tier === current.tier && m.rank < current.rank)
    ) {
      best.set(key, {
        car: m.carId,
        cls: m.class,
        surface: m.surface,
        tier: m.tier,
        rank: m.rank,
        tuners: [
          ...new Set([
            ...(current?.tuners ?? []),
            ...m.tunerIds.map((id) => tuners.get(id)?.displayName ?? id),
          ]),
        ],
      });
    } else {
      current.tuners = [
        ...new Set([
          ...current.tuners,
          ...m.tunerIds.map((id) => tuners.get(id)?.displayName ?? id),
        ]),
      ];
    }
  }

  const sources = Object.fromEntries(
    loadSourceStatus().map((s) => [s.id, { name: s.name, url: s.url }]),
  );
  cached = { cars, tunes, meta: [...best.values()], sources, memeIds: [...meme] };
  return cached;
}
