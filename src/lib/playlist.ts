import type { PlaylistEvent } from '../../pipeline/schema/entities';
import { formatNumber, t, type Locale } from '../i18n';

/** "Car: 2009 Ferrari 458 Italia" → "2009 Ferrari 458 Italia"; "Credits: 150000" → "150.000 CR". */
export function formatReward(locale: Locale, reward: string | undefined): string | undefined {
  if (!reward) return undefined;
  const car = /^Car:\s*(.+)$/i.exec(reward);
  if (car) return car[1];
  const credits = /^Credits:\s*([\d,.]+)$/i.exec(reward);
  if (credits) return `${formatNumber(locale, Number(credits[1]!.replace(/[,.]/g, '')))} CR`;
  return reward;
}

/** What the requirement asks for, in one short line. */
export function requirementText(locale: Locale, event: PlaylistEvent): string {
  const req = event.requirement;
  if (req.scope === 'rarity') return t(locale, 'playlist.rarity', { value: req.scopeLabel ?? '' });
  return req.scopeLabel ?? t(locale, 'playlist.anyCar');
}

/** Approximate reset time of the weekly playlist (Thursday, ~14:30 UTC). */
export const seasonEndsAt = (endsOn: string | undefined): string | undefined =>
  endsOn ? `${endsOn}T14:30:00Z` : undefined;
