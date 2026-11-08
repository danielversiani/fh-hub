import fs from 'node:fs';
import path from 'node:path';
import type { Car, SourceStatus, TuneIndexEntry, Tuner } from '../../pipeline/schema/entities';

/**
 * Data is read at build time from data/generated (public) or, with `pnpm dev:preview`,
 * from .cache/preview/generated (includes sources still waiting for permission).
 */
const DATA_DIR: string = import.meta.env.FH_DATA_DIR ?? 'data/generated';
export const isPreview = DATA_DIR.includes('preview');

function readItems<T>(file: string): T[] {
  const full = path.resolve(process.cwd(), DATA_DIR, file);
  if (!fs.existsSync(full)) return [];
  return (JSON.parse(fs.readFileSync(full, 'utf8')) as { items: T[] }).items;
}

export const loadCars = () => readItems<Car>('cars.json');
export const loadTuners = () => readItems<Tuner>('tuners.json');
export const loadTuneIndex = () => readItems<TuneIndexEntry>('tunes/index.json');
export const loadSourceStatus = () => readItems<SourceStatus>('sources-status.json');

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
