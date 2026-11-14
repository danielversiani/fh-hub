import ExcelJS from 'exceljs';
import { cell, findHeader, type Table } from '../lib/table';
import { slugify } from '../lib/text';
import { parseClass } from '../normalize/fields';
import { emptyOutput, requireTab, type Adapter } from './types';

const COLUMNS = [
  'Manufacturer',
  'Model/Car',
  'Tuner',
  'Tune Name',
  'Drivetrain',
  'Tyre Compound',
  'Date Created',
  'Sharecode',
  'Difficulty',
] as const;

/** "S1 800 - Road", "A 700 - CC": one tab per class × surface. */
const TAB = /^\s*(D|C|B|A|S1|S2|R|X)\s+\d{3}\s*-\s*(Road|Dirt|CC|Cross Country)\s*$/i;
const SURFACE: Readonly<Record<string, string>> = {
  road: 'road',
  dirt: 'dirt',
  cc: 'cross-country',
  'cross country': 'cross-country',
};

/** "25/10/2026", "21/5/2026" (day first) → ISO; "30/09/2-26" is read as 2026. */
export function parseSheetDate(text: string): string | undefined {
  if (/^\d{4}-\d{2}-\d{2}$/.test(text.trim())) return text.trim();
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4}|2-\d{2})$/.exec(text.trim());
  if (!m) return undefined;
  const year = m[3]!.replace(/^2-/, '20');
  const iso = `${year}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  return Number.isNaN(Date.parse(iso)) ? undefined : iso;
}

/** "22 Valkyrie AMR Pro" → year 2022; "1997 Skyline…" stays; "GEN-F GTS" has no year. */
export function splitYear(model: string): { year?: number; model: string } {
  const m = /^(\d{2}|\d{4})\s+(.+)$/.exec(model.trim());
  if (!m) return { model: model.trim() };
  const n = Number(m[1]);
  const year = m[1]!.length === 4 ? n : n <= 40 ? 2000 + n : 1900 + n;
  return { year, model: m[2]! };
}

async function readTabs(bytes: Buffer): Promise<{ name: string; rows: Table }[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
  return workbook.worksheets
    .filter((sheet) => TAB.test(sheet.name))
    .map((sheet) => {
      const rows: Table = [];
      for (let r = 1; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        rows.push(
          Array.from({ length: 12 }, (_, i) => {
            const c = row.getCell(i + 1);
            // Real date cells come as dates (midnight UTC); typed ones as text.
            return c.value instanceof Date ? c.value.toISOString().slice(0, 10) : (c.text ?? '');
          }),
        );
      }
      return { name: sheet.name, rows };
    });
}

/**
 * The Forza Paddock's own tune recommendations (owner's sheet, ADR-0020): one tab per class ×
 * surface, one row per recommended tune (any tuner). Rows without a creation date are left out
 * (owner, 2026-11-14: unfinished rows), so a row goes live once its date is filled in.
 */
export const forzaPaddock: Adapter = {
  id: 'forza-paddock',
  async parse(input) {
    const out = emptyOutput();
    for (const tab of input.source.tabs) {
      const { bytes } = requireTab(input, tab.id, 'workbook');
      for (const { name: sheet, rows } of await readTabs(bytes)) {
        const [, cls, surface] = TAB.exec(sheet)!;
        const { index, col } = findHeader(rows, COLUMNS, {
          sourceId: input.source.id,
          tab: sheet,
        });
        rows.slice(index + 1).forEach((row, offset) => {
          const make = cell(row, col.Manufacturer);
          const { year, model } = splitYear(cell(row, col['Model/Car']));
          const tuner = cell(row, col.Tuner);
          const name = cell(row, col['Tune Name']);
          const createdAt = parseSheetDate(cell(row, col['Date Created']));
          if (!make || !model || !tuner || !name || !createdAt) return;
          out.tunes.push({
            tab: slugify(sheet),
            row: index + offset + 2,
            car: { text: `${year ?? ''} ${make} ${model}`.trim(), year, make, model },
            tuner,
            name,
            carClass: parseClass(cls) ?? null,
            surfaceText: SURFACE[surface!.toLowerCase()],
            drivetrain: cell(row, col.Drivetrain),
            tires: cell(row, col['Tyre Compound']),
            shareCode: cell(row, col.Sharecode),
            createdAt,
            difficulty: cell(row, col.Difficulty) || undefined,
            recommended: true,
            raw: Object.fromEntries(COLUMNS.map((c) => [c, cell(row, col[c])])),
          });
        });
      }
    }
    return out;
  },
};
