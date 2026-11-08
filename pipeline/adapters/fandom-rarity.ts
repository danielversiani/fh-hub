import type { WikiCategory } from '../fetchers/mediawiki';
import { emptyOutput, requireTab, type Adapter } from './types';

/**
 * Car rarity from the Forza Wiki (Fandom, CC BY-SA): one category per rarity, each page title
 * being a car ("Abarth Fiat 131", "Volkswagen Golf R (2014)"). The tab id is the rarity.
 * Pages for traffic vehicles and event-only variants are not roster cars and are skipped.
 */
const NOT_ROSTER = [
  /\bTraffic$/,
  /^Playground\s/,
  /'(Touge Edition|Initial Drive|RakuRaku Express)'$/,
];

export const fandomRarity: Adapter = {
  id: 'fandom-rarity',
  parse(input) {
    const out = emptyOutput();
    for (const tab of input.source.tabs) {
      const { data } = requireTab(input, tab.id, 'json');
      const category = data as WikiCategory;
      if (!Array.isArray(category?.titles)) {
        throw new Error(`[${input.source.id}/${tab.id}] not a wiki category payload`);
      }
      category.titles.forEach((title, i) => {
        if (NOT_ROSTER.some((re) => re.test(title))) return;
        out.carAttributes.push({ tab: tab.id, row: i + 1, car: { text: title }, rarity: tab.id });
      });
    }
    return out;
  },
};
