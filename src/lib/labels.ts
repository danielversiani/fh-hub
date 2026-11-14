import { t, tGroup, type Locale, type MessageKey } from '../i18n';
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
    otherTunes: t(locale, 'card.otherTunes', { n: '{n}' }),
    noTunes: t(locale, 'card.noTunes'),
    obtain: t(locale, 'car.obtain'),
    auction: t(locale, 'card.auction'),
    openPage: t(locale, 'card.openPage'),
    stock: t(locale, 'car.stock'),
    notes: t(locale, 'card.notes'),
    worldRecord: t(locale, 'card.worldRecord'),
    lapBy: t(locale, 'card.lapBy', { driver: '{driver}' }),
    tuneDate: t(locale, 'card.tuneDate', { date: '{date}' }),
    tiers: {
      'meta-plus': t(locale, 'tier.meta-plus'),
      meta: t(locale, 'tier.meta'),
      'off-meta': t(locale, 'tier.off-meta'),
      niche: t(locale, 'tier.niche'),
      other: t(locale, 'tier.other'),
    },
    brainAfk: t(locale, 'card.brainAfk'),
    brainAfkHelp: t(locale, 'card.brainAfkHelp'),
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
    carTypes: tGroup(locale, 'carType'),
    lang: locale,
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
    carTypeLabel: t(locale, 'tunes.carType'),
    anyType: t(locale, 'tunes.anyType'),
    drivetrainLabel: t(locale, 'tunes.drivetrain'),
    rarityLabel: t(locale, 'tunes.rarity'),
    results: t(locale, 'browse.results', { n: '{n}' }),
    alt: {
      title: t(locale, 'alt.title'),
      lead: t(locale, 'alt.lead'),
      pickClass: t(locale, 'alt.pickClass'),
      sources: t(locale, 'alt.sources', { n: '{n}' }),
      rivals: t(locale, 'alt.rivals', { n: '{n}' }),
      updated: t(locale, 'alt.updated', { date: '{date}' }),
      how: t(locale, 'alt.how'),
      howText: t(locale, 'alt.howText'),
      highlights: t(locale, 'alt.highlights'),
      showAll: t(locale, 'alt.showAll', { n: '{n}' }),
      showLess: t(locale, 'alt.showLess'),
      none: t(locale, 'alt.none'),
      tags: {
        featured: t(locale, 'alt.tag.featured'),
        recent: t(locale, 'alt.tag.recent'),
        sleeper: t(locale, 'alt.tag.sleeper'),
        rivals: t(locale, 'alt.tag.rivals'),
      },
      tagHelp: {
        featured: '',
        recent: t(locale, 'alt.tagHelp.recent'),
        sleeper: t(locale, 'alt.tagHelp.sleeper'),
        rivals: t(locale, 'alt.tagHelp.rivals'),
      },
    },
    loading: t(locale, 'tunes.loading'),
    empty: t(locale, 'tunes.empty'),
    showMore: t(locale, 'browse.showMore'),
    tunesCount: t(locale, 'cars.tunesCount', { n: '{n}' }),
    orderHint: t(locale, 'browse.orderHint'),
  };
}
