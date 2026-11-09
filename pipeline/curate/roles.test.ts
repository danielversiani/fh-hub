import { describe, expect, it } from 'vitest';
import type { Dataset } from '../build/dataset';
import type { ListEntry, MetaRanking, RivalsStat } from '../schema/entities';
import { computeRoles } from './roles';

const meta = (carId: string, tier: MetaRanking['tier']): MetaRanking => ({
  sourceId: 'noa-miyako',
  tab: 's1-road',
  row: 1,
  class: 'S1',
  surface: 'road',
  carId,
  tier,
  rank: 1,
  tunerIds: [],
});
const list = (
  sourceId: string,
  carId: string,
  level: ListEntry['level'],
  extra: Partial<ListEntry> = {},
): ListEntry => ({
  sourceId,
  carId,
  class: 'S1',
  surface: 'road',
  level,
  label: level,
  tunerIds: [],
  ...extra,
});
const stat = (carId: string, top10: number): RivalsStat => ({
  sourceId: 'fhstats',
  carId,
  class: 'S1',
  surface: 'road',
  top10,
  top50: top10 * 3,
  wins: 0,
});

const dataset = (d: Partial<Dataset>): Dataset =>
  ({
    meta: [],
    lists: [],
    rivalsStats: [],
    rivals: [],
    tunes: [],
    highlights: [],
    featured: [],
    brainAfk: [],
    tierOverrides: [],
    ...d,
  }) as unknown as Dataset;

const role = (roles: ReturnType<typeof computeRoles>, carId: string) =>
  roles.find((r) => r.carId === carId)?.role;

describe('computeRoles (alternatives formula, ADR-0017)', () => {
  it('two top votes make a car meta', () => {
    const roles = computeRoles(
      dataset({ meta: [meta('w1', 'meta')], lists: [list('fhstats', 'w1', 'meta-plus')] }),
    );
    expect(role(roles, 'w1')).toBe('meta');
  });

  it('a well-rated car without top votes is an alternative', () => {
    const roles = computeRoles(
      dataset({ meta: [meta('viper', 't1')], lists: [list('fhstats', 'viper', 'strong')] }),
    );
    expect(role(roles, 'viper')).toBe('alternative');
  });

  it('a weakly rated car is "other"; niche is only set by hand', () => {
    const roles = computeRoles(
      dataset({
        meta: [meta('slow', 't3'), meta('r390', 't1.5')],
        tierOverrides: [{ carId: 'r390', class: 'S1', surface: 'road', tier: 'niche' }],
      }),
    );
    expect(roles.find((r) => r.carId === 'slow')).toMatchObject({ role: 'other', tier: 'other' });
    expect(roles.find((r) => r.carId === 'r390')).toMatchObject({ role: 'niche', tier: 'niche' });
  });

  it('Meta+: unanimous, or a Meta+/Meta split strong in Rivals; unranked picks stay out', () => {
    const roles = computeRoles(
      dataset({
        meta: [meta('se048', 'meta'), meta('w1', 'meta'), meta('essenza', 't0.5')],
        lists: [
          list('fhstats', 'se048', 'meta-plus'),
          list('attax-johnson', 'se048', 'pick'),
          list('fhstats', 'w1', 'meta-plus'),
          list('fhstats', 'essenza', 'meta-plus'),
          list('logikj', 'essenza', 'meta'),
        ],
        rivalsStats: [stat('se048', 70), stat('leader', 90)],
      }),
    );
    expect(roles.find((r) => r.carId === 'se048')?.tier).toBe('meta-plus');
    expect(roles.find((r) => r.carId === 'w1')?.tier).toBe('meta');
    expect(roles.find((r) => r.carId === 'essenza')?.tier).toBe('meta');
  });

  it('a single pure-handling build only adds the rivals tag', () => {
    const roles = computeRoles(
      dataset({
        meta: [meta('r8', 't0.5')],
        lists: [
          list('fhstats', 'r8', 'meta'),
          list('logikj', 'r8', 'offmeta', { style: 'handling', extreme: true }),
        ],
      }),
    );
    expect(roles.find((r) => r.carId === 'r8')).toMatchObject({
      tier: 'off-meta',
      tags: ['rivals'],
    });
  });

  it('gives the platform tiers: Meta+ for the strongest meta, Off-meta for alternatives', () => {
    const roles = computeRoles(
      dataset({
        meta: [meta('w1', 'meta-plus'), meta('viper', 't1')],
        lists: [list('fhstats', 'w1', 'meta-plus'), list('fhstats', 'viper', 'strong')],
      }),
    );
    expect(roles.find((r) => r.carId === 'w1')?.tier).toBe('meta-plus');
    expect(roles.find((r) => r.carId === 'viper')?.tier).toBe('off-meta');
  });

  it("keeps the site's first-seen date and calls a car new only when first seen lately", () => {
    const d = dataset({
      lists: [
        list('fhstats', 'fresh', 'strong'),
        list('logikj', 'fresh', 'strong'),
        list('fhstats', 'old', 'strong'),
        list('logikj', 'old', 'strong'),
      ],
      firstSeen: { 'old|S1|road': '2026-06-01' },
      today: '2026-11-09',
    });
    const roles = computeRoles(d);
    expect(roles.find((r) => r.carId === 'fresh')).toMatchObject({
      firstSeen: '2026-11-09',
      tags: ['recent'],
    });
    expect(roles.find((r) => r.carId === 'old')?.tags).toBeUndefined();
  });

  it('on the first run of the record, cars already listed are not new', () => {
    const roles = computeRoles(
      dataset({
        lists: [list('fhstats', 'a', 'strong'), list('logikj', 'a', 'strong')],
        firstSeen: {},
        firstSeenBaseline: '2026-05-19',
        today: '2026-11-09',
      }),
    );
    expect(roles[0]).toMatchObject({ firstSeen: '2026-05-19' });
    expect(roles[0]?.tags).toBeUndefined();
  });

  it('mostly pure-handling builds: "other" tier with the rivals tag', () => {
    const roles = computeRoles(
      dataset({
        lists: [
          list('attax-johnson', 'exocet', 'pick', { style: 'handling', extreme: true }),
          list('fhstats', 'exocet', 'strong'),
        ],
      }),
    );
    expect(roles.find((r) => r.carId === 'exocet')).toMatchObject({
      role: 'other',
      tags: ['rivals'],
    });
  });

  it('the fhstats build style alone is not enough for the rivals tag', () => {
    const roles = computeRoles(
      dataset({ lists: [list('fhstats', 'mustang', 'strong', { style: 'power', extreme: true })] }),
    );
    expect(role(roles, 'mustang')).toBe('alternative');
  });

  it('a Rivals stat with no top-10 does not pull a car down', () => {
    const roles = computeRoles(
      dataset({
        lists: [list('fhstats', 'svj', 'offmeta')],
        rivalsStats: [stat('svj', 0), stat('leader', 100)],
      }),
    );
    expect(role(roles, 'svj')).toBe('alternative');
  });

  it('cars listed by 3+ sources for 90+ days are well known and go down the list', () => {
    const old = '2026-05-20';
    const roles = computeRoles(
      dataset({
        meta: [meta('mclaren', 't1'), meta('fresh', 't1')],
        lists: [
          list('fhstats', 'mclaren', 'strong', { date: old }),
          list('logikj', 'mclaren', 'strong', { date: '2026-09-01' }),
          list('fhstats', 'fresh', 'strong', { date: '2026-09-01' }),
          list('logikj', 'fresh', 'strong', { date: '2026-09-01' }),
        ],
      }),
    );
    const mclaren = roles.find((r) => r.carId === 'mclaren')!;
    const fresh = roles.find((r) => r.carId === 'fresh')!;
    expect(mclaren.wellKnown).toBe(true);
    expect(fresh.wellKnown).toBeUndefined();
    expect(fresh.rank).toBeLessThan(mclaren.rank);
  });

  it('is deterministic', () => {
    const d = dataset({
      meta: [meta('a', 't1'), meta('b', 't1')],
      lists: [list('fhstats', 'a', 'strong'), list('fhstats', 'b', 'strong')],
    });
    expect(computeRoles(d)).toEqual(computeRoles(d));
  });
});

describe('highlights (ADR-0017)', () => {
  it('tags a car first listed in the last weeks by 2+ dated sources as a recent find', () => {
    const roles = computeRoles(
      dataset({
        lists: [
          list('fhstats', 'fresh', 'strong', { date: '2026-11-01' }),
          list('logikj', 'fresh', 'strong', { date: '2026-11-03' }),
          list('logikj', 'old', 'strong', { date: '2026-05-20' }),
        ],
      }),
    );
    expect(roles.find((r) => r.carId === 'fresh')?.tags).toContain('recent');
  });

  it('does not call a car recent when an undated list also has it', () => {
    const roles = computeRoles(
      dataset({
        meta: [meta('fresh', 't1')],
        lists: [
          list('fhstats', 'fresh', 'strong', { date: '2026-11-01' }),
          list('logikj', 'old', 'strong', { date: '2026-05-20' }),
        ],
      }),
    );
    expect(roles.find((r) => r.carId === 'fresh')?.tags).toBeUndefined();
  });

  it('tags a car strong in Rivals but cited by one list as a sleeper', () => {
    const roles = computeRoles(
      dataset({
        lists: [list('fhstats', 'hidden', 'offmeta')],
        rivalsStats: [stat('hidden', 30), stat('leader', 100)],
      }),
    );
    expect(roles.find((r) => r.carId === 'hidden')?.tags).toContain('sleeper');
  });

  it('adds the platform pick even when no source lists the car', () => {
    const roles = computeRoles(
      dataset({
        featured: [{ carId: 'mine', class: 'S1', surface: 'road', date: '2026-11-09' }],
      }),
    );
    expect(roles.find((r) => r.carId === 'mine')).toMatchObject({
      role: 'alternative',
      tags: ['featured'],
    });
  });
});
