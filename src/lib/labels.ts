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

/** Texts for the Preact cards (islands receive plain strings, not the i18n helper). */
export function carCardLabels(locale: Locale): CarCardLabels {
  return {
    shareCode: t(locale, 'card.shareCode'),
    copy: t(locale, 'common.copy'),
    copied: t(locale, 'common.copied'),
    noCode: t(locale, 'common.noCode', { tuner: '{tuner}' }),
    by: t(locale, 'card.by'),
    recommended: t(locale, 'card.recommended'),
    recommendedWhy: t(locale, 'card.recommendedWhy'),
    defaultTier: t(locale, 'card.defaultTier'),
    metaTuners: t(locale, 'card.metaTuners'),
    otherTunes: t(locale, 'card.otherTunes', { n: '{n}' }),
    noTunes: t(locale, 'card.noTunes'),
    obtain: t(locale, 'car.obtain'),
    openPage: t(locale, 'card.openPage'),
    surfaces: {
      road: t(locale, 'surface.road'),
      dirt: t(locale, 'surface.dirt'),
      'cross-country': t(locale, 'surface.cross-country'),
      unknown: t(locale, 'surface.unknown'),
    },
    categories: {
      meta: t(locale, 'category.meta'),
      'off-meta': t(locale, 'category.off-meta'),
      purist: t(locale, 'category.purist'),
      meme: t(locale, 'category.meme'),
    },
    tires: Object.fromEntries(
      TIRES.map((tire) => [tire, t(locale, `tires.${tire}` as MessageKey)]),
    ),
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
