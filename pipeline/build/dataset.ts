import type { AdapterOutput, RawCustomEvent, RawTune } from '../adapters/types';
import type { ManualData } from '../config';
import { shortHash } from '../lib/json';
import { cleanText, normalizeName, slugify } from '../lib/text';
import { CarResolver } from '../normalize/car-resolver';
import { lapRefParser, lapRefStripper } from '../normalize/lap-refs';
import { translator } from '../normalize/translate';
import {
  inferSurface,
  parseBuildTags,
  parseClass,
  parseClassPrefix,
  parseDifficulty,
  parseDrivetrain,
  parseInteger,
  parseLapTime,
  parseRole,
  parseShareCode,
  parseTier,
  parseTires,
} from '../normalize/fields';
import { buildSeasons, eventCategory, eventId, parseSeasonLabel } from '../normalize/playlist';
import { parseRoute, RequirementParser } from '../normalize/requirement';
import { TunerRegistry, type TunerIdentity } from '../normalize/tuners';
import { magnitude } from './highlights';
import { CAR_CLASSES, Drivetrain, Rarity, Surface } from '../schema/enums';
import type {
  Car,
  CustomEvent,
  Highlight,
  LapTime,
  MetaRanking,
  PlaylistEvent,
  RivalsPick,
  PlaylistSeason,
  ReviewItem,
  Tune,
  Tuner,
} from '../schema/entities';
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
  meta: MetaRanking[];
  /** Rivals leaderboard top picks per track × class (not used by curation yet). */
  rivals: RivalsPick[];
  /** News from the meta table's update log (merged with the change log in sync). */
  highlights: Highlight[];
  seasons: PlaylistSeason[];
  events: PlaylistEvent[];
  review: ReviewItem[];
}

const CLASS_ORDER = new Map<string, number>(CAR_CLASSES.map((c, i) => [c, i]));
const nonEmpty = <T>(list: T[]): T[] | undefined => (list.length ? list : undefined);

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
  const carById = new Map(cars.map((c) => [c.id, c]));
  const resolver = new CarResolver(cars, manual.carAliases);
  const registry = new TunerRegistry(manual.tunerAliases);
  const review = new ReviewCollector();
  const tunerSurface = (tunerId: string) => {
    const surface = Surface.safeParse(manual.tunerSurfaces[tunerId]);
    return surface.success ? surface.data : null;
  };
  const translate = translator(manual.translations, lapRefStripper(manual.trackAliases));
  /** Translated text, or undefined (and a review item) when the memory lacks it. */
  const localize = (sourceId: string, text: string | undefined) => {
    const done = translate(text);
    if (text && !done) review.add('untranslated-text', sourceId, text);
    return done;
  };
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

  // --- car attributes (e.g. rarity from the wiki); only existing cars are enriched --------
  for (const { source, output } of ordered) {
    for (const attr of output.carAttributes) {
      const carId = resolveCar(source.id, attr.car);
      const car = carId ? carById.get(carId) : undefined;
      if (!car) continue;
      const rarity = Rarity.safeParse(attr.rarity);
      if (rarity.success && !car.rarity) car.rarity = rarity.data;
      const drivetrain = Drivetrain.safeParse(attr.drivetrain);
      if (drivetrain.success && !car.drivetrain) car.drivetrain = drivetrain.data;
      if (attr.image && !car.image) car.image = attr.image;
    }
  }

  // Rarity confirmed in game by the owner wins over the wiki (data/manual/car-rarity.yaml).
  for (const [carId, value] of Object.entries(manual.carRarity)) {
    const car = carById.get(carId);
    const rarity = Rarity.safeParse(value);
    if (car && rarity.success) car.rarity = rarity.data;
  }

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
        nameI18n: /\p{Script=Han}/u.test(name) ? localize(source.id, name) : undefined,
        class: carClass,
        // No hint in the row: the tuner's specialty, when known (data/manual/tuner-surfaces.yaml).
        surface: inferSurface({ explicit: raw.surfaceText, name, tires }) ?? tunerSurface(tuner.id),
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

  // --- meta rankings -----------------------------------------------------------------------
  const lapRefs = lapRefParser(manual.trackAliases);
  const meta: MetaRanking[] = [];
  for (const { source, output } of ordered) {
    for (const m of output.meta) {
      const tier = parseTier(m.tier);
      if (!tier) continue; // e.g. Noa's 未知: listed but not rated yet
      const carId = resolveCar(source.id, m.car);
      if (!carId) continue;
      const tires = parseTires(m.tires);
      if (tires === 'other') review.add('unknown-value', source.id, `tires: ${m.tires}`);
      meta.push({
        sourceId: source.id,
        tab: m.tab,
        row: m.row,
        class: m.carClass,
        surface: m.surface,
        carId,
        tier,
        rank: m.rank,
        drivetrain: parseDrivetrain(m.drivetrain),
        difficulty: parseDifficulty(m.difficulty),
        tires: tires === 'other' ? undefined : tires,
        role: parseRole(m.role),
        tunerIds: [
          ...new Set(
            m.tuners.flatMap((name) => {
              const identity = identifyTuner(name);
              return identity ? [identity.id] : [];
            }),
          ),
        ],
        shareCode: parseShareCode(m.shareCode),
        notes: cleanText(m.notes) || undefined,
        notesI18n: localize(source.id, cleanText(m.notes) || undefined),
        lapRefs: nonEmpty(lapRefs(m.notes)),
      });
    }
  }
  meta.sort(
    (a, b) =>
      a.sourceId.localeCompare(b.sourceId) ||
      (CLASS_ORDER.get(a.class) ?? 0) - (CLASS_ORDER.get(b.class) ?? 0) ||
      a.surface.localeCompare(b.surface) ||
      a.rank - b.rank,
  );

  // --- tunes known only from the meta table ------------------------------------------------
  // The table credits tuners for a car ("search MSR Mian in game") without a share code. When no
  // source has a tune of that tuner for that car in that class × surface, the recommendation
  // becomes a tune of its own, so the car never shows "no tunes" next to a recommended tuner.
  const tunesByBuild = new Set<string>();
  for (const t of tunes.values()) {
    // A tune without a known surface counts for every surface of its class.
    tunesByBuild.add(`${t.carId}|${t.tunerId}|${t.class ?? ''}|${t.surface ?? ''}`);
  }
  for (const m of meta) {
    for (const tunerId of m.tunerIds) {
      if (
        tunesByBuild.has(`${m.carId}|${tunerId}|${m.class}|${m.surface}`) ||
        tunesByBuild.has(`${m.carId}|${tunerId}|${m.class}|`)
      )
        continue;
      const id = `nc-${shortHash([m.carId, tunerId, 'meta', m.class, m.surface, m.drivetrain ?? ''].join('|'))}`;
      const existing = tunes.get(id);
      const observation = { sourceId: m.sourceId, tab: m.tab, row: m.row, raw: {} };
      if (existing) {
        existing.observations.push(observation);
        continue;
      }
      tunes.set(id, {
        id,
        carId: m.carId,
        tunerId,
        name: `${m.class} ${m.surface}${m.drivetrain ? ` ${m.drivetrain}` : ''}`,
        class: m.class,
        surface: m.surface,
        drivetrain: m.drivetrain,
        tires: m.tires,
        buildTags: [],
        observations: [observation],
        fromMeta: true,
      });
    }
  }

  // --- rivals -------------------------------------------------------------------------------
  const rivals: RivalsPick[] = [];
  for (const { source, output } of ordered) {
    for (const r of output.rivals) {
      const carId = resolveCar(source.id, r.car);
      if (!carId) continue;
      rivals.push({
        sourceId: source.id,
        track: cleanText(r.track),
        surface: r.surface,
        class: r.carClass,
        choice: r.choice,
        carId,
      });
    }
  }
  rivals.sort(
    (a, b) =>
      a.surface.localeCompare(b.surface) ||
      (CLASS_ORDER.get(a.class) ?? 0) - (CLASS_ORDER.get(b.class) ?? 0) ||
      a.track.localeCompare(b.track) ||
      a.choice - b.choice,
  );

  // --- news from the meta table's update tabs ----------------------------------------------
  const highlights: Highlight[] = [];
  for (const { source, output } of ordered) {
    // The new-cars tab has no dates: it is the table's current "fresh" list, so it takes the
    // newest date of the update log.
    const latest = output.metaUpdates.reduce(
      (max, u) => (u.date && u.date > max ? u.date : max),
      '',
    );
    for (const u of output.metaUpdates) {
      const tier = parseTier(u.tier);
      const date = u.date ?? latest;
      if (!tier || !date) continue;
      const carId = resolveCar(source.id, u.car);
      if (!carId) continue;
      const kind = u.kind === 'new-car' ? 'new-car' : 'tune-update';
      highlights.push({
        id: `${source.id}--${u.tab}--${u.row}`,
        kind,
        date,
        carId,
        class: u.carClass,
        surface: u.surface,
        tier,
        tunerIds: [
          ...new Set(
            u.tuners.flatMap((name) => {
              const identity = identifyTuner(name);
              return identity ? [identity.id] : [];
            }),
          ),
        ],
        sourceId: source.id,
        magnitude: magnitude(kind, tier),
      });
    }
  }

  // --- festival playlist -------------------------------------------------------------------
  const requirements = new RequirementParser(cars, resolver);
  const seasons: PlaylistSeason[] = [];
  const events: PlaylistEvent[] = [];
  for (const { source, output } of ordered) {
    for (const playlist of output.playlists) {
      seasons.push(...buildSeasons(playlist));
      const seen = new Map<string, number>();
      for (const row of playlist.rows) {
        const label = parseSeasonLabel(row.seasonLabel);
        if (!label) {
          review.add('unknown-value', source.id, `season: ${row.seasonLabel}`);
          continue;
        }
        const requirement = requirements.parse(row.type, row.requirement);
        if (requirement.status === 'unparsed') {
          review.add('unparsed-requirement', source.id, `${row.type}: ${row.requirement}`);
        }
        const route = parseRoute(row.type, row.route);
        const baseId = eventId(label.id, row.type, row.name);
        const n = (seen.get(baseId) ?? 0) + 1;
        seen.set(baseId, n);
        const points = /^(\d+)\s*pts$/i.exec(row.requirement.trim());
        // Challenge text (no car restriction): Portuguese from the translation list.
        const text = requirement.status === 'no-car' && !points ? row.requirement.trim() : '';
        const pt = text ? manual.playlistTexts[text] : undefined;
        events.push({
          id: n > 1 ? `${baseId}-${n}` : baseId,
          seasonId: label.id,
          seriesId: label.seriesId,
          type: row.type,
          category: eventCategory(row.type),
          name: row.name,
          reward: row.reward || undefined,
          requirementRaw: row.requirement,
          requirementI18n: pt ? { 'pt-br': pt, en: text } : undefined,
          requirement,
          routeRaw: row.route,
          routes: route.routes,
          surface: route.surface,
          discipline: route.discipline,
          points: points ? Number(points[1]) : undefined,
          row: row.row,
        });
      }
    }
  }

  // Challenges of the live series still missing a Portuguese text: listed for translation.
  const liveSeries = seasons.find((s) => s.current)?.seriesId;
  for (const e of events) {
    if (e.seriesId !== liveSeries || e.requirementI18n) continue;
    if (e.requirement.status === 'no-car' && !e.points && e.requirementRaw.trim()) {
      review.add('untranslated-text', 'forza-playlist', e.requirementRaw.trim());
    }
  }

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
    meta,
    rivals,
    highlights,
    seasons,
    events,
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
  metaRankings: number;
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
    metaRankings: d.meta.length,
    unmatchedCarNames: unmatched.length,
    unmatchedCarRows: unmatched.reduce((n, r) => n + r.count, 0),
  };
}
