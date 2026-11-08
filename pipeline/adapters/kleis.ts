import ExcelJS from 'exceljs';
import { cell as tableCell, findHeader, type Table } from '../lib/table';
import type { CarClass } from '../schema/enums';
import { parseClassPrefix } from '../normalize/fields';
import { emptyOutput, requireTab, type Adapter } from './types';

const COLUMNS = [
  'Car',
  'Tuner',
  'Tune',
  'Terrain',
  'Drivetrain',
  'Designer',
  'Design',
  'Comment',
] as const;

/**
 * kleis' sheet has no class column: the class is the fill colour of column A, following the
 * in-game class colours. Mapping confirmed on 2026-11-08 by cross-checking ~1,400 tune names
 * that start with a class letter (e.g. "C Road Purist"). Keys are ARGB or `theme:<n>`.
 */
export const CLASS_BY_FILL: Readonly<Record<string, CarClass>> = {
  FF9FC5E8: 'D',
  FFFFC000: 'C',
  'theme:7': 'C',
  FFED7D31: 'B',
  FFFF0000: 'A',
  FF7030A0: 'S1',
  FF0070C0: 'S2',
  FFFF00FF: 'R',
  FF9900FF: 'R',
};

function fillKey(cell: ExcelJS.Cell): string | undefined {
  const fill = cell.fill;
  if (!fill || fill.type !== 'pattern' || !fill.fgColor) return undefined;
  const color = fill.fgColor as { argb?: string; theme?: number };
  if (color.argb) return color.argb.toUpperCase();
  return color.theme === undefined ? undefined : `theme:${color.theme}`;
}

export async function readWorksheet(
  bytes: Buffer,
  sheetName: string,
  width: number,
): Promise<{ rows: Table; fills: (string | undefined)[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new Error(`worksheet "${sheetName}" not found`);
  const rows: Table = [];
  const fills: (string | undefined)[] = [];
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    rows.push(Array.from({ length: width }, (_, i) => row.getCell(i + 1).text ?? ''));
    fills.push(fillKey(row.getCell(1)));
  }
  return { rows, fills };
}

export const kleis: Adapter = {
  id: 'kleis',
  async parse(input) {
    const out = emptyOutput();
    for (const tab of input.source.tabs) {
      const { bytes } = requireTab(input, tab.id, 'workbook');
      const { rows, fills } = await readWorksheet(bytes, tab.sheet ?? 'FH6', COLUMNS.length);
      const { index, col } = findHeader(rows, COLUMNS, { sourceId: input.source.id, tab: tab.id });
      let unknownFill = 0;
      let conflicts = 0;

      for (let r = index + 1; r < rows.length; r++) {
        const row = rows[r];
        const carText = tableCell(row, col.Car);
        const tuner = tableCell(row, col.Tuner);
        const name = tableCell(row, col.Tune);
        if (!carText || !tuner || !name) continue;

        const fill = fills[r];
        const fromFill = fill ? CLASS_BY_FILL[fill] : undefined;
        const fromName = parseClassPrefix(name);
        if (!fromFill) unknownFill++;
        if (fromFill && fromName && fromFill !== fromName) conflicts++;

        out.tunes.push({
          tab: tab.id,
          row: r + 1,
          car: { text: carText },
          tuner,
          name,
          carClass: fromFill ?? fromName ?? null,
          surfaceText: tableCell(row, col.Terrain),
          drivetrain: tableCell(row, col.Drivetrain),
          build: tableCell(row, col.Comment) || undefined,
          raw: {
            ...Object.fromEntries(COLUMNS.map((c) => [c, tableCell(row, col[c])])),
            fill: fill ?? '',
          },
        });
      }
      if (unknownFill) out.warnings.push(`${unknownFill} rows with an unmapped fill colour`);
      if (conflicts)
        out.warnings.push(`${conflicts} rows where fill colour and tune name disagree`);
    }
    return out;
  },
};
