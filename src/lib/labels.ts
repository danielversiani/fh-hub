import { t, type Locale, type MessageKey } from '../i18n';
import type { CarCardLabels } from '../islands/CarCard';
import type { TuneBrowserLabels } from '../islands/TuneBrowser';

const TIRES = [
  'stock',
  'street',
  'sport',
  'semi-slick',
  'slick',
  'super-slick',
  'rally',
  'offroad',
  'snow',
  'drift',
  'drag',
  'vintage',
  'vintage-race',
  'other',
] as const;

const OBTAIN = [
  'autoshow',
  'autoshow-dlc',
  'wheelspin',
  'seasonal',
  'collection-journal',
  'treasure',
  'loyalty',
  'aftermarket',
] as const;

const keyed = (locale: Locale, prefix: string, values: readonly string[]) =>
  Object.fromEntries(values.map((v) => [v, t(locale, `${prefix}.${v}` as MessageKey)]));

/** Texts for the Preact cards (islands receive plain strings, not the i18n helper). */
export function carCardLabels(locale: Locale): CarCardLabels {
  return {
    shareCode: t(locale, 'card.shareCode'),
    copy: t(locale, 'common.copy'),
    copied: t(locale, 'common.copied'),
    noCode: t(locale, 'common.noCode', { tuner: '{tuner}' }),
    tuneBy: t(locale, 'card.tuneBy'),
    recommendedWhy: t(locale, 'card.recommendedWhy'),
    defaultTier: t(locale, 'card.defaultTier'),
    metaRank: t(locale, 'card.metaRank', { n: '{n}' }),
    otherTunes: t(locale, 'card.otherTunes', { n: '{n}' }),
    noTunes: t(locale, 'card.noTunes'),
    obtain: t(locale, 'car.obtain'),
    auction: t(locale, 'card.auction'),
    openPage: t(locale, 'card.openPage'),
    stock: t(locale, 'car.stock'),
    notes: t(locale, 'card.notes'),
    translate: t(locale, 'card.translate'),
    translateTo: locale === 'en' ? 'en' : 'pt',
    worldRecord: t(locale, 'card.worldRecord'),
    lapBy: t(locale, 'card.lapBy', { driver: '{driver}' }),
    spec: {
      drivetrain: t(locale, 'card.spec.drivetrain'),
      tires: t(locale, 'card.spec.tires'),
      style: t(locale, 'card.spec.style'),
      difficulty: t(locale, 'card.spec.difficulty'),
    },
    surfaces: {
      road: t(locale, 'surface.road'),
      dirt: t(locale, 'surface.dirt'),
      'cross-country': t(locale, 'surface.cross-country'),
      unknown: t(locale, 'surface.unknown'),
    },
    // Meme is a playlist-only category (owner's rule): not a filter of the tune list.
    categories: keyed(locale, 'category', ['meta', 'off-meta', 'purist']),
    rarities: keyed(locale, 'rarity', ['common', 'rare', 'epic', 'legendary', 'forza-edition']),
    tires: keyed(locale, 'tires', TIRES),
    roles: keyed(locale, 'role', ['allround', 'power', 'handling']),
    difficulties: keyed(locale, 'difficulty', [
      'easy',
      'normal',
      'slightly-hard',
      'hard',
      'very-hard',
    ]),
    obtainMethods: keyed(locale, 'obtain', OBTAIN),
  };
}

export function tuneBrowserLabels(locale: Locale): TuneBrowserLabels {
  return {
    ...carCardLabels(locale),
    search: t(locale, 'browse.search'),
    all: t(locale, 'common.all'),
    classLabel: t(locale, 'common.class'),
    surfaceLabel: t(locale, 'common.surface'),
    categoryLabel: t(locale, 'tunes.category'),
    results: t(locale, 'browse.results', { n: '{n}' }),
    loading: t(locale, 'tunes.loading'),
    empty: t(locale, 'tunes.empty'),
    showMore: t(locale, 'browse.showMore'),
    tunesCount: t(locale, 'cars.tunesCount', { n: '{n}' }),
    orderHint: t(locale, 'browse.orderHint'),
  };
}
