import type { CarRef } from '../adapters/types';
import { dice } from '../lib/similarity';
import { cleanText, normalizeName } from '../lib/text';
import type { Car } from '../schema/entities';

export type Resolution =
  | { ok: true; carId: string; method: 'alias' | 'exact' | 'make-model' | 'subset' | 'fuzzy' }
  | {
      ok: false;
      reason: 'ambiguous' | 'not-found';
      candidates: { id: string; similarity: number }[];
    };

/**
 * Pulls the model year out of the many formats sources use:
 * "1991 Honda Beat", "Porsche 911 GT3 RS (2023)", "BMW M3 '08", "Camaro ZL1 24'", "Viper 1999".
 */
export function splitYear(text: string): { year?: number; rest: string } {
  const value = cleanText(text);
  const leading = /^(\d{4})\s+(.+)$/.exec(value);
  if (leading) return { year: Number(leading[1]), rest: leading[2]! };
  const parenthesised = /^(.+?)\s*\(((?:19|20)\d{2})\)$/.exec(value);
  if (parenthesised) return { year: Number(parenthesised[2]), rest: parenthesised[1]! };
  const trailingFull = /^(.+?)\s+((?:19|20)\d{2})$/.exec(value);
  if (trailingFull) return { year: Number(trailingFull[2]), rest: trailingFull[1]! };
  const trailingShort = /^(.+?)\s+['`’](\d{2})$|^(.+?)\s+(\d{2})['`’]$/.exec(value);
  if (trailingShort) {
    const n = Number(trailingShort[2] ?? trailingShort[4]);
    return { year: n <= 40 ? 2000 + n : 1900 + n, rest: (trailingShort[1] ?? trailingShort[3])! };
  }
  return { rest: value };
}

const push = (map: Map<string, string[]>, key: string, id: string) => {
  const list = map.get(key);
  if (list) list.push(id);
  else map.set(key, [id]);
};

const tokens = (normalized: string): Set<string> => new Set(normalized.split(' ').filter(Boolean));

/**
 * Maps the many ways sources write a car name to the canonical id from the master list.
 * Cascade (ADR-0006), every automatic step requires the same make and, when known, the same year:
 *   1. alias table          4. subset: every word of the source name appears in exactly one car
 *   2. exact name           5. fuzzy: similarity ≥ threshold with a clear winner
 *   3. make + model
 * Anything else goes to the human review queue.
 */
export class CarResolver {
  private readonly cars = new Map<string, Car>();
  private readonly aliases = new Map<string, string>();
  private readonly byFull = new Map<string, string[]>();
  private readonly byMakeModel = new Map<string, string[]>();
  private readonly makeModelTokens = new Map<string, Set<string>>();
  private readonly makes: string[];
  private readonly cache = new Map<string, Resolution>();

  constructor(
    cars: readonly Car[],
    aliases: Readonly<Record<string, string>>,
    private readonly threshold = 0.92,
  ) {
    for (const car of cars) {
      const makeModel = normalizeName(`${car.make} ${car.model}`);
      this.cars.set(car.id, car);
      push(this.byFull, normalizeName(car.displayName), car.id);
      push(this.byFull, normalizeName(`${car.year} ${car.make} ${car.model}`), car.id);
      push(this.byMakeModel, makeModel, car.id);
      this.makeModelTokens.set(car.id, tokens(makeModel));
    }
    for (const [name, id] of Object.entries(aliases)) this.aliases.set(normalizeName(name), id);
    this.makes = [...new Set(cars.map((c) => normalizeName(c.make)))].sort(
      (a, b) => b.length - a.length,
    );
  }

  resolve(ref: CarRef): Resolution {
    const key = JSON.stringify([ref.text, ref.year, ref.make]);
    let result = this.cache.get(key);
    if (!result) {
      result = this.resolveUncached(ref);
      this.cache.set(key, result);
    }
    return result;
  }

  private filterYear(ids: readonly string[] | undefined, year: number | undefined): string[] {
    const distinct = [...new Set(ids ?? [])];
    return year === undefined
      ? distinct
      : distinct.filter((id) => this.cars.get(id)?.year === year);
  }

  private resolveUncached(ref: CarRef): Resolution {
    const alias = this.aliases.get(normalizeName(ref.text));
    if (alias && this.cars.has(alias)) return { ok: true, carId: alias, method: 'alias' };
    const first = this.resolveWith(ref, splitYear(ref.text));
    // A trailing number can be part of the name ("Peugeot 207 Super 2000"): retry without a year.
    if (!first.ok && ref.year === undefined && /\s(?:19|20)\d{2}$/.test(ref.text.trim())) {
      const retry = this.resolveWith(ref, { rest: ref.text.trim() });
      if (retry.ok) return retry;
    }
    return first;
  }

  private resolveWith(ref: CarRef, split: { year?: number; rest: string }): Resolution {
    const year = ref.year ?? split.year;
    const makeModel = normalizeName(split.rest);
    const make = ref.make
      ? normalizeName(ref.make)
      : this.makes.find((m) => makeModel === m || makeModel.startsWith(`${m} `));

    if (year !== undefined) {
      const exact = this.filterYear(this.byFull.get(`${year} ${makeModel}`), year);
      if (exact.length === 1) return { ok: true, carId: exact[0]!, method: 'exact' };
    }

    const byName = this.filterYear(this.byMakeModel.get(makeModel), year);
    if (byName.length === 1) return { ok: true, carId: byName[0]!, method: 'make-model' };
    if (byName.length > 1) {
      return {
        ok: false,
        reason: 'ambiguous',
        candidates: byName.sort().map((id) => ({ id, similarity: 1 })),
      };
    }

    const pool = [...this.cars.values()].filter(
      (car) => (year === undefined || car.year === year) && normalizeName(car.make) === make,
    );

    if (make) {
      const wanted = tokens(makeModel);
      const supersets = pool.filter((car) =>
        [...wanted].every((t) => this.makeModelTokens.get(car.id)?.has(t)),
      );
      if (supersets.length === 1) return { ok: true, carId: supersets[0]!.id, method: 'subset' };
    }

    return this.fuzzy(makeModel, year, make, pool);
  }

  private fuzzy(
    makeModel: string,
    year: number | undefined,
    make: string | undefined,
    sameMake: Car[],
  ): Resolution {
    const score = (car: Car) => ({
      id: car.id,
      similarity:
        Math.round(dice(makeModel, normalizeName(`${car.make} ${car.model}`)) * 1000) / 1000,
    });
    const byScore = (
      a: { id: string; similarity: number },
      b: { id: string; similarity: number },
    ) => b.similarity - a.similarity || a.id.localeCompare(b.id);

    const ranked = sameMake.map(score).sort(byScore);
    const [best, second] = ranked;
    const clearWinner = best && (!second || best.similarity - second.similarity >= 0.03);
    if (make && best && best.similarity >= this.threshold && clearWinner) {
      return { ok: true, carId: best.id, method: 'fuzzy' };
    }
    const candidates =
      ranked.length > 0
        ? ranked
        : [...this.cars.values()]
            .filter((car) => year === undefined || car.year === year)
            .map(score)
            .sort(byScore);
    return { ok: false, reason: 'not-found', candidates: candidates.slice(0, 3) };
  }
}
