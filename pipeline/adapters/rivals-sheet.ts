import { HeaderMismatchError } from '../lib/table';
import { parseClass } from '../normalize/fields';
import type { Surface } from '../schema/enums';
import { emptyOutput, requireTab, type Adapter } from './types';

/** Tab id → surface of its races. */
const SURFACE_BY_TAB: Readonly<Record<string, Surface>> = {
  road: 'road',
  dirt: 'dirt',
  'cross-country': 'cross-country',
};

/**
 * "FH6 Rivals Meta Sheet": one tab per surface, one row per Rivals track, and for each class the
 * car most used at the top of the leaderboard ("R-Class") and the runner-up
 * ("R-Class 2nd Choice"). Car names are short nicknames ("MX-5 FE 1994"); the resolver and
 * data/manual/car-aliases.yaml turn them into car ids.
 */
export const rivalsSheet: Adapter = {
  id: 'rivals-sheet',
  parse(input) {
    const out = emptyOutput();
    for (const tab of input.source.tabs) {
      const surface = SURFACE_BY_TAB[tab.id];
      if (!surface) throw new Error(`[${input.source.id}] unknown tab "${tab.id}"`);
      const { rows } = requireTab(input, tab.id, 'table');
      // Header: first cell ends with "Races" ("Road Races", "Dirt Races"…).
      const index = rows.findIndex((r) => /races$/i.test((r[0] ?? '').trim()));
      if (index < 0) {
        throw new HeaderMismatchError(input.source.id, tab.id, ['<surface> Races']);
      }
      const header = rows[index]!;
      const columns = header.flatMap((label, col) => {
        const match = /^(\S+)-Class(\s+2nd Choice)?$/i.exec(label.trim());
        const carClass = match ? parseClass(match[1]) : undefined;
        return carClass ? [{ col, carClass, choice: (match![2] ? 2 : 1) as 1 | 2 }] : [];
      });
      for (let r = index + 1; r < rows.length; r++) {
        const row = rows[r]!;
        const track = (row[0] ?? '').trim();
        if (!track) break; // the table ends at the first empty row
        for (const { col, carClass, choice } of columns) {
          const car = (row[col] ?? '').trim();
          if (!car || car === '-') continue;
          out.rivals.push({
            tab: tab.id,
            row: r + 1,
            track,
            surface,
            carClass,
            choice,
            car: { text: car },
          });
        }
      }
    }
    return out;
  },
};
