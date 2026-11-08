import type { EventTarget, PlaylistEvent } from '../../pipeline/schema/entities';
import { slugify } from '../../pipeline/lib/text';
import { formatNumber, t, tMaybe, type Locale, type MessageKey } from '../i18n';

const RARITY_KEYS = new Set<string>(
  ['common', 'rare', 'epic', 'legendary', 'forza-edition'].map((r) => `rarity.${r}`),
);

/** A car type ("Retro Hot Hatch") in the site's language; unknown types stay as written. */
export const carTypeLabel = (locale: Locale, type: string): string =>
  tMaybe(locale, `carType.${slugify(type)}`, type);

/** "PR Stunt - Speed Trap" → "Acrobacia de RP · Radar". */
export const eventTypeLabel = (locale: Locale, type: string): string =>
  tMaybe(locale, `eventType.${slugify(type)}`, type);

/** Event names stay as forza.net writes them, except the generic reward rows. */
export function eventName(locale: Locale, event: PlaylistEvent): string {
  const reward = /^(Season|Series) Reward (\d+)$/i.exec(event.name);
  if (!reward) return event.name;
  const key = reward[1]!.toLowerCase() === 'season' ? 'reward.seasonReward' : 'reward.seriesReward';
  return t(locale, key, { n: reward[2]! });
}

/** What a challenge without a car asks for, translated when we have the text. */
export const challengeText = (locale: Locale, event: PlaylistEvent): string =>
  event.requirementI18n?.[locale] || event.requirementRaw;

const REWARD_PREFIXES: [RegExp, MessageKey][] = [
  [/^Car Horn:\s*/i, 'reward.horn'],
  [/^Clothing:\s*/i, 'reward.clothing'],
  [/^Quick ?Chat:\s*/i, 'reward.quickchat'],
  [/^Emote:\s*/i, 'reward.emote'],
  [/^Badge:\s*/i, 'reward.badge'],
];

/** "Car: 2009 Ferrari 458 Italia" → "2009 Ferrari 458 Italia"; "Credits: 150000" → "150.000 CR". */
export function formatReward(locale: Locale, reward: string | undefined): string | undefined {
  if (!reward) return undefined;
  const car = /^Car:\s*(.+)$/i.exec(reward);
  if (car) return car[1];
  const credits = /^Credits:\s*([\d,.]+)$/i.exec(reward);
  if (credits) return `${formatNumber(locale, Number(credits[1]!.replace(/[,.]/g, '')))} CR`;
  if (/^Super Wheelspin$/i.test(reward)) return t(locale, 'reward.superWheelspin');
  if (/^Wheelspin$/i.test(reward)) return t(locale, 'reward.wheelspin');
  for (const [prefix, key] of REWARD_PREFIXES) {
    if (prefix.test(reward)) return `${t(locale, key)}: ${reward.replace(prefix, '')}`;
  }
  return reward;
}

/** A PR stunt / time attack goal; in Portuguese, imperial units become metric. */
export function formatTarget(locale: Locale, target: EventTarget): string {
  if (locale === 'en') return target.raw;
  switch (target.unit) {
    case 'mph':
      return `${formatNumber(locale, Math.round(target.value * 1.609344))} km/h (${formatNumber(locale, target.value)} mph)`;
    case 'ft':
      return `${formatNumber(locale, Math.round(target.value * 0.3048 * 10) / 10)} m`;
    case 'pts':
      return t(locale, 'playlist.points', { n: formatNumber(locale, target.value) });
    default:
      return target.raw;
  }
}

/** Translates the car-type parts of a restriction ("1980s Total Rally", "Honda & Acura"). */
function subjectLabel(locale: Locale, label: string): string {
  const decade = /^(\d{3}0)s\s*(.*)$/.exec(label);
  if (decade) {
    const rest = decade[2] ? ` · ${subjectLabel(locale, decade[2])}` : '';
    return t(locale, 'playlist.decade', { decade: decade[1]! }) + rest;
  }
  const total = /^Total\s+(.+)$/i.exec(label);
  if (total) return t(locale, 'playlist.allOfType', { type: subjectLabel(locale, total[1]!) });
  return label
    .split(/(\s+(?:&|vs\.?)\s+)/i)
    .map((part) => (/^\s+(?:&|vs\.?)\s+$/i.test(part) ? part : carTypeLabel(locale, part)))
    .join('');
}

/** What the requirement asks for, in one short line. */
export function requirementText(locale: Locale, event: PlaylistEvent): string {
  const req = event.requirement;
  if (req.scope === 'rarity') {
    const key = `rarity.${(req.scopeLabel ?? '').toLowerCase().replace(/\s+/g, '-')}` as MessageKey;
    const value = RARITY_KEYS.has(key) ? t(locale, key) : (req.scopeLabel ?? '');
    return t(locale, 'playlist.rarity', { value });
  }
  if (!req.scopeLabel || req.scope === 'any') return t(locale, 'playlist.anyCar');
  return subjectLabel(locale, req.scopeLabel);
}

/** Approximate reset time of the weekly playlist (Thursday, ~14:30 UTC). */
export const seasonEndsAt = (endsOn: string | undefined): string | undefined =>
  endsOn ? `${endsOn}T14:30:00Z` : undefined;
