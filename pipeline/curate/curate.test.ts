import { describe, expect, it } from 'vitest';
import type { Dataset } from '../build/dataset';
import { stableStringify } from '../lib/json';
import type { Car, MetaRanking, PlaylistEvent, Tune } from '../schema/entities';
import type { SourceDef } from '../schema/source';
import { loadCurationConfig } from './config';
import { curate } from './index';

const config = loadCurationConfig();

const car = (id: string, carTypes: string[] = ['Track Toys']): Car => ({
  id,
  year: 2020,
  make: 'Test',
  model: id,
  displayName: id,
  carTypes,
  acquisition: { raw: 'Autoshow', methods: ['autoshow'] },
  sourceIds: ['cars'],
});

const tune = (id: string, carId: string, tunerId: string, extra: Partial<Tune> = {}): Tune => ({
  id,
  carId,
  tunerId,
  name: `${carId} tune`,
  class: 'S1',
  surface: 'road',
  buildTags: [],
  shareCode: id.replace('sc-', ''),
  observations: [{ sourceId: 'sheet', tab: 't', row: 1, raw: {} }],
  ...extra,
});

const ranking = (carId: string, tier: MetaRanking['tier'], tunerIds: string[]): MetaRanking => ({
  sourceId: 'meta',
  tab: 's1-road',
  row: 1,
  class: 'S1',
  surface: 'road',
  carId,
  tier,
  rank: 1,
  tunerIds,
});

const event: PlaylistEvent = {
  id: 's07-summer--championship--test',
  seasonId: 's07-summer',
  seriesId: 's07',
  type: 'Championship',
  category: 'championship',
  name: 'Test',
  requirementRaw: 'S1 Class',
  requirement: { status: 'parsed', scope: 'any', class: 'S1' },
  routeRaw: 'Road: X Circuit',
  routes: [{ name: 'X Circuit', discipline: 'circuit' }],
  surface: 'road',
  row: 1,
};

const dataset: Dataset = {
  cars: [
    car('fast'),
    car('ok'),
    car('2013-wuling-sunshine-s', ['Utility Heroes']),
    car('dirt-car'),
  ],
  tuners: [],
  tunes: [
    tune('sc-100000001', 'fast', 'alice'),
    tune('sc-100000002', 'ok', 'bob'),
    tune('sc-100000003', 'ok', 'carol', { buildTags: ['purist'], name: 'ok purist' }),
    tune('sc-100000004', '2013-wuling-sunshine-s', 'dave'),
    tune('sc-100000005', 'dirt-car', 'erin', { surface: 'dirt' }),
  ],
  lapTimes: [],
  customEvents: [],
  meta: [ranking('fast', 'meta-plus', ['alice']), ranking('ok', 't1', [])],
  highlights: [],
  seasons: [
    {
      id: 's07-summer',
      seriesId: 's07',
      series: 7,
      seriesName: 'City Life',
      season: 'summer',
      order: 0,
      datesDerived: false,
      current: true,
    },
  ],
  events: [event],
  review: [],
};

const sources = [
  { id: 'sheet', weight: 0.8 },
  { id: 'meta', weight: 0.9 },
] as SourceDef[];

describe('curate', () => {
  const result = curate(dataset, config, sources);
  const byId = new Map(result.tunes.map((t) => [t.id, t]));

  it('rates a credited meta tune above an off-meta one', () => {
    expect(byId.get('sc-100000001')!.score!).toBeGreaterThan(byId.get('sc-100000002')!.score!);
    expect(byId.get('sc-100000001')!.categories).toContain('meta');
    expect(byId.get('sc-100000002')!.categories).toContain('off-meta');
  });

  it('tags purist builds and the meme car list', () => {
    expect(byId.get('sc-100000003')!.categories).toContain('purist');
    expect(byId.get('sc-100000004')!.categories).toContain('meme');
  });

  it('uses the meta table tier, and T3 for cars the table does not list', () => {
    expect(byId.get('sc-100000001')).toMatchObject({
      tier: 'meta-plus',
      tierSource: 'meta-table',
      credited: true,
    });
    expect(byId.get('sc-100000004')).toMatchObject({ tier: 't3', tierSource: 'default' });
    expect(byId.get('sc-100000004')!.categories).not.toContain('off-meta');
  });

  it('does not suggest when eligibility cannot be checked', () => {
    const partial = {
      ...event,
      id: 'partial',
      requirement: { ...event.requirement, status: 'partial' as const },
    };
    const r = curate({ ...dataset, events: [partial] }, config, sources);
    expect(r.suggestions).toHaveLength(0);
  });

  it('fills the four slots in order without repeating a tune and respecting the surface', () => {
    const picks = result.suggestions.filter((s) => s.eventId === event.id);
    expect(picks.map((p) => p.category)).toEqual(['meta', 'off-meta', 'purist', 'meme']);
    expect(picks[0]?.tuneId).toBe('sc-100000001');
    expect(new Set(picks.map((p) => p.tuneId)).size).toBe(picks.length);
    expect(picks.some((p) => p.carId === 'dirt-car')).toBe(false);
    expect(picks[0]?.reasons[0]).toMatchObject({ key: 'reason.tierCredited' });
  });

  it('suggests several cars per category, each car once', () => {
    const more: Dataset = {
      ...dataset,
      cars: [...dataset.cars, car('fast2'), car('fast3')],
      tunes: [
        ...dataset.tunes,
        tune('sc-100000006', 'fast2', 'frank'),
        tune('sc-100000007', 'fast3', 'gina'),
        tune('sc-100000008', 'fast', 'hank'),
      ],
      meta: [...dataset.meta, ranking('fast2', 'meta', ['frank']), ranking('fast3', 't0.5', [])],
    };
    const picks = curate(more, config, sources).suggestions.filter(
      (s) => s.eventId === event.id && s.category === 'meta',
    );
    expect(picks.map((p) => p.carId)).toEqual(['fast', 'fast2', 'fast3']);
    expect(picks[0]?.tuneId).toBe('sc-100000001');
  });

  it('keeps meme cars for championships only', () => {
    const trial = { ...event, id: 'trial', type: 'Trial', category: 'trial' as const };
    const r = curate({ ...dataset, events: [trial] }, config, sources);
    expect(r.suggestions.some((s) => s.category === 'meme')).toBe(false);
    expect(r.suggestions.length).toBeGreaterThan(0);
  });

  it("copies the meta table's columns to the credited tuner's tune only", () => {
    const withColumns: Dataset = {
      ...dataset,
      meta: [
        {
          ...ranking('fast', 'meta-plus', ['alice']),
          difficulty: 'hard',
          role: 'power',
          notes: '白川1:04.3',
          lapRefs: [{ track: 'Shirakawa', time: '1:04.3' }],
        },
      ],
      tunes: [...dataset.tunes, tune('sc-100000009', 'fast', 'ivan')],
    };
    const tunes = new Map(curate(withColumns, config, sources).tunes.map((t) => [t.id, t]));
    expect(tunes.get('sc-100000001')).toMatchObject({
      difficulty: 'hard',
      role: 'power',
      metaNotes: '白川1:04.3',
      lapRefs: [{ track: 'Shirakawa', time: '1:04.3' }],
    });
    expect(tunes.get('sc-100000009')?.difficulty).toBeUndefined();
  });

  it('is deterministic', () =>
    expect(stableStringify(curate(dataset, config, sources))).toBe(stableStringify(result)));
});
