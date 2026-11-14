import type {
  CarClass,
  Category,
  Difficulty,
  Drivetrain,
  PlatformTier,
  Rarity,
  Surface,
  Tier,
} from '../../pipeline/schema/enums';
import type { LapRef, Localized } from '../../pipeline/schema/entities';
import { loadCars, loadLapTimes, loadRoles, loadSourceStatus, loadTuneIndex, maps } from './data';
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
  rank?: number;
  credited: boolean;
  /** Only a meta-table recommendation (no share code): search the tuner's gamertag in game. */
  fromMeta: boolean;
  difficulty?: Difficulty;
  /** Recommended by the Forza Paddock itself (ADR-0020). */
  recommended?: boolean;
  /** "Cérebro desligado": overpowered and easy (ADR-0018). */
  brainAfk?: 'auto' | 'curator';
  role?: string;
  /** The meta table's note for this tune, translated (ADR-0014). */
  notes?: Localized;
  laps?: LapRef[];
  /** When the tune was published or last updated, if a source says (ISO date). */
  date?: string;
  sources: string[];
  score: number;
}

/** The platform's ranking of a car in a class × surface (ADR-0017): the main ranking. */
export interface BrowseMeta {
  car: string;
  cls: CarClass;
  surface: Surface;
  tier: PlatformTier;
  rank: number;
  /** "Noa Miyako: T0.5", "fhstats: Meta"… */
  evidence: string[];
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

/** Role of a car in a class × surface (formula, ADR-0017): meta, alternative or rivals. */
export interface BrowseRole {
  car: string;
  cls: CarClass;
  surface: Surface;
  role: 'meta' | 'alternative' | 'niche' | 'other';
  tier: PlatformTier;
  rank: number;
  sources: number;
  /** "fhstats: Meta", "Attax Johnson: Allround"… */
  evidence: string[];
  rivalsTop10?: number;
  updated?: string;
  wellKnown?: boolean;
  tags?: ('recent' | 'sleeper' | 'featured' | 'rivals')[];
  /** The platform's comment, in both languages. */
  note?: { 'pt-br': string; en: string };
}

/** Short names of the sources, for the evidence lines. */
const SOURCE_SHORT: Readonly<Record<string, string>> = {
  'noa-miyako': 'Noa Miyako',
  fhstats: 'fhstats',
  logikj: 'LogikJ',
  'attax-johnson': 'Attax Johnson',
  kleis: 'kleis',
};

export interface BrowseData {
  cars: BrowseCar[];
  tunes: BrowseTune[];
  meta: BrowseMeta[];
  laps: BrowseLap[];
  roles: BrowseRole[];
  sources: Record<string, { name: string; url: string }>;
}

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
    rank: t.metaRank,
    credited: Boolean(t.credited),
    fromMeta: Boolean(t.fromMeta),
    difficulty: t.difficulty,
    recommended: t.recommended || undefined,
    brainAfk: t.brainAfk,
    role: t.role,
    notes: t.metaNotesI18n,
    laps: t.lapRefs,
    date: t.createdAt,
    sources: t.sourceIds,
    score: t.score ?? 0,
  }));

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
  const roles: BrowseRole[] = loadRoles().map((r) => ({
    car: r.carId,
    cls: r.class,
    surface: r.surface,
    role: r.role,
    tier: r.tier,
    rank: r.rank,
    sources: r.sources,
    evidence: r.evidence.map((e) => `${SOURCE_SHORT[e.sourceId] ?? e.sourceId}: ${e.label}`),
    rivalsTop10: r.rivalsTop10,
    updated: r.updated,
    wellKnown: r.wellKnown,
    tags: r.tags,
    note: r.note,
  }));
  // The main ranking is the platform's own (ADR-0017), not one source's tier list.
  const meta: BrowseMeta[] = roles.map((r) => ({
    car: r.car,
    cls: r.cls,
    surface: r.surface,
    tier: r.tier,
    rank: r.rank,
    evidence: r.evidence,
  }));
  cached = { cars, tunes, meta, laps, roles, sources };
  return cached;
}
