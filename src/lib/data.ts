import fs from 'node:fs';
import path from 'node:path';
import type {
  Car,
  CarRole,
  ChangeLogEntry,
  ListEntry,
  Highlight,
  LapTime,
  MetaRanking,
  PlaylistEvent,
  PlaylistSeason,
  SourceStatus,
  Suggestion,
  TuneIndexEntry,
  Tuner,
} from '../../pipeline/schema/entities';

/**
 * Build-time data access. Reads data/generated (public) or, with `pnpm dev:preview`,
 * .cache/preview/generated (includes sources still waiting for permission, ADR-0010).
 * Results are memoised: hundreds of pages read the same files during one build.
 */
const DATA_DIR: string = import.meta.env.FH_DATA_DIR ?? 'data/generated';
export const isPreview = DATA_DIR.includes('preview');

const cache = new Map<string, unknown>();

function readItems<T>(file: string): T[] {
  // In `pnpm dev` the data can change under a running server (pnpm sync): never cache there.
  if (import.meta.env.DEV) cache.clear();
  if (cache.has(file)) return cache.get(file) as T[];
  const full = path.resolve(process.cwd(), DATA_DIR, file);
  const items = fs.existsSync(full)
    ? (JSON.parse(fs.readFileSync(full, 'utf8')) as { items: T[] }).items
    : [];
  cache.set(file, items);
  return items;
}

function listDir(dir: string): string[] {
  const full = path.resolve(process.cwd(), DATA_DIR, dir);
  return fs.existsSync(full) ? fs.readdirSync(full).filter((f) => f.endsWith('.json')) : [];
}

export const loadCars = () => readItems<Car>('cars.json');
export const loadTuners = () => readItems<Tuner>('tuners.json');
export const loadTuneIndex = () => readItems<TuneIndexEntry>('tunes/index.json');
export const loadLapTimes = () => readItems<LapTime>('laptimes.json');
export const loadSourceStatus = () => readItems<SourceStatus>('sources-status.json');
export const loadSeasons = () =>
  [...readItems<PlaylistSeason>('playlist/seasons.json')].sort((a, b) => a.order - b.order);
export const loadEvents = (seasonId: string) =>
  readItems<PlaylistEvent>(`playlist/events/${seasonId}.json`);
export const loadSuggestions = (seasonId: string) =>
  readItems<Suggestion>(`playlist/suggestions/${seasonId}.json`);
export const loadMeta = (): MetaRanking[] =>
  listDir('meta').flatMap((f) => readItems<MetaRanking>(`meta/${f}`));

/** One community list (fhstats, LogikJ, Attax Johnson…) as used by the ranking. */
export const loadList = (sourceId: string) => readItems<ListEntry>(`lists/${sourceId}.json`);

/** Every change log entry, newest first. */
export const loadChanges = (): ChangeLogEntry[] =>
  listDir('changelog')
    .flatMap((f) => readItems<ChangeLogEntry>(`changelog/${f}`))
    .sort((a, b) => b.at.localeCompare(a.at));

export function maps() {
  const key = '__maps';
  if (!cache.has(key)) {
    cache.set(key, {
      cars: new Map(loadCars().map((c) => [c.id, c])),
      tuners: new Map(loadTuners().map((t) => [t.id, t])),
      sources: new Map(loadSourceStatus().map((s) => [s.id, s])),
      tuneIndex: new Map(loadTuneIndex().map((t) => [t.id, t])),
    });
  }
  return cache.get(key) as {
    cars: Map<string, Car>;
    tuners: Map<string, Tuner>;
    sources: Map<string, SourceStatus>;
    tuneIndex: Map<string, TuneIndexEntry>;
  };
}

export function loadStats() {
  const cars = loadCars();
  const tunes = loadTuneIndex();
  const coded = tunes.filter((t) => t.shareCode);
  const carsWithCode = new Set(coded.map((t) => t.carId)).size;
  return {
    cars: cars.length,
    tunes: tunes.length,
    coded: coded.length,
    tuners: loadTuners().length,
    coverage: cars.length ? Math.round((carsWithCode / cars.length) * 100) : 0,
  };
}

export const currentSeason = () => loadSeasons().find((s) => s.current);

export const loadHighlights = () => readItems<Highlight>('highlights.json');
export const loadRoles = () => readItems<CarRole>('roles.json');
