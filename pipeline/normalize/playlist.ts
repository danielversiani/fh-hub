import type { RawPlaylist } from '../adapters/types';
import { slugify } from '../lib/text';
import type { Season } from '../schema/enums';
import type { PlaylistSeason } from '../schema/entities';

export interface SeasonLabel {
  id: string;
  seriesId: string;
  series: number;
  seriesName: string;
  season?: Season;
}

/** "S07 City Life - Summer" → s07-summer; "S07 City Life" (series-wide rows) → s07. */
export function parseSeasonLabel(label: string): SeasonLabel | undefined {
  const m = /^S(\d{1,3})\s+(.+?)(?:\s+-\s+(Summer|Autumn|Winter|Spring))?$/i.exec(label.trim());
  if (!m) return undefined;
  const series = Number(m[1]);
  const seriesId = `s${String(series).padStart(2, '0')}`;
  const season = m[3]?.toLowerCase() as Season | undefined;
  return {
    id: season ? `${seriesId}-${season}` : seriesId,
    seriesId,
    series,
    seriesName: m[2]!,
    season,
  };
}

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const DAY = 86_400_000;

/**
 * Seasons in table order with dates. forza.net only states the LIVE season's last day
 * ("available through November 12"); every season lasts one week, so the other dates are
 * derived from the table order and flagged `datesDerived`.
 */
export function buildSeasons(playlist: RawPlaylist): PlaylistSeason[] {
  const labels = [...new Set(playlist.rows.map((r) => r.seasonLabel))]
    .map(parseSeasonLabel)
    .filter((l): l is SeasonLabel & { season: Season } => Boolean(l?.season));

  const current = playlist.currentSeasonLabel?.toLowerCase();
  const currentIndex = current
    ? labels.findIndex((l) => `${l.seriesName} - ${l.season}`.toLowerCase() === current)
    : -1;

  let currentEnd: Date | undefined;
  const ends = /^([A-Za-z]+)\s+(\d{1,2})$/.exec(playlist.currentSeasonEnds ?? '');
  const month = ends ? MONTHS.indexOf(ends[1]!.toLowerCase()) : -1;
  if (ends && month >= 0) {
    const reference = new Date(playlist.updatedAt ?? Date.now());
    let year = reference.getUTCFullYear();
    // "through January 7" published in late December belongs to the next year.
    if (month < reference.getUTCMonth() - 6) year += 1;
    currentEnd = new Date(Date.UTC(year, month, Number(ends[2])));
  }

  return labels.map((label, index) => {
    const known = currentEnd && currentIndex >= 0;
    const end = known
      ? new Date(currentEnd!.getTime() + (index - currentIndex) * 7 * DAY)
      : undefined;
    return {
      id: label.id,
      seriesId: label.seriesId,
      series: label.series,
      seriesName: label.seriesName,
      season: label.season,
      order: index,
      startsOn: end ? isoDate(new Date(end.getTime() - 7 * DAY)) : undefined,
      endsOn: end ? isoDate(end) : undefined,
      datesDerived: index !== currentIndex,
      current: index === currentIndex,
    };
  });
}

export type EventCategory =
  | 'championship'
  | 'trial'
  | 'weekly-challenge'
  | 'daily-challenge'
  | 'pr-stunt'
  | 'horizon-life'
  | 'rivals'
  | 'online'
  | 'photo'
  | 'treasure-hunt'
  | 'reward'
  | 'other';

export function eventCategory(type: string): EventCategory {
  if (type === 'Championship') return 'championship';
  if (/The Trial/.test(type)) return 'trial';
  if (type === 'Weekly Challenge') return 'weekly-challenge';
  if (type === 'Daily Challenge') return 'daily-challenge';
  if (/^PR Stunt/.test(type)) return 'pr-stunt';
  if (/^Horizon Life/.test(type)) return 'horizon-life';
  if (/Rivals/.test(type)) return 'rivals';
  if (/^Horizon Play|Hide & Seek|Stunt Party/.test(type)) return 'online';
  if (/Photo/.test(type)) return 'photo';
  if (/Treasure/.test(type)) return 'treasure-hunt';
  if (/Reward|Gift|Badge/.test(type)) return 'reward';
  return 'other';
}

export const eventId = (seasonId: string, type: string, name: string): string =>
  `${seasonId}--${slugify(type)}--${slugify(name) || 'event'}`;
