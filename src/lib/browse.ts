import type {
  CarClass,
  Category,
  Difficulty,
  Drivetrain,
  Rarity,
  Surface,
  Tier,
} from '../../pipeline/schema/enums';
import type { LapRef, Localized } from '../../pipeline/schema/entities';
import { loadCars, loadLapTimes, loadMeta, loadSourceStatus, loadTuneIndex, maps } from './data';
import { formatLapTime } from './ui';

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
  /** Stock class and PI (shown as a footnote: tunes change both). */
  cls?: CarClass;
  pi?: number;
  /** Stock drivetrain (Forza Wiki). */
  drivetrain?: Drivetrain;
  /** Photo (Forza Wiki thumbnail, ADR-0013). */
  image?: string;
  rarity?: Rarity;
  /** How to get the car, as slugs of the official list ("autoshow", "wheelspin", "seasonal"…). */
  obtain: string[];
  addOns?: string;
}

export interface BrowseTune {
  id: string;
  car: string;
  code?: string;
  name: string;
  /** The name translated, when the tuner wrote it in Chinese. */
  nameI18n?: Localized;
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
  /** Only a meta-table recommendation (no share code): search the tuner's gamertag in game. */
  fromMeta: boolean;
  difficulty?: Difficulty;
  role?: string;
  /** The meta table's note for this tune, translated (ADR-0014). */
  notes?: Localized;
  laps?: LapRef[];
  sources: string[];
  score: number;
}

export interface BrowseMeta {
  car: string;
  cls: CarClass;
  surface: Surface;
  tier: Tier;
  rank: number;
}

/** A lap time from a time sheet (e.g. LetzeLU's Shirakawa list), shown on the car's builds. */
export interface BrowseLap {
  car: string;
  cls: CarClass;
  track: string;
  time: string;
  driver: string;
  tuner?: string;
}

export interface BrowseData {
  cars: BrowseCar[];
  tunes: BrowseTune[];
  meta: BrowseMeta[];
  laps: BrowseLap[];
  sources: Record<string, { name: string; url: string }>;
}

const TIER_ORDER: readonly Tier[] = ['meta-plus', 'meta', 't0.5', 't1', 't1.5', 't2', 't3'];

let cached: BrowseData | undefined;

export function buildBrowseData(): BrowseData {
  // In `pnpm dev` the data can change under a running server (pnpm sync): rebuild every time.
  if (cached && !import.meta.env.DEV) return cached;
  const { tuners } = maps();
  const tunerName = (id: string) => tuners.get(id)?.displayName ?? id;

  const cars: BrowseCar[] = loadCars().map((c) => ({
    id: c.id,
    name: c.displayName,
    year: c.year,
    make: c.make,
    model: c.model,
    types: c.carTypes,
    cls: c.stock?.class,
    pi: c.stock?.pi,
    drivetrain: c.drivetrain,
    image: c.image,
    rarity: c.rarity,
    obtain: c.acquisition?.methods ?? [],
    addOns: c.addOns,
  }));

  const tunes: BrowseTune[] = loadTuneIndex().map((t) => ({
    id: t.id,
    car: t.carId,
    code: t.shareCode,
    name: t.name,
    nameI18n: t.nameI18n,
    tuner: t.tunerId,
    tunerName: tunerName(t.tunerId),
    cls: t.class,
    surface: t.surface,
    drivetrain: t.drivetrain,
    tires: t.tires,
    tags: t.buildTags,
    cats: (t.categories ?? []).filter((c) => c !== 'meme'),
    tier: t.tier,
    listed: t.tierSource === 'meta-table',
    rank: t.metaRank,
    credited: Boolean(t.credited),
    fromMeta: Boolean(t.fromMeta),
    difficulty: t.difficulty,
    role: t.role,
    notes: t.metaNotesI18n,
    laps: t.lapRefs,
    sources: t.sourceIds,
    score: t.score ?? 0,
  }));

  // Best meta entry per car × class × surface (the build's tier and rank).
  const best = new Map<string, BrowseMeta>();
  for (const m of loadMeta()) {
    const key = `${m.carId}|${m.class}|${m.surface}`;
    const current = best.get(key);
    if (
      !current ||
      TIER_ORDER.indexOf(m.tier) < TIER_ORDER.indexOf(current.tier) ||
      (m.tier === current.tier && m.rank < current.rank)
    ) {
      best.set(key, { car: m.carId, cls: m.class, surface: m.surface, tier: m.tier, rank: m.rank });
    }
  }

  const laps: BrowseLap[] = loadLapTimes().map((l) => ({
    car: l.carId,
    cls: l.class,
    track: l.track,
    time: formatLapTime(l.timeMs).replace(/^0:/, ''),
    driver: l.driver,
    tuner: l.tunerId ? tunerName(l.tunerId) : undefined,
  }));

  const sources = Object.fromEntries(
    loadSourceStatus().map((s) => [s.id, { name: s.name, url: s.url }]),
  );
  cached = { cars, tunes, meta: [...best.values()], laps, sources };
  return cached;
}
