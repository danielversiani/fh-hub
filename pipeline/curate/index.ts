import type { Dataset } from '../build/dataset';
import type { Category, Difficulty, Tier } from '../schema/enums';
import type {
  Car,
  LapTime,
  MetaRanking,
  PlaylistEvent,
  Suggestion,
  Tune,
} from '../schema/entities';
import type { SourceDef } from '../schema/source';
import type { CurationConfig, Signal, Weights } from './config';

/**
 * Curation (docs/CURATION.md, ADR-0008), following the owner's rules:
 * - The meta table (Noa Miyako) is THE reference. A car's tier in a class × surface comes from
 *   it; cars it does not list get `defaultTier` (T3) until it does.
 * - Meta / Off-meta come only from that tier. Purist from the build. Meme from an explicit list of
 *   cars (config `memeCars`).
 * - Playlist suggestions are made only when the site KNOWS the car is eligible.
 * The numeric score is internal: it only breaks ties between tunes of the same tier.
 */

export const TIER_ORDER: readonly Tier[] = ['meta-plus', 'meta', 't0.5', 't1', 't1.5', 't2', 't3'];
const tierIndex = (t: Tier | undefined) => (t ? TIER_ORDER.indexOf(t) : TIER_ORDER.length);

const TIER_VALUE: Readonly<Record<Tier, number>> = {
  'meta-plus': 1,
  meta: 0.9,
  't0.5': 0.8,
  t1: 0.65,
  't1.5': 0.55,
  t2: 0.45,
  t3: 0.3,
};

const EASE_VALUE: Readonly<Record<Difficulty, number>> = {
  easy: 1,
  normal: 0.75,
  'slightly-hard': 0.55,
  hard: 0.4,
  'very-hard': 0.2,
};

const CATEGORY_ORDER: readonly Category[] = ['meta', 'off-meta', 'purist', 'meme'];
const round = (n: number) => Math.round(n * 1000) / 1000;

interface Evidence {
  signals: Partial<Record<Signal, number>>;
  ranking?: MetaRanking;
  credited: boolean;
  lap?: LapTime;
  lapRank?: number;
  sourceCount: number;
}

export interface CurationResult {
  tunes: Tune[];
  suggestions: Suggestion[];
}

function weighted(
  signals: Evidence['signals'],
  weights: Weights,
): { score: number; confidence: number } {
  let sum = 0;
  let present = 0;
  let total = 0;
  for (const [name, weight] of Object.entries(weights) as [Signal, number][]) {
    total += weight;
    const value = signals[name];
    if (value === undefined) continue;
    sum += value * weight;
    present += weight;
  }
  return {
    score: present ? round(sum / present) : 0,
    confidence: total ? round(present / total) : 0,
  };
}

/** Better tier first, then tunes the meta table credits, then coded, then table rank, then score. */
export function compareTunes(a: Tune, b: Tune): number {
  return (
    tierIndex(a.tier) - tierIndex(b.tier) ||
    Number(Boolean(b.credited)) - Number(Boolean(a.credited)) ||
    Number(Boolean(b.shareCode)) - Number(Boolean(a.shareCode)) ||
    (a.metaRank ?? 9999) - (b.metaRank ?? 9999) ||
    (b.score ?? 0) - (a.score ?? 0) ||
    a.id.localeCompare(b.id)
  );
}

export function curate(
  dataset: Dataset,
  config: CurationConfig,
  sources: readonly SourceDef[],
): CurationResult {
  const sourceWeight = new Map(sources.map((s) => [s.id, s.weight]));
  const cars = new Map(dataset.cars.map((c) => [c.id, c]));
  const memeCars = new Set(config.categories.memeCars);

  // Meta rankings per car × class × surface, best first (a car can be listed more than once,
  // e.g. an AWD and a RWD build credited to different tuners).
  const rankingsByBuild = new Map<string, MetaRanking[]>();
  for (const m of dataset.meta) {
    const key = `${m.carId}|${m.class}|${m.surface}`;
    rankingsByBuild.set(key, [...(rankingsByBuild.get(key) ?? []), m]);
  }
  for (const list of rankingsByBuild.values()) {
    list.sort((a, b) => tierIndex(a.tier) - tierIndex(b.tier) || a.rank - b.rank);
  }
  /**
   * The row that describes this tune: one crediting its tuner (same drivetrain when the table
   * has several builds), else the car's best row. `credited` = the table names this tuner.
   */
  const rankingFor = (tune: Tune): { ranking?: MetaRanking; credited: boolean } => {
    if (!tune.class || !tune.surface) return { credited: false };
    const list = rankingsByBuild.get(`${tune.carId}|${tune.class}|${tune.surface}`) ?? [];
    const crediting = list.filter((m) => m.tunerIds.includes(tune.tunerId));
    const own =
      crediting.find((m) => tune.drivetrain && m.drivetrain === tune.drivetrain) ?? crediting[0];
    return own ? { ranking: own, credited: true } : { ranking: list[0], credited: false };
  };

  const laps = new Map<string, LapTime>();
  const classBest = new Map<string, number>();
  for (const lap of dataset.lapTimes) {
    const key = `${lap.carId}|${lap.class}`;
    if (!laps.has(key) || lap.timeMs < laps.get(key)!.timeMs) laps.set(key, lap);
    classBest.set(lap.class, Math.min(classBest.get(lap.class) ?? Infinity, lap.timeMs));
  }
  const lapRank = new Map<string, number>();
  for (const cls of classBest.keys()) {
    [...laps.values()]
      .filter((l) => l.class === cls)
      .sort((a, b) => a.timeMs - b.timeMs)
      .forEach((l, i) => lapRank.set(`${l.carId}|${l.class}`, i + 1));
  }

  // Recency is measured against the newest tune in the data (not "now") to stay deterministic.
  const newest = dataset.tunes.reduce(
    (max, t) => (t.createdAt && t.createdAt > max ? t.createdAt : max),
    '',
  );

  const evidence = (tune: Tune): Evidence => {
    const signals: Evidence['signals'] = {};
    const { ranking, credited } = rankingFor(tune);
    if (ranking) {
      signals.tier =
        TIER_VALUE[ranking.tier] * (credited ? 1 : config.thresholds.unlistedTunerTierFactor);
      if (ranking.difficulty) signals.ease = EASE_VALUE[ranking.difficulty];
    }
    const lap =
      tune.class && tune.surface === 'road' ? laps.get(`${tune.carId}|${tune.class}`) : undefined;
    if (lap) {
      const best = classBest.get(lap.class)!;
      signals.laptime =
        Math.max(0, 1 - ((lap.timeMs - best) / best) * 20) *
        (lap.tunerId === tune.tunerId ? 1 : config.thresholds.unlistedTunerTierFactor);
      if (signals.ease === undefined && lap.difficulty) signals.ease = EASE_VALUE[lap.difficulty];
    }
    const sourceIds = [...new Set(tune.observations.map((o) => o.sourceId))];
    const endorsement = sourceIds.reduce((sum, id) => sum + (sourceWeight.get(id) ?? 0.5), 0);
    signals.endorsement = Math.min(1, Math.log2(1 + endorsement) / Math.log2(4));
    signals.tuner = config.tuners[tune.tunerId] ?? 0.5;
    if (tune.createdAt) {
      if (config.lastPhysicsPatch)
        signals.recency = tune.createdAt >= config.lastPhysicsPatch ? 1 : 0.4;
      else if (newest) {
        const ageDays = (Date.parse(newest) - Date.parse(tune.createdAt)) / 86_400_000;
        signals.recency = 1 - Math.min(1, ageDays / 365) * 0.7;
      }
    }
    for (const k of Object.keys(signals) as Signal[]) signals[k] = round(signals[k]!);
    return {
      signals,
      ranking,
      credited,
      lap,
      lapRank: lap ? lapRank.get(`${lap.carId}|${lap.class}`) : undefined,
      sourceCount: sourceIds.length,
    };
  };

  const evidenceById = new Map<string, Evidence>();
  const tunes: Tune[] = dataset.tunes.map((tune) => {
    const ev = evidence(tune);
    evidenceById.set(tune.id, ev);
    const tier = ev.ranking?.tier ?? config.categories.defaultTier;
    const listed = Boolean(ev.ranking);
    const categories: Category[] = [];
    if (listed && config.categories.metaTiers.includes(tier)) categories.push('meta');
    else if (listed && config.categories.offMetaTiers.includes(tier)) categories.push('off-meta');
    if (tune.buildTags.includes('purist')) categories.push('purist');
    if (memeCars.has(tune.carId)) categories.push('meme');
    const { score, confidence } = weighted(ev.signals, config.weights);
    // The table's columns describe the credited tuner's build only.
    const own = ev.credited ? ev.ranking : undefined;
    return {
      ...tune,
      tier,
      tierSource: listed ? 'meta-table' : 'default',
      metaRank: ev.ranking?.rank,
      credited: ev.credited || undefined,
      score,
      confidence,
      categories,
      drivetrain: tune.drivetrain ?? own?.drivetrain,
      tires: tune.tires ?? own?.tires,
      difficulty: own?.difficulty,
      role: own?.role,
      metaNotes: own?.notes,
      metaNotesI18n: own?.notesI18n,
      lapRefs: own?.lapRefs,
    };
  });

  return { tunes, suggestions: suggest(dataset, config, tunes, evidenceById, cars) };
}

const isObtainable = (car: Car | undefined) =>
  car?.acquisition?.methods.some((m) => m === 'autoshow' || m === 'wheelspin') ?? false;

function suggest(
  dataset: Dataset,
  config: CurationConfig,
  tunes: Tune[],
  evidence: Map<string, Evidence>,
  cars: Map<string, Car>,
): Suggestion[] {
  const current = dataset.seasons.find((s) => s.current);
  const seasonOrder = new Map(dataset.seasons.map((s) => [s.id, s.order]));
  const minOrder = current ? current.order - config.pastSeasonsWithSuggestions : -Infinity;
  const inWindow = (e: PlaylistEvent) => {
    const order = seasonOrder.get(e.seasonId);
    if (order === undefined) return !current || e.seriesId === current.seriesId;
    return order >= minOrder;
  };

  const out: Suggestion[] = [];
  for (const event of dataset.events) {
    const req = event.requirement;
    // Only suggest when eligibility is KNOWN: partial requirements (rarity, stock drivetrain)
    // cannot be checked with the data we have, so they get no suggestions (owner's rule).
    if (!inWindow(event) || req.status !== 'parsed') continue;
    if (!req.class && !req.carIds) continue;
    const allowed = req.carIds ? new Set(req.carIds) : undefined;
    const candidates = tunes
      .filter(
        (t) =>
          (!req.class || t.class === req.class) &&
          (!allowed || allowed.has(t.carId)) &&
          (!event.surface || t.surface === event.surface),
      )
      .sort(
        (a, b) =>
          tierIndex(a.tier) - tierIndex(b.tier) ||
          // Same tier: prefer cars players can still get (Autoshow / Wheelspin).
          (config.preferObtainable
            ? Number(isObtainable(cars.get(b.carId))) - Number(isObtainable(cars.get(a.carId)))
            : 0) ||
          compareTunes(a, b),
      );

    // A car appears once per event in Meta / Off-meta / Meme, with its best tune (candidates are
    // already sorted best first). Purist is about the build, so it may show a car again, but
    // with a different (purist) tune.
    const usedCars = new Set<string>();
    const usedTunes = new Set<string>();
    const picks: { category: Category; pick: Tune }[] = [];
    for (const category of CATEGORY_ORDER) {
      // Meme cars are a championship thing (owner's rule): not for trials, stunts or rivals.
      if (category === 'meme' && event.category !== 'championship') continue;
      const slots = config.suggestionsPerCategory[category];
      const carsHere = new Set<string>();
      for (const t of candidates) {
        if (carsHere.size >= slots) break;
        if (!t.categories?.includes(category) || usedTunes.has(t.id) || carsHere.has(t.carId))
          continue;
        if (category !== 'purist' && usedCars.has(t.carId)) continue;
        carsHere.add(t.carId);
        usedCars.add(t.carId);
        usedTunes.add(t.id);
        picks.push({ category, pick: t });
      }
    }

    for (const { category, pick } of picks) {
      const ev = evidence.get(pick.id)!;
      const reasons: Suggestion['reasons'] = [];
      if (ev.ranking) {
        reasons.push({
          key: ev.credited ? 'reason.tierCredited' : 'reason.tier',
          params: { tier: ev.ranking.tier, source: ev.ranking.sourceId },
        });
      }
      if (ev.lap && ev.lapRank) {
        reasons.push({
          key: 'reason.laptime',
          params: { rank: ev.lapRank, track: ev.lap.track, class: ev.lap.class },
        });
      }
      if (ev.sourceCount > 1)
        reasons.push({ key: 'reason.sources', params: { count: ev.sourceCount } });
      if (category === 'purist') reasons.push({ key: 'reason.purist' });
      if (category === 'meme') reasons.push({ key: 'reason.meme' });

      out.push({
        eventId: event.id,
        seasonId: event.seasonId,
        category,
        tuneId: pick.id,
        carId: pick.carId,
        score: pick.score ?? 0,
        confidence: pick.confidence ?? 0,
        reasons,
        origin: 'rules',
        needsGamertagSearch: pick.shareCode ? undefined : true,
      });
    }
  }
  return out;
}
