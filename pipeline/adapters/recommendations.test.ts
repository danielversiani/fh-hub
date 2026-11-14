import { describe, expect, it } from 'vitest';
import { placeEventPicks } from '../build/event-picks';
import type { PlaylistEvent } from '../schema/entities';
import { parseSheetDate, splitYear } from './forza-paddock';
import { parseEventCell } from './logikj-playlist';
import { parseNoaSeasonTab, parseZhCar } from './noa-season';

describe('Forza Paddock sheet (ADR-0020)', () => {
  it('reads day-first dates, ISO dates and the "2-26" typo', () => {
    expect(parseSheetDate('25/10/2026')).toBe('2026-10-25');
    expect(parseSheetDate('21/5/2026')).toBe('2026-05-21');
    expect(parseSheetDate('30/09/2-26')).toBe('2026-09-30');
    expect(parseSheetDate('2026-05-11')).toBe('2026-05-11');
    expect(parseSheetDate('')).toBeUndefined();
  });
  it('turns two-digit years into full years', () => {
    expect(splitYear('22 Valkyrie AMR Pro')).toEqual({ year: 2022, model: 'Valkyrie AMR Pro' });
    expect(splitYear('87 #203 Porsche AG 961')).toEqual({
      year: 1987,
      model: '#203 Porsche AG 961',
    });
    expect(splitYear('GEN-F GTS')).toEqual({ model: 'GEN-F GTS' });
  });
});

describe('LogikJ playlist tabs', () => {
  it('reads the kind and name of an event', () => {
    expect(
      parseEventCell('Seasonal Championship (Street) - Ford Runner\nReward: 1994 Ford'),
    ).toEqual({ kind: 'championship', name: 'Ford Runner' });
    expect(parseEventCell('Weekly Challenge: Thriller of Autumn')).toEqual({
      kind: 'weekly-challenge',
      name: 'Thriller of Autumn',
    });
  });
});

describe("Noa Miyako's weekly tab", () => {
  it('reads Chinese makes and odd orders', () => {
    expect(parseZhCar('2005 斯巴鲁 IMPREZA WRX STI')).toMatchObject({
      text: '2005 Subaru IMPREZA WRX STI',
      year: 2005,
      make: 'Subaru',
    });
    expect(parseZhCar('丰田 Sera 1991')?.text).toBe('1991 Toyota Sera');
    expect(parseZhCar('拥有并驾驶 2554 AMG Transport Dynamics M12S Warthog CST')?.year).toBe(2554);
  });
  it('keeps rows with a tuner and share code, under the right week', () => {
    const row = (cells: Record<number, string>) =>
      Array.from({ length: 16 }, (_, i) => cells[i] ?? '');
    const picks = parseNoaSeasonTab(
      [
        row({ 2: '系列赛7 城市生活 秋季', 10: '11月12日至11月19日' }),
        row({ 0: '活动类型', 2: '活动名称' }),
        row({
          0: '季节锦标赛',
          2: '福特飞驰',
          4: '1968 福特 Mustang GT 2+2 Fastback',
          8: '车展购入 调校师: Noa Miyako 调校代码: 447977636',
        }),
        row({ 0: '每日挑战', 2: '每日挑战一', 4: '达成 1次 桶滚技术' }),
      ],
      'weekly',
    );
    expect(picks).toHaveLength(1);
    expect(picks[0]).toMatchObject({
      series: 7,
      season: 'autumn',
      kind: 'championship',
      tuner: 'Noa Miyako',
      shareCode: '447977636',
    });
  });
});

describe('placing picks on events', () => {
  const event = (id: string, type: string, name: string, carIds?: string[]) =>
    ({
      id,
      seasonId: 's07-autumn',
      type,
      name,
      requirement: { carIds },
    }) as unknown as PlaylistEvent;
  const pick = (kind: 'championship' | 'trial', eventName: string, carId: string) => ({
    sourceId: 'noa-miyako',
    carId,
    pick: {
      tab: 't',
      row: 1,
      series: 7,
      season: 'autumn' as const,
      kind,
      eventName,
      car: { text: '' },
    },
  });
  const events = [
    event('a', 'Championship', 'Blood Gulch & Gears', ['warthog']),
    event('b', 'Championship', 'Ford Runner', ['mustang', 'escort']),
    event('c', 'Horizon Life - The Trial', 'Red vs. Blue', ['impreza']),
  ];

  it('uses the eligible cars to tell events of the same kind apart', () => {
    const { placed } = placeEventPicks(
      [pick('championship', '福特飞驰', 'mustang')],
      events,
      new Map(),
    );
    expect(placed.map((p) => p.eventId)).toEqual(['b']);
  });
  it('trusts the sheet when the week has a single event of that kind', () => {
    const { placed } = placeEventPicks([pick('trial', 'Red vs Blue', 'evo')], events, new Map());
    expect(placed.map((p) => p.eventId)).toEqual(['c']);
  });
  it('leaves a pick out when no event fits', () => {
    const { unplaced } = placeEventPicks([pick('championship', 'x', 'ferrari')], events, new Map());
    expect(unplaced).toHaveLength(1);
  });
});
