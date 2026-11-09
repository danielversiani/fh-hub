import { cell } from '../lib/table';
import { parseClass } from '../normalize/fields';
import { styleOf } from './fhstats';
import { emptyOutput, requireTab, type Adapter } from './types';

const lines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);

/**
 * aTTaX Johnson's "Horizon 6" tab: per class, the cars he recommends with what the tune is
 * "MADE FOR" (Allround, Pure Handling, Acceleration-Speed, Dirt …), its creator and share code.
 * A cell can hold several tunes, one per line (made-for, creator and code line up).
 */
export const attaxJohnson: Adapter = {
  id: 'attax-johnson',
  parse(input) {
    const out = emptyOutput();
    for (const tab of input.source.tabs) {
      const { rows } = requireTab(input, tab.id, 'table');
      const head = rows.findIndex(
        (r) => cell(r, 0).toUpperCase() === 'CLASS' && /CAR/i.test(cell(r, 1)),
      );
      if (head < 0) throw new Error(`[${input.source.id}/${tab.id}] header "CLASS, CAR" not found`);
      rows.slice(head + 1).forEach((row, offset) => {
        const carClass = parseClass(cell(row, 0).split(/[\s-]/)[0]);
        const name = cell(row, 1);
        if (!carClass || !name) return;
        // "Honda City E II '84" → year in front helps the car resolver.
        const yy = /\s'(\d{2})$/.exec(name);
        const text = yy
          ? `${Number(yy[1]) > 30 ? 19 : 20}${yy[1]} ${name.slice(0, yy.index)}`
          : name;
        // "Allround Allround" (a word typed twice in the sheet) reads as "Allround".
        const made = lines(cell(row, 2)).map((p) => p.replace(/\b(\w+)(?:\s+\1\b)+/gi, '$1'));
        const creators = lines(cell(row, 3));
        const codes = lines(cell(row, 4));
        const rowNumber = head + offset + 2;
        const seen = new Set<string>();
        made.forEach((purpose, i) => {
          const surface = /^dirt/i.test(purpose) ? 'dirt' : 'road';
          const creator = creators[i] ?? creators[0] ?? '';
          if (!seen.has(surface)) {
            seen.add(surface);
            out.lists.push({
              tab: tab.id,
              row: rowNumber,
              car: { text },
              carClass,
              surface,
              level: 'pick',
              label: purpose,
              style:
                /speed|acceleration/i.test(purpose) && !/allround|handling/i.test(purpose)
                  ? 'power'
                  : styleOf(purpose),
              extreme:
                /pure handling/i.test(purpose) ||
                (/speed/i.test(purpose) && !/allround/i.test(purpose)) ||
                undefined,
              tuners: creator ? [creator] : [],
            });
          }
          const code = codes[i];
          if (code && creator) {
            out.tunes.push({
              tab: tab.id,
              row: rowNumber,
              car: { text },
              tuner: creator,
              name: `${carClass} ${purpose}`,
              carClass,
              surfaceText: surface,
              build: purpose,
              shareCode: code,
              raw: {},
            });
          }
        });
      });
    }
    return out;
  },
};
