import type { WikiCategory, WikiPageImages } from '../fetchers/mediawiki';
import { emptyOutput, requireTab, type Adapter, type AdapterInput } from './types';

/**
 * Car facts from the Forza Wiki (Fandom, CC BY-SA), read from its categories: each category
 * page title is a car ("Abarth Fiat 131", "Volkswagen Golf R (2014)").
 * Pages for traffic vehicles and event-only variants are not roster cars and are skipped.
 */
const NOT_ROSTER = [
  /\bTraffic$/,
  /^Playground\s/,
  /'(Touge Edition|Initial Drive|RakuRaku Express)'$/,
];

function titlesOf(input: AdapterInput, tabId: string): string[] {
  const { data } = requireTab(input, tabId, 'json');
  const category = data as WikiCategory;
  if (!Array.isArray(category?.titles)) {
    throw new Error(`[${input.source.id}/${tabId}] not a wiki category payload`);
  }
  return category.titles.filter((title) => !NOT_ROSTER.some((re) => re.test(title)));
}

/** Rarity: one category per rarity (FH6 only); the tab id is the rarity. */
export const fandomRarity: Adapter = {
  id: 'fandom-rarity',
  parse(input) {
    const out = emptyOutput();
    for (const tab of input.source.tabs) {
      titlesOf(input, tab.id).forEach((title, i) => {
        out.carAttributes.push({ tab: tab.id, row: i + 1, car: { text: title }, rarity: tab.id });
      });
    }
    return out;
  },
};

const DRIVETRAINS = ['fwd', 'rwd', 'awd'] as const;

/**
 * Stock drivetrain: the wiki's "Front-/Rear-/All-Wheel Drive" categories cover every Forza game,
 * so only cars also in the `fh6` tab ("Cars (FH6)") are kept. A car listed under two drivetrains
 * is ambiguous and left out (its eligibility stays unknown).
 */
export const fandomDrivetrain: Adapter = {
  id: 'fandom-drivetrain',
  parse(input) {
    const out = emptyOutput();
    const fh6 = new Set(titlesOf(input, 'fh6'));
    const found = new Map<string, string[]>();
    for (const drivetrain of DRIVETRAINS) {
      for (const title of titlesOf(input, drivetrain)) {
        if (fh6.has(title)) found.set(title, [...(found.get(title) ?? []), drivetrain]);
      }
    }
    [...found.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([title, drivetrains], i) => {
        if (drivetrains.length !== 1) {
          out.warnings.push(`${title}: listed under ${drivetrains.join(' and ')}, skipped`);
          return;
        }
        out.carAttributes.push({
          tab: drivetrains[0]!,
          row: i + 1,
          car: { text: title },
          drivetrain: drivetrains[0]!.toUpperCase(),
        });
      });
    return out;
  },
};

/**
 * Car photos (ADR-0013): the lead image of each FH6 car page. Only FH6 screenshots are used
 * ("FH6_…" files): a page about a car that is in several games may lead with another game.
 */
export const fandomImages: Adapter = {
  id: 'fandom-images',
  parse(input) {
    const out = emptyOutput();
    for (const tab of input.source.tabs) {
      const { data } = requireTab(input, tab.id, 'json');
      const pages = (data as WikiPageImages)?.pages;
      if (!Array.isArray(pages)) {
        throw new Error(`[${input.source.id}/${tab.id}] not a wiki page-images payload`);
      }
      pages.forEach((page, i) => {
        if (NOT_ROSTER.some((re) => re.test(page.title))) return;
        if (!page.thumb || !/^fh6[_ ]/i.test(page.file ?? '')) return;
        out.carAttributes.push({
          tab: tab.id,
          row: i + 1,
          car: { text: page.title },
          image: page.thumb,
        });
      });
    }
    return out;
  },
};
