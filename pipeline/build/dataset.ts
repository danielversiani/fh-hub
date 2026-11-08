import type { AdapterOutput, RawCustomEvent, RawTune } from '../adapters/types';
import type { ManualData } from '../config';
import { shortHash } from '../lib/json';
import { cleanText, normalizeName, slugify } from '../lib/text';
import { CarResolver } from '../normalize/car-resolver';
import {
  inferSurface,
  parseBuildTags,
  parseClass,
  parseClassPrefix,
  parseDifficulty,
  parseDrivetrain,
  parseInteger,
  parseLapTime,
  parseShareCode,
  parseTires,
} from '../normalize/fields';
import { TunerRegistry, type TunerIdentity } from '../normalize/tuners';
import type { Car, CustomEvent, LapTime, ReviewItem, Tune, Tuner } from '../schema/entities';
import type { SourceDef } from '../schema/source';

export interface SourceResult {
  source: SourceDef;
  output: AdapterOutput;
}

export interface Dataset {
  cars: Car[];
  tuners: Tuner[];
  tunes: Tune[];
  lapTimes: LapTime[];
  customEvents: CustomEvent[];
  review: ReviewItem[];
}

class ReviewCollector {
  private readonly items = new Map<string, ReviewItem>();

  add(
    kind: ReviewItem['kind'],
    sourceId: string,
    raw: string,
    candidates: ReviewItem['candidates'] = [],
  ): void {
    const key = `${kind}|${sourceId}|${raw}`;
    const existing = this.items.get(key);
    if (existing) existing.count++;
    else this.items.set(key, { kind, sourceId, raw, count: 1, candidates });
  }

  list(): ReviewItem[] {
    return [...this.items.values()].sort(
      (a, b) =>
        a.kind.localeCompare(b.kind) ||
        a.sourceId.localeCompare(b.sourceId) ||
        a.raw.localeCompare(b.raw),
    );
  }
}

/** Master car list: only catalog sources create cars (ADR-0006). */
function buildCars(results: readonly SourceResult[]): Car[] {
  const cars = new Map<string, Car>();
  for (const { source, output } of results) {
    for (const c of output.catalog) {
      const id = slugify(c.displayName);
      const existing = cars.get(id);
      if (existing) {
        if (!existing.sourceIds.includes(source.id)) existing.sourceIds.push(source.id);
        continue;
      }
      cars.set(id, {
        id,
        year: c.year,
        make: c.make,
        model: c.model,
        displayName: c.displayName,
        carTypes: c.carTypes,
        country: c.country,
        stock:
          c.stockClass && c.stockPi !== undefined
            ? { class: c.stockClass, pi: c.stockPi }
            : undefined,
        acquisition: c.acquisitionRaw
          ? {
              raw: c.acquisitionRaw,
              methods: [
                ...new Set(c.acquisitionRaw.split(',').map(slugify).filter(Boolean)),
              ].sort(),
            }
          : undefined,
        addOns: c.addOns,
        sourceIds: [source.id],
      });
    }
  }
  return [...cars.values()].sort((a, b) => a.id.localeCompare(b.id));
}

const tuneKey = (t: Pick<Tune, 'carId' | 'tunerId' | 'name'>) =>
  `${t.carId}|${t.tunerId}|${normalizeName(t.name)}`;

/** Fills fields the existing tune lacks; the first (highest-weight) source wins on conflicts. */
function absorb(target: Tune, other: Tune): void {
  target.observations.push(...other.observations);
  target.class ??= other.class;
  target.surface ??= other.surface;
  target.drivetrain ??= other.drivetrain;
  target.tires ??= other.tires;
  target.engine ??= other.engine;
  target.notes ??= other.notes;
  target.createdAt ??= other.createdAt;
  target.buildTags = [...new Set([...target.buildTags, ...other.buildTags])].sort();
}

/**
 * Joins every source into one dataset: cars from the master list, tunes deduplicated by share
 * code, tunes without a code linked to coded ones by (car, tuner, name). Pure function:
 * same input → same output.
 */
export function buildDataset(results: readonly SourceResult[], manual: ManualData): Dataset {
  const ordered = [...results].sort(
    (a, b) => b.source.weight - a.source.weight || a.source.id.localeCompare(b.source.id),
  );
  const cars = buildCars(ordered);
  const resolver = new CarResolver(cars, manual.carAliases);
  const registry = new TunerRegistry(manual.tunerAliases);
  const review = new ReviewCollector();
  const tuners = new Map<string, { identity: TunerIdentity; aliases: Set<string> }>();

  const identifyTuner = (raw: string | undefined): TunerIdentity | undefined => {
    const identity = registry.identify(raw ?? '');
    if (!identity) return undefined;
    const entry = tuners.get(identity.id) ?? { identity, aliases: new Set<string>() };
    const variant = cleanText(raw);
    if (variant !== identity.displayName) entry.aliases.add(variant);
    tuners.set(identity.id, entry);
    return identity;
  };

  const resolveCar = (sourceId: string, car: RawTune['car']): string | undefined => {
    const resolution = resolver.resolve(car);
    if (resolution.ok) return resolution.carId;
    review.add('unmatched-car', sourceId, cleanText(car.text), resolution.candidates);
    return undefined;
  };

  // --- tunes -------------------------------------------------------------------------------
  const tunes = new Map<string, Tune>();
  for (const { source, output } of ordered) {
    const excluded = new Set(source.excludedTuners.map((t) => cleanText(t).toLowerCase()));
    for (const raw of output.tunes) {
      if (excluded.has(cleanText(raw.tuner).toLowerCase())) continue;
      const carId = resolveCar(source.id, raw.car);
      const tuner = identifyTuner(raw.tuner);
      if (!carId || !tuner) continue;

      const tires = parseTires(raw.tires);
      if (tires === 'other') review.add('unknown-value', source.id, `tires: ${raw.tires}`);
      const shareCode = parseShareCode(raw.shareCode);
      const carClass =
        raw.carClass ?? parseClass(raw.classText) ?? parseClassPrefix(raw.name) ?? null;
      const name = cleanText(raw.name);
      const tune: Tune = {
        id: shareCode
          ? `sc-${shareCode}`
          : `nc-${shortHash([carId, tuner.id, normalizeName(name), carClass ?? ''].join('|'))}`,
        shareCode,
        carId,
        tunerId: tuner.id,
        name,
        class: carClass,
        surface: inferSurface({ explicit: raw.surfaceText, name, tires }),
        drivetrain: parseDrivetrain(raw.drivetrain) ?? parseDrivetrain(name),
        tires,
        engine: cleanText(raw.engine) || undefined,
        buildTags: parseBuildTags(raw.build, name, raw.notes),
        notes: cleanText(raw.notes) || undefined,
        createdAt: raw.createdAt,
        observations: [{ sourceId: source.id, tab: raw.tab, row: raw.row, raw: raw.raw }],
      };

      const existing = tunes.get(tune.id);
      if (!existing) tunes.set(tune.id, tune);
      else if (existing.carId !== tune.carId) {
        review.add(
          'unknown-value',
          source.id,
          `share code ${shareCode} listed for ${existing.carId} and ${tune.carId}`,
        );
      } else absorb(existing, tune);
    }
  }

  // Link tunes without a share code (kleis, Letz) to the coded tune with the same car/tuner/name.
  const coded = new Map<string, Tune>();
  for (const t of tunes.values()) if (t.shareCode) coded.set(tuneKey(t), t);
  for (const [id, t] of tunes) {
    if (t.shareCode) continue;
    const match = coded.get(tuneKey(t));
    if (match) {
      absorb(match, t);
      tunes.delete(id);
    }
  }
  for (const t of tunes.values()) {
    t.observations.sort(
      (a, b) => a.sourceId.localeCompare(b.sourceId) || a.tab.localeCompare(b.tab) || a.row - b.row,
    );
  }

  // --- lap times ---------------------------------------------------------------------------
  const lapTimes: LapTime[] = [];
  for (const { source, output } of ordered) {
    for (const lap of output.lapTimes) {
      const carId = resolveCar(source.id, lap.car);
      const timeMs = parseLapTime(lap.time);
      if (!timeMs) review.add('unknown-value', source.id, `lap time: ${lap.time}`);
      if (!carId || !timeMs) continue;
      lapTimes.push({
        sourceId: source.id,
        row: lap.row,
        track: lap.track,
        class: lap.carClass,
        carId,
        timeMs,
        driver: cleanText(lap.driver),
        tunerId: identifyTuner(lap.tuner)?.id,
        tuneName: cleanText(lap.tuneName) || undefined,
        tierLabel: lap.tierLabel,
        build: lap.build,
        difficulty: parseDifficulty(lap.difficulty),
        tires: parseTires(lap.tires),
        drivetrain: parseDrivetrain(lap.drivetrain),
        engine: lap.engine,
        aero: lap.aero,
        notes: lap.notes,
      });
    }
  }
  lapTimes.sort(
    (a, b) =>
      a.track.localeCompare(b.track) ||
      a.class.localeCompare(b.class) ||
      a.timeMs - b.timeMs ||
      a.carId.localeCompare(b.carId),
  );

  // --- custom events -----------------------------------------------------------------------
  const toCustomEvent = (sourceId: string, e: RawCustomEvent): CustomEvent => ({
    id: e.id,
    sourceId,
    organizer: e.organizer,
    name: e.name,
    groups: e.groups.map((g) => ({
      name: g.name,
      entries: g.entries.map((entry) => {
        const liveryCode = parseShareCode(entry.livery);
        const aero = (entry.adjustableAero ?? '').toLowerCase();
        return {
          row: entry.row,
          kind: entry.kind,
          label: cleanText(entry.label),
          carText: cleanText(entry.car.text),
          carId: entry.kind === 'car' ? (resolveCar(sourceId, entry.car) ?? null) : null,
          tuneCode: parseShareCode(entry.tuneCode),
          liveryCode,
          liveryNote: liveryCode ? undefined : cleanText(entry.livery) || undefined,
          pi: parseInteger(entry.pi),
          adjustableAero: aero === 'yes' ? true : aero === 'no' ? false : undefined,
          drivetrain: parseDrivetrain(entry.drivetrain),
          tunedBy: cleanText(entry.tunedBy) || undefined,
        };
      }),
    })),
  });
  const customEvents = ordered
    .flatMap(({ source, output }) => output.customEvents.map((e) => toCustomEvent(source.id, e)))
    .sort((a, b) => a.id.localeCompare(b.id));

  // --- tuners ------------------------------------------------------------------------------
  const tuneCount = new Map<string, number>();
  for (const t of tunes.values()) tuneCount.set(t.tunerId, (tuneCount.get(t.tunerId) ?? 0) + 1);
  const tunerList: Tuner[] = [...tuners.values()]
    .map(({ identity, aliases }) => ({
      id: identity.id,
      displayName: identity.displayName,
      team: identity.team,
      aliases: [...aliases].sort(),
      tuneCount: tuneCount.get(identity.id) ?? 0,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    cars,
    tuners: tunerList,
    tunes: [...tunes.values()].sort((a, b) => a.id.localeCompare(b.id)),
    lapTimes,
    customEvents,
    review: review.list(),
  };
}

export interface DatasetStats {
  cars: number;
  carsWithCodedTune: number;
  carsWithAnyTune: number;
  tunes: number;
  codedTunes: number;
  tuners: number;
  lapTimes: number;
  unmatchedCarNames: number;
  unmatchedCarRows: number;
}

export function datasetStats(d: Dataset): DatasetStats {
  const unmatched = d.review.filter((r) => r.kind === 'unmatched-car');
  return {
    cars: d.cars.length,
    carsWithCodedTune: new Set(d.tunes.filter((t) => t.shareCode).map((t) => t.carId)).size,
    carsWithAnyTune: new Set(d.tunes.map((t) => t.carId)).size,
    tunes: d.tunes.length,
    codedTunes: d.tunes.filter((t) => t.shareCode).length,
    tuners: d.tuners.length,
    lapTimes: d.lapTimes.length,
    unmatchedCarNames: unmatched.length,
    unmatchedCarRows: unmatched.reduce((n, r) => n + r.count, 0),
  };
}
