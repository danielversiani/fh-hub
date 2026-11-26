import { describe, expect, it } from 'vitest';
import { easeRank, orderPicks, selectPicks, swapRank, tooHard } from './guide-picks';

const tune = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id,
  score: 0.5,
  cls: 'B' as const,
  surface: 'road' as const,
  ...extra,
});

describe('guide tune boxes (ADR-0024)', () => {
  it('ranks a tune by whether it keeps the stock drivetrain', () => {
    expect(swapRank('RWD', 'RWD')).toBe(0);
    expect(swapRank(undefined, 'RWD')).toBe(1);
    expect(swapRank('AWD', undefined)).toBe(1);
    expect(swapRank('AWD', 'RWD')).toBe(2);
  });

  it('ranks easy tunes first and leaves hard ones and powerbuilds out', () => {
    expect(easeRank({ name: 'x', difficulty: 'very-easy' })).toBe(0);
    expect(easeRank({ name: 'x' })).toBe(1);
    expect(easeRank({ name: 'x', difficulty: 'medium' })).toBe(2);
    expect(easeRank({ name: 'B OFFROAD POWER' })).toBe(2);
    expect(tooHard({ name: 'x', difficulty: 'death' })).toBe(true);
    expect(tooHard({ name: 'x', difficulty: 'hard' })).toBe(true);
    expect(tooHard({ name: 'S1 Road Powerbuild' })).toBe(true);
    expect(tooHard({ name: 'Purist', difficulty: 'easy' })).toBe(false);
  });

  it('puts stock-drivetrain tunes first, even above a better tier with a code', () => {
    const tunes = [
      tune('swap-meta-code', { drivetrain: 'AWD', code: '111111111', tier: 'meta', score: 0.9 }),
      tune('unknown', { code: '222222222', tier: 't1', score: 0.6 }),
      tune('keep-t2', { drivetrain: 'RWD', tier: 't2' }),
      tune('keep-t1-code', { drivetrain: 'RWD', code: '333333333', tier: 't1', score: 0.4 }),
    ];
    expect(orderPicks(tunes, 'RWD').map((t) => t.id)).toEqual([
      'keep-t1-code',
      'keep-t2',
      'unknown',
      'swap-meta-code',
    ]);
  });

  it('falls back to code, tier and score when the stock drivetrain is unknown', () => {
    const tunes = [
      tune('no-code', { drivetrain: 'AWD', tier: 'meta', score: 0.9 }),
      tune('code-t1', { drivetrain: 'AWD', code: '1', tier: 't1' }),
      tune('code-meta', { drivetrain: 'RWD', code: '2', tier: 'meta', score: 0.4 }),
    ];
    expect(orderPicks(tunes).map((t) => t.id)).toEqual(['code-meta', 'code-t1', 'no-code']);
  });

  it('shows pinned tunes, then the Forza Paddock picks, then easy ones', () => {
    const tunes = [
      tune('meta-death', { drivetrain: 'RWD', code: '1', tier: 'meta-plus', difficulty: 'death' }),
      tune('keep-unknown', { drivetrain: 'RWD', code: '2', tier: 'meta' }),
      tune('keep-easy', { drivetrain: 'RWD', difficulty: 'easy', tier: 't2' }),
      tune('paddock', { drivetrain: 'RWD', recommended: true, tier: 't3' }),
      tune('pinned-awd', { drivetrain: 'AWD', cls: 'A' }),
      tune('other-class', { drivetrain: 'RWD', cls: 'A', difficulty: 'easy' }),
    ];
    const ids = (pins: string[]) =>
      selectPicks(tunes, { cls: 'B', surface: 'road', stockDrivetrain: 'RWD', pins, limit: 9 }).map(
        (t) => t.id,
      );
    expect(ids([])).toEqual(['paddock', 'keep-easy', 'keep-unknown']);
    expect(ids(['pinned-awd', 'gone-from-catalogue'])).toEqual([
      'pinned-awd',
      'paddock',
      'keep-easy',
      'keep-unknown',
    ]);
  });
});
