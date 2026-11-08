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
 * Rule-based curation (docs/CURATION.md, ADR-0008): a score per tune from several signals,
 * categories (Meta / Off-meta / Purist / Meme) and suggestions per Festival Playlist event.
 * Pure and deterministic: the same dataset and config always produce the same output.
 */

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
const FAST_CLASSES = new Set(['S1', 'S2', 'R', 'X']);
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

export function curate(
  dataset: Dataset,
  config: CurationConfig,
  sources: readonly SourceDef[],
): CurationResult {
  const sourceWeight = new Map(sources.map((s) => [s.id, s.weight]));
  const cars = new Map(dataset.cars.map((c) => [c.id, c]));

  // Best meta ranking per car × class × surface (several sources may rank the same car).
  const rankings = new Map<string, MetaRanking>();
  for (const m of dataset.meta) {
    const key = `${m.carId}|${m.class}|${m.surface}`;
    const current = rankings.get(key);
    if (!current || TIER_VALUE[m.tier] > TIER_VALUE[current.tier]) rankings.set(key, m);
  }

  // Lap times: best per car × class, and the class record for normalisation.
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
    let credited = false;
    const ranking =
      tune.class && tune.surface
        ? rankings.get(`${tune.carId}|${tune.class}|${tune.surface}`)
        : undefined;
    if (ranking) {
      credited = ranking.tunerIds.includes(tune.tunerId);
      signals.tier =
        TIER_VALUE[ranking.tier] * (credited ? 1 : config.thresholds.unlistedTunerTierFactor);
      if (ranking.difficulty) signals.ease = EASE_VALUE[ranking.difficulty];
    }

    const lap =
      tune.class && tune.surface === 'road' ? laps.get(`${tune.carId}|${tune.class}`) : undefined;
    if (lap) {
      const best = classBest.get(lap.class)!;
      const sameTuner = lap.tunerId === tune.tunerId;
      signals.laptime =
        Math.max(0, 1 - ((lap.timeMs - best) / best) * 20) *
        (sameTuner ? 1 : config.thresholds.unlistedTunerTierFactor);
      if (signals.ease === undefined && lap.difficulty) signals.ease = EASE_VALUE[lap.difficulty];
    }

    const sourceIds = [...new Set(tune.observations.map((o) => o.sourceId))];
    const endorsement = sourceIds.reduce((sum, id) => sum + (sourceWeight.get(id) ?? 0.5), 0);
    signals.endorsement = Math.min(1, Math.log2(1 + endorsement) / Math.log2(4));
    signals.tuner = config.tuners[tune.tunerId] ?? 0.5;

    if (tune.createdAt) {
      if (config.lastPhysicsPatch) {
        signals.recency = tune.createdAt >= config.lastPhysicsPatch ? 1 : 0.4;
      } else if (newest) {
        const ageDays = (Date.parse(newest) - Date.parse(tune.createdAt)) / 86_400_000;
        signals.recency = 1 - Math.min(1, ageDays / 365) * 0.7;
      }
    }

    for (const key of Object.keys(signals) as Signal[]) signals[key] = round(signals[key]!);
    return {
      signals,
      ranking,
      credited,
      lap,
      lapRank: lap ? lapRank.get(`${lap.carId}|${lap.class}`) : undefined,
      sourceCount: sourceIds.length,
    };
  };

  const memeWords = config.categories.memeKeywords.map((w) => w.toLowerCase());
  const memeTypes = new Set(config.categories.memeCarTypes);

  const categorize = (tune: Tune, ev: Evidence, score: number, confidence: number): Category[] => {
    const car = cars.get(tune.carId);
    const tier = ev.ranking?.tier;
    const lapTier = ev.lap?.tierLabel ?? '';
    const categories: Category[] = [];
    const meta =
      confidence >= config.thresholds.minConfidenceForMeta &&
      ((tier !== undefined && config.categories.metaTiers.includes(tier)) ||
        /^meta/i.test(lapTier));
    if (meta) categories.push('meta');
    else if (
      (tier !== undefined && config.categories.offMetaTiers.includes(tier)) ||
      /off-?meta/i.test(lapTier) ||
      /off-?meta/i.test(tune.name) ||
      score >= config.thresholds.offMetaMinScore
    ) {
      categories.push('off-meta');
    }
    if (tune.buildTags.includes('purist')) categories.push('purist');
    const name = tune.name.toLowerCase();
    const memeName = memeWords.some((w) => new RegExp(`\\b${w}\\b`).test(name));
    const memeCar =
      tune.surface === 'road' &&
      tune.class !== null &&
      FAST_CLASSES.has(tune.class) &&
      (car?.carTypes.some((t) => memeTypes.has(t)) ?? false);
    if (memeName || memeCar) categories.push('meme');
    return categories;
  };

  const playlistScore = new Map<string, { score: number; confidence: number; ev: Evidence }>();
  const tunes = dataset.tunes.map((tune) => {
    const ev = evidence(tune);
    const general = weighted(ev.signals, config.weights);
    playlistScore.set(tune.id, { ...weighted(ev.signals, config.weightsPlaylist), ev });
    return {
      ...tune,
      score: general.score,
      confidence: general.confidence,
      categories: categorize(tune, ev, general.score, general.confidence),
    };
  });

  return { tunes, suggestions: suggest(dataset, config, tunes, playlistScore, cars) };
}

const isObtainable = (car: Car | undefined) =>
  car?.acquisition?.methods.some((m) => m === 'autoshow' || m === 'wheelspin') ?? false;

function suggest(
  dataset: Dataset,
  config: CurationConfig,
  tunes: Tune[],
  scores: Map<string, { score: number; confidence: number; ev: Evidence }>,
  cars: Map<string, Car>,
): Suggestion[] {
  const current = dataset.seasons.find((s) => s.current);
  const seasonOrder = new Map(dataset.seasons.map((s) => [s.id, s.order]));
  const minOrder = current ? current.order - config.pastSeasonsWithSuggestions : -Infinity;
  const inWindow = (e: PlaylistEvent) => {
    const order = seasonOrder.get(e.seasonId);
    // Series-wide rows (e.g. monthly rivals) follow their series' live state.
    if (order === undefined) return !current || e.seriesId === current.seriesId;
    return order >= minOrder;
  };

  const out: Suggestion[] = [];
  for (const event of dataset.events) {
    const req = event.requirement;
    if (!inWindow(event) || (req.status !== 'parsed' && req.status !== 'partial')) continue;
    if (!req.class && !req.carIds) continue;
    const allowed = req.carIds ? new Set(req.carIds) : undefined;
    const candidates = tunes
      .filter(
        (t) =>
          (!req.class || t.class === req.class) &&
          (!allowed || allowed.has(t.carId)) &&
          (!event.surface || t.surface === event.surface),
      )
      .map((t) => {
        const s = scores.get(t.id)!;
        const penalty = config.preferObtainable && !isObtainable(cars.get(t.carId)) ? 0.9 : 1;
        return { tune: t, rank: round(s.score * penalty), ...s };
      })
      .sort(
        (a, b) =>
          Number(Boolean(b.tune.shareCode)) - Number(Boolean(a.tune.shareCode)) ||
          b.rank - a.rank ||
          b.ev.sourceCount - a.ev.sourceCount ||
          a.tune.id.localeCompare(b.tune.id),
      );

    const usedTunes = new Set<string>();
    const usedCars = new Set<string>();
    for (const category of CATEGORY_ORDER) {
      const pool = candidates.filter(
        (c) => c.tune.categories?.includes(category) && !usedTunes.has(c.tune.id),
      );
      const pick = pool.find((c) => !usedCars.has(c.tune.carId)) ?? pool[0];
      if (!pick) continue;
      usedTunes.add(pick.tune.id);
      usedCars.add(pick.tune.carId);

      const reasons: Suggestion['reasons'] = [];
      const ev = pick.ev;
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
      if (req.status === 'partial') reasons.push({ key: 'reason.checkEligibility' });
      if (pick.confidence < config.thresholds.minConfidenceForMeta)
        reasons.push({ key: 'reason.lowData' });

      out.push({
        eventId: event.id,
        seasonId: event.seasonId,
        category,
        tuneId: pick.tune.id,
        carId: pick.tune.carId,
        score: pick.score,
        confidence: pick.confidence,
        reasons,
        origin: 'rules',
        needsGamertagSearch: pick.tune.shareCode ? undefined : true,
      });
    }
  }
  return out;
}
