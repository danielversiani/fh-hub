import { describe, expect, it } from 'vitest';
import type { CarRole, Tune } from '../schema/entities';
import { markBrainAfk } from './brain-afk';

const tune = (id: string, carId: string, difficulty?: Tune['difficulty']): Tune =>
  ({
    id,
    carId,
    tunerId: 'noa-miyako',
    class: 'S1',
    surface: 'road',
    difficulty,
    credited: true,
  }) as unknown as Tune;
const role = (carId: string, tier: CarRole['tier']): CarRole => ({
  carId,
  class: 'S1',
  surface: 'road',
  role: tier === 'off-meta' ? 'alternative' : tier === 'meta-plus' ? 'meta' : (tier as 'meta'),
  tier,
  rank: 1,
  sources: 2,
  evidence: [],
});

describe('markBrainAfk (ADR-0018)', () => {
  const roles = [role('787b', 'meta-plus'), role('svj', 'meta')];

  it('marks the easy recommended tune of Meta+ cars automatically', () => {
    const [a, b, c] = markBrainAfk(
      [
        tune('sc-000000001', '787b', 'easy'),
        tune('sc-000000002', '787b', 'hard'),
        tune('sc-000000003', 'svj', 'easy'),
      ],
      roles,
      { brainAfk: [] },
    );
    expect(a?.brainAfk).toBe('auto');
    expect(b?.brainAfk).toBeUndefined();
    expect(c?.brainAfk).toBeUndefined();
  });

  it('lets the curator mark a tune or remove an automatic mark', () => {
    const [a, c] = markBrainAfk(
      [tune('sc-000000001', '787b', 'easy'), tune('sc-000000003', 'svj', 'easy')],
      roles,
      {
        brainAfk: [
          { carId: '787b', class: 'S1', brainAfk: false },
          { carId: 'svj', tuner: 'Noa Miyako', brainAfk: true },
        ],
      },
    );
    expect(a?.brainAfk).toBeUndefined();
    expect(c?.brainAfk).toBe('curator');
  });
});
