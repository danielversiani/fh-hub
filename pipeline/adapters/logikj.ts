import { cell, findHeader } from '../lib/table';
import { parseClass } from '../normalize/fields';
import type { ListLevel } from '../schema/enums';
import { styleOf } from './fhstats';
import { emptyOutput, requireTab, type Adapter } from './types';

const COLUMNS = [
  'Year',
  'Make',
  'Model',
  'Class',
  'Road Surface',
  'Notes',
  'Tuner',
  'Tune Name',
  'Tune Date',
  'Share Code',
] as const;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** " 11 Jun 26" → "2026-06-11". */
export function parseShortDayMonthYear(text: string | undefined): string | undefined {
  const m = /(\d{1,2})\s+([a-z]{3})\w*\s+(\d{2,4})/i.exec(text ?? '');
  if (!m) return undefined;
  const month = MONTHS.indexOf(m[2]!.toLowerCase());
  if (month < 0) return undefined;
  const year = m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return `${year}-${String(month + 1).padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
}

/** The label LogikJ writes in his notes / tune names ("Meta", "Offmeta", "Very strong"…). */
export function levelOf(text: string): [ListLevel, string] {
  const t = text.toLowerCase();
  if (/off ?meta/.test(t)) return ['offmeta', 'Offmeta'];
  if (/\bmeta\b/.test(t)) return ['meta', 'Meta'];
  if (/strong/.test(t)) return ['strong', 'Strong'];
  return ['pick', 'Pick'];
}

/**
 * LogikJ's "Online Racing Tune Picks" tab: his "best of the best" list for online, one row per
 * car with class, surface, notes ("Online, Rivals - Very strong… offmeta"), tune and share code.
 */
export const logikj: Adapter = {
  id: 'logikj',
  parse(input) {
    const out = emptyOutput();
    for (const tab of input.source.tabs) {
      const { rows } = requireTab(input, tab.id, 'table');
      const { index, col } = findHeader(rows, COLUMNS, { sourceId: input.source.id, tab: tab.id });
      rows.slice(index + 1).forEach((row, offset) => {
        const make = cell(row, col.Make);
        const model = cell(row, col.Model).replace(/\s*\('\d{2}\)$/, '');
        const year = cell(row, col.Year);
        const carClass = parseClass(cell(row, col.Class));
        if (!make || !model || !carClass) return;
        const surface = /off ?road|dirt/i.test(cell(row, col['Road Surface'])) ? 'dirt' : 'road';
        const notes = cell(row, col.Notes);
        const tuneName = cell(row, col['Tune Name']);
        const text = `${notes} ${tuneName}`;
        const [level, label] = levelOf(text);
        const tuner = cell(row, col.Tuner) || 'LogikJ';
        const date = parseShortDayMonthYear(cell(row, col['Tune Date']));
        const car = {
          text: `${year} ${make} ${model}`.trim(),
          year: /^\d{4}$/.test(year) ? Number(year) : undefined,
          make,
          model,
        };
        const rowNumber = index + offset + 2;
        out.lists.push({
          tab: tab.id,
          row: rowNumber,
          car,
          carClass,
          surface,
          level,
          label,
          style: styleOf(text),
          extreme: /\bgrip\b/i.test(text) && !/online/i.test(text) ? true : undefined,
          online: /online|lobb/i.test(notes) || undefined,
          tuners: [tuner],
          date,
        });
        const code = cell(row, col['Share Code']);
        if (code) {
          out.tunes.push({
            tab: tab.id,
            row: rowNumber,
            car,
            tuner,
            name: tuneName || `${carClass} ${surface}`,
            carClass,
            surfaceText: surface,
            notes,
            shareCode: code,
            createdAt: date,
            raw: {},
          });
        }
      });
    }
    return out;
  },
};
