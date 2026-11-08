import { describe, expect, it } from 'vitest';
import type { PlaylistEvent } from '../../pipeline/schema/entities';
import { eventName, eventTypeLabel, formatReward, formatTarget, requirementText } from './playlist';

const event = (over: Partial<PlaylistEvent>): PlaylistEvent => ({
  id: 'e',
  seasonId: 's07-summer',
  seriesId: 's07',
  type: 'Championship',
  category: 'championship',
  name: 'Test',
  requirementRaw: '',
  requirement: { status: 'parsed', scope: 'any' },
  routeRaw: '',
  routes: [],
  surface: null,
  row: 1,
  ...over,
});

describe('playlist texts in Portuguese', () => {
  it('names event types and car types in Portuguese', () => {
    expect(eventTypeLabel('pt-br', 'PR Stunt - Speed Trap')).toBe('Acrobacia de RP · Radar');
    expect(eventTypeLabel('en', 'PR Stunt - Speed Trap')).toBe('PR Stunt · Speed Trap');
    const req = (scopeLabel: string) =>
      requirementText(
        'pt-br',
        event({ requirement: { status: 'parsed', scope: 'car-type', scopeLabel } }),
      );
    expect(req('Retro Hot Hatch')).toBe('Hot hatch retrô');
    expect(req('1980s Total Rally')).toBe('Anos 1980 · Rali (todos)');
    expect(req('Unknown Type')).toBe('Unknown Type');
  });

  it('translates rewards and reward rows', () => {
    expect(formatReward('pt-br', 'Super Wheelspin')).toBe('Superroleta');
    expect(formatReward('pt-br', 'Car Horn: Halo Theme')).toBe('Buzina: Halo Theme');
    expect(formatReward('pt-br', 'Car: 2009 Ferrari 458 Italia')).toBe('2009 Ferrari 458 Italia');
    expect(eventName('pt-br', event({ name: 'Season Reward 2' }))).toBe(
      'Recompensa da temporada 2',
    );
  });

  it('shows PR stunt goals in metric units in Portuguese', () => {
    expect(
      formatTarget('pt-br', { kind: 'speed', value: 110, unit: 'mph', raw: '110.0 mph' }),
    ).toBe('177 km/h (110 mph)');
    expect(
      formatTarget('pt-br', { kind: 'distance', value: 698.8, unit: 'ft', raw: '698.8 feet' }),
    ).toBe('213 m');
    expect(formatTarget('en', { kind: 'speed', value: 110, unit: 'mph', raw: '110.0 mph' })).toBe(
      '110.0 mph',
    );
  });
});
