import { describe, expect, it } from 'vitest';
import type { RawPlaylist } from '../adapters/types';
import { buildSeasons, eventCategory, eventId, parseSeasonLabel } from './playlist';

const row = (seasonLabel: string) => ({
  row: 1,
  seasonLabel,
  reward: '',
  type: 'Championship',
  name: 'x',
  requirement: '',
  route: '',
});

describe('parseSeasonLabel', () => {
  it('season and series rows', () => {
    expect(parseSeasonLabel('S07 City Life - Summer')).toEqual({
      id: 's07-summer',
      seriesId: 's07',
      series: 7,
      seriesName: 'City Life',
      season: 'summer',
    });
    expect(parseSeasonLabel('S07 City Life')).toMatchObject({ id: 's07', season: undefined });
    expect(parseSeasonLabel('Playlist History')).toBeUndefined();
  });
});

describe('buildSeasons', () => {
  const playlist: RawPlaylist = {
    currentSeasonLabel: 'City Life - Summer',
    currentSeasonEnds: 'November 12',
    updatedAt: '2026-11-04T18:10:00Z',
    rows: [
      row('S06 Horizon Meets - Spring'),
      row('S07 City Life'),
      row('S07 City Life - Summer'),
      row('S07 City Life - Autumn'),
    ],
  };

  it('dates the live season from the page and derives the others weekly', () => {
    const seasons = buildSeasons(playlist);
    expect(seasons.map((s) => s.id)).toEqual(['s06-spring', 's07-summer', 's07-autumn']);
    expect(seasons[1]).toMatchObject({
      current: true,
      datesDerived: false,
      startsOn: '2026-11-05',
      endsOn: '2026-11-12',
    });
    expect(seasons[0]).toMatchObject({ endsOn: '2026-11-05', datesDerived: true });
    expect(seasons[2]).toMatchObject({ startsOn: '2026-11-12', endsOn: '2026-11-19' });
  });

  it('rolls the year over for January seasons published in December', () => {
    const [, live] = buildSeasons({
      ...playlist,
      currentSeasonEnds: 'January 7',
      updatedAt: '2026-12-30T00:00:00Z',
    });
    expect(live?.endsOn).toBe('2027-01-07');
  });
});

describe('events', () => {
  it('categories and ids', () => {
    expect(eventCategory('PR Stunt - Speed Trap')).toBe('pr-stunt');
    expect(eventCategory('Horizon Life - The Trial')).toBe('trial');
    expect(eventId('s07-summer', 'Championship', 'Urban Legend')).toBe(
      's07-summer--championship--urban-legend',
    );
  });
});
